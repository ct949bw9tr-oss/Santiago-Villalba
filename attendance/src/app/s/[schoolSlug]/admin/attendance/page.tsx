import Link from "next/link";
import { CircleCheck, Clock, Download, Filter, TrendingUp, UserX, Users } from "lucide-react";
import { addDays, filtersToQuery, parseReportFilters, STATUSES } from "@/lib/reports/filters";
import { localDateKey } from "@/lib/time";
import { attendanceRate, fmtDate, fmtDayKey, fmtRate, fmtTime, rateTone, SOURCE_LABEL, STATUS_LABEL } from "@/lib/ui/format";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { fetchBucketTotals, fetchRecords, fetchSummaries, splitRange, sumClassTotals } from "@/server/reports/queries";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, Donut, HBars, Legend, LineChart } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { RateCell } from "@/components/ui/rate";
import { Badge, StatusBadge } from "@/components/ui/status-badge";

const DETAIL_ROWS = 50;
const TONE_COLOR = { green: CHART_COLORS.green, orange: CHART_COLORS.orange, red: CHART_COLORS.red } as Record<string, string>;

export const metadata = { title: "Analytics" };

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export default async function AttendanceReportPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/admin/attendance">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;
  const today = localDateKey(new Date(), tz);
  const { filters, error: filterError } = parseReportFilters(await searchParams, today);

  // Previous period of the same length, right before the selected one.
  const span = daysBetween(filters.from, filters.to);
  const prev = { ...filters, from: addDays(filters.from, -span), to: addDays(filters.from, -1) };
  const buckets = splitRange(filters.from, filters.to, 20).map((b) => ({
    ...b,
    label: b.from === b.to ? fmtDayKey(b.from) : `${fmtDayKey(b.from)}`,
  }));

  const [{ byStudent, byClass }, previous, series, records, { data: classes }, { data: students }] = await Promise.all([
    fetchSummaries(supabase, schoolId, filters),
    fetchSummaries(supabase, schoolId, prev),
    fetchBucketTotals(supabase, schoolId, buckets, filters.classId),
    fetchRecords(supabase, schoolId, tz, filters, { offset: 0, limit: DETAIL_ROWS }),
    supabase.from("class_sections").select("id, name").eq("school_id", schoolId).order("name"),
    supabase
      .from("students")
      .select("id, first_name, last_name, student_number, grade_level")
      .eq("school_id", schoolId)
      .order("last_name"),
  ]);

  // Totals follow the class filter (the class summary itself always lists every class).
  const scope = <T extends { class_section_id: string }>(rows: T[]) =>
    filters.classId ? rows.filter((c) => c.class_section_id === filters.classId) : rows;
  const totals = sumClassTotals(scope(byClass));
  const prevTotals = sumClassTotals(scope(previous.byClass));
  const overallRate = attendanceRate(totals);
  const prevRate = attendanceRate(prevTotals);
  const base = `/s/${schoolSlug}/admin`;
  const exportHref = `${base}/attendance/export?${filtersToQuery(filters)}`;
  const studentRows = filters.studentId ? byStudent.filter((s) => s.student_id === filters.studentId) : byStudent;
  const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : 0);
  const marked = totals.present + totals.late + totals.absent + totals.excused;
  const prevMarked = prevTotals.present + prevTotals.late + prevTotals.absent + prevTotals.excused;

  // By grade (from the per-student summary).
  const gradeOf = new Map((students ?? []).map((s) => [s.id, s.grade_level ?? "Sin grado"]));
  const byGrade = new Map<string, { present: number; late: number; absent: number }>();
  for (const s of byStudent) {
    const g = gradeOf.get(s.student_id) ?? "Sin grado";
    const cur = byGrade.get(g) ?? { present: 0, late: 0, absent: 0 };
    cur.present += Number(s.present);
    cur.late += Number(s.late);
    cur.absent += Number(s.absent);
    byGrade.set(g, cur);
  }
  const gradeRows = [...byGrade.entries()]
    .map(([g, c]) => ({ g, rate: attendanceRate(c) }))
    .filter((r) => r.rate !== null)
    .sort((a, b) => a.g.localeCompare(b.g));
  const classRows = byClass
    .filter((c) => c.attendance_rate !== null)
    .map((c) => ({ ...c, rate: Number(c.attendance_rate) }))
    .sort((a, b) => b.rate - a.rate);
  const recurringLate = byStudent
    .filter((s) => Number(s.late) >= 3)
    .sort((a, b) => Number(b.late) - Number(a.late))
    .slice(0, 8);

  // Only periods that had classes (weekends and holidays would show as gaps).
  const withData = series.filter((b) => b.present + b.late + b.absent > 0);
  const seriesRates = withData.map((b) => attendanceRate(b));
  const lateShare = withData.map((b) => {
    const n = b.present + b.late + b.absent;
    return n ? pct(b.late, n) : null;
  });
  const absentShare = withData.map((b) => {
    const n = b.present + b.late + b.absent;
    return n ? pct(b.absent, n) : null;
  });
  const minRate = Math.min(100, ...seriesRates.filter((v): v is number => v !== null));
  const hasSeries = seriesRates.some((v) => v !== null);
  const bucketNote = buckets.length && buckets[0].from !== buckets[0].to ? ` · cada punto agrupa ${daysBetween(buckets[0].from, buckets[0].to)} días` : "";

  return (
    <div className="stack-lg">
      <PageHeader
        title="Analytics"
        subtitle={`Asistencia del ${fmtDayKey(filters.from)} al ${fmtDayKey(filters.to)} · comparado con los ${span} días anteriores`}
        actions={
          <a className="button secondary" href={exportHref}>
            <Download size={16} /> Descargar CSV
          </a>
        }
      />

      <form className="card filter-bar" action={`${base}/attendance`}>
        <label>
          Desde
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          Hasta
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Clase
          <select name="class" defaultValue={filters.classId ?? ""}>
            <option value="">Todas las clases</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estudiante
          <select name="student" defaultValue={filters.studentId ?? ""}>
            <option value="">Todos los estudiantes</option>
            {(students ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.last_name}, {s.first_name} ({s.student_number})
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Cualquier estado</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="inline">
          <button type="submit">
            <Filter size={15} /> Aplicar
          </button>
        </div>
      </form>
      {filterError && <p className="error">{filterError}</p>}

      <section className="grid-kpi">
        <KpiCard
          icon={CircleCheck}
          tone="green"
          value={overallRate === null ? "—" : fmtRate(overallRate).replace("%", "")}
          suffix={overallRate === null ? undefined : "%"}
          label="Asistencia general"
          trend={overallRate !== null && prevRate !== null ? { delta: overallRate - prevRate, unit: " pts", goodWhen: "up" } : null}
          foot={`Periodo anterior: ${fmtRate(prevRate)}`}
        />
        <KpiCard
          icon={Clock}
          tone="orange"
          value={totals.late}
          label="Llegadas tarde"
          trend={prevMarked ? { delta: pct(totals.late, marked) - pct(prevTotals.late, prevMarked), unit: " pts", goodWhen: "down" } : null}
          foot={`${pct(totals.late, marked)}% de los registros`}
        />
        <KpiCard
          icon={UserX}
          tone="red"
          value={totals.absent}
          label="Ausencias"
          trend={prevMarked ? { delta: pct(totals.absent, marked) - pct(prevTotals.absent, prevMarked), unit: " pts", goodWhen: "down" } : null}
          foot={`${totals.excused} excusadas (no cuentan en la tasa)`}
        />
        <KpiCard icon={Users} tone="blue" value={totals.sessions} label="Clases dictadas" foot={`${marked} registros de asistencia`} />
      </section>
      <p className="hint" style={{ marginTop: "-0.75rem" }}>
        Tasa = (presentes + tarde) ÷ (presentes + tarde + ausentes). Las ausencias excusadas no cuentan en contra.
      </p>

      <div className="grid-main">
        <Card
          title="Asistencia en el tiempo"
          subtitle={`${filters.classId ? "Clase seleccionada" : "Todo el colegio"}${bucketNote}`}
          action={
            <Legend
              items={[
                { label: "Asistencia", color: CHART_COLORS.primary },
                { label: "% tarde", color: CHART_COLORS.orange },
                { label: "% ausente", color: CHART_COLORS.red },
              ]}
            />
          }
        >
          {!hasSeries ? (
            <EmptyState icon={TrendingUp} title="Sin datos en este periodo" compact />
          ) : (
            <LineChart
              labels={withData.map((b) => b.label)}
              series={[
                { name: "Asistencia", color: CHART_COLORS.primary, values: seriesRates, area: true },
                { name: "% tarde", color: CHART_COLORS.orange, values: lateShare },
                { name: "% ausente", color: CHART_COLORS.red, values: absentShare },
              ]}
              min={0}
              max={100}
              height={240}
            />
          )}
          {hasSeries && minRate < 100 && <p className="hint">Punto más bajo del periodo: {fmtRate(minRate)}</p>}
        </Card>

        <Card title="Distribución" subtitle="Todos los registros del periodo">
          <div className="donut-wrap" style={{ justifyContent: "center" }}>
            <Donut
              size={150}
              center={fmtRate(overallRate)}
              sub="asistencia"
              segments={[
                { value: totals.present, color: CHART_COLORS.green, label: "Presente" },
                { value: totals.late, color: CHART_COLORS.orange, label: "Tarde" },
                { value: totals.absent, color: CHART_COLORS.red, label: "Ausente" },
                { value: totals.excused, color: CHART_COLORS.violet, label: "Excusado" },
              ]}
            />
            <div className="legend-list">
              {(
                [
                  ["present", CHART_COLORS.green],
                  ["late", CHART_COLORS.orange],
                  ["absent", CHART_COLORS.red],
                  ["excused", CHART_COLORS.violet],
                ] as const
              ).map(([k, color]) => (
                <div key={k} className="legend-row">
                  <i style={{ background: color }} />
                  {STATUS_LABEL[k]}
                  <strong>
                    {totals[k]} <span className="muted small-text">({pct(totals[k], marked)}%)</span>
                  </strong>
                </div>
              ))}
            </div>
          </div>
          <hr className="divider" style={{ margin: "1rem 0" }} />
          <div className="stack-sm small-text">
            <div className="row-between">
              <span className="text-2">Periodo actual</span>
              <strong>{fmtRate(overallRate)}</strong>
            </div>
            <div className="row-between">
              <span className="text-2">Periodo anterior</span>
              <strong>{fmtRate(prevRate)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Por clase" subtitle="Tasa de asistencia">
          {classRows.length === 0 ? (
            <EmptyState title="Sin datos" compact />
          ) : (
            <HBars
              rows={classRows.slice(0, 8).map((c) => ({
                key: c.class_section_id,
                label: <Link href={`${base}/attendance?${filtersToQuery({ ...filters, classId: c.class_section_id })}`}>{c.class_name}</Link>,
                value: c.rate,
                display: fmtRate(c.rate),
                color: TONE_COLOR[rateTone(c.rate)],
              }))}
            />
          )}
        </Card>
        <Card title="Por grado" subtitle="Tasa de asistencia">
          {gradeRows.length === 0 ? (
            <EmptyState title="Sin datos" compact />
          ) : (
            <HBars
              rows={gradeRows.map((r) => ({
                key: r.g,
                label: r.g,
                value: r.rate ?? 0,
                display: fmtRate(r.rate),
                color: TONE_COLOR[rateTone(r.rate)],
              }))}
            />
          )}
        </Card>
        <Card title="Tardanza recurrente" subtitle="3 o más llegadas tarde en el periodo">
          {recurringLate.length === 0 ? (
            <EmptyState icon={Clock} title="Nadie con tardanza recurrente" compact />
          ) : (
            <ul className="list">
              {recurringLate.map((s) => (
                <li key={s.student_id} className="list-item">
                  <div className="grow" style={{ minWidth: 0 }}>
                    <Person first={s.first_name} last={s.last_name} id={s.student_id} size="sm" sub={s.student_number} href={`${base}/students/${s.student_id}`} />
                  </div>
                  <Badge tone="warning">{s.late} tardes</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Detalle por clase" flush>
        {byClass.length === 0 ? (
          <EmptyState title="Sin asistencia en este periodo" compact />
        ) : (
          <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1.35rem" }}>Clase</th>
                  <th className="num">Sesiones</th>
                  <th className="num">Presentes</th>
                  <th className="num">Tarde</th>
                  <th className="num">Ausentes</th>
                  <th className="num">Excusados</th>
                  <th>Tasa</th>
                </tr>
              </thead>
              <tbody>
                {byClass.map((c) => (
                  <tr key={c.class_section_id}>
                    <td style={{ paddingLeft: "1.35rem" }}>
                      <Link className="cell-title" href={`${base}/attendance?${filtersToQuery({ ...filters, classId: c.class_section_id })}`}>
                        {c.class_name}
                      </Link>
                    </td>
                    <td data-label="Sesiones" className="num">{c.sessions}</td>
                    <td data-label="Presentes" className="num">{c.present}</td>
                    <td data-label="Tarde" className="num">{c.late}</td>
                    <td data-label="Ausentes" className="num">{c.absent}</td>
                    <td data-label="Excusados" className="num">{c.excused}</td>
                    <td data-label="Tasa">
                      <RateCell rate={c.attendance_rate === null ? null : Number(c.attendance_rate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Detalle por estudiante${filters.classId ? " (esta clase)" : ""}`} flush>
        {studentRows.length === 0 ? (
          <EmptyState title="Sin asistencia en este periodo" compact />
        ) : (
          <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1.35rem" }}>Estudiante</th>
                  <th className="num">Presentes</th>
                  <th className="num">Tarde</th>
                  <th className="num">Ausentes</th>
                  <th className="num">Excusados</th>
                  <th>Tasa</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((s) => (
                  <tr key={s.student_id}>
                    <td style={{ paddingLeft: "1.35rem" }}>
                      <Person
                        first={s.first_name}
                        last={s.last_name}
                        id={s.student_id}
                        size="sm"
                        sub={s.student_number}
                        href={`${base}/attendance?${filtersToQuery({ ...filters, studentId: s.student_id })}`}
                      />
                    </td>
                    <td data-label="Presentes" className="num">{s.present}</td>
                    <td data-label="Tarde" className="num">{s.late}</td>
                    <td data-label="Ausentes" className="num">{s.absent}</td>
                    <td data-label="Excusados" className="num">{s.excused}</td>
                    <td data-label="Tasa">
                      <RateCell rate={s.attendance_rate === null ? null : Number(s.attendance_rate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Registros"
        subtitle={records.length === DETAIL_ROWS ? `Últimos ${DETAIL_ROWS}: descarga el CSV para verlos todos` : `${records.length} registros`}
        action={
          <a className="card-link" href={exportHref}>
            <Download size={14} /> CSV
          </a>
        }
        flush
      >
        {records.length === 0 ? (
          <EmptyState title="Ningún registro coincide con estos filtros" compact />
        ) : (
          <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1.35rem" }}>Fecha</th>
                  <th>Clase</th>
                  <th>Estudiante</th>
                  <th>Estado</th>
                  <th>Llegada</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: "1.35rem" }}>
                      <Link className="cell-title" href={`/s/${schoolSlug}/sessions/${r.session.id}`}>
                        {fmtDate(r.session.starts_at, tz)}
                      </Link>
                      <div className="cell-sub">{fmtTime(r.session.starts_at, tz)}</div>
                    </td>
                    <td data-label="Clase">{r.session.class.name}</td>
                    <td data-label="Estudiante">
                      {r.student.last_name}, {r.student.first_name}
                    </td>
                    <td data-label="Estado">
                      <StatusBadge status={r.status} />
                      <div className="cell-sub" style={{ marginTop: 3 }}>
                        {SOURCE_LABEL[r.source]}
                        {r.source === "manual" && r.note ? `: ${r.note}` : ""}
                      </div>
                    </td>
                    <td data-label="Llegada">{r.checked_in_at ? fmtTime(r.checked_in_at, tz) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
