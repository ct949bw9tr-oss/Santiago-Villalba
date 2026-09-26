import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  Clock,
  CreditCard,
  Nfc,
  RadioTower,
  TrendingUp,
  UserX,
  XCircle,
} from "lucide-react";
import { addDays } from "@/lib/reports/filters";
import { localDateKey, utcWindowAroundLocalDay } from "@/lib/time";
import {
  attendanceRate,
  fmtDayKey,
  fmtLongDate,
  fmtRate,
  fmtTime,
  firstName,
  greeting,
  hourInZone,
} from "@/lib/ui/format";
import { getMyProfile, requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { fetchBucketTotals, type StudentSummary } from "@/server/reports/queries";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { BarChart, CHART_COLORS, Legend, LineChart } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBar } from "@/components/ui/rate";
import { Badge } from "@/components/ui/status-badge";

type Status = "present" | "late" | "absent" | "excused";
type TodaySession = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  room: string | null;
  class: { id: string; name: string; room: string | null; teachers: { teacher: { first_name: string; last_name: string } }[] };
  records: { status: Status; checked_in_at: string | null }[];
};
type ScanRow = {
  id: string;
  effective_at: string;
  outcome: string;
  response: { message?: string; attendance?: { status?: Status; class_name?: string } | null } | null;
  device: { name: string };
  student: { id: string; first_name: string; last_name: string } | null;
};
type DeviceRow = { id: string; name: string; kind: "reader" | "simulator"; status: "active" | "disabled"; last_seen_at: string | null };
type ClassRow = { id: string; name: string; teachers: { id: string }[]; schedules: { id: string }[] };

const COUNTED_TABLES = [
  { table: "students", label: "Estudiantes activos" },
  { table: "teachers", label: "Docentes" },
  { table: "class_sections", label: "Clases" },
  { table: "nfc_credentials", label: "Tarjetas NFC activas" },
] as const;

export const metadata = { title: "Inicio" };

export default async function AdminDashboard({ params }: PageProps<"/s/[schoolSlug]/admin">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;
  const base = `/s/${schoolSlug}/admin`;

  const now = new Date();
  const today = localDateKey(now, tz);
  const { from, to } = utcWindowAroundLocalDay(now);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 14));

  // Always scope by school_id explicitly: RLS allows every school the user
  // administers, and a person can be an admin in more than one school.
  const [profile, counts, sessionsRes, scansRes, devicesRes, classesRes, studentsRes, daily] = await Promise.all([
    getMyProfile(),
    Promise.all(
      COUNTED_TABLES.map(async ({ table, label }) => {
        let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("school_id", schoolId);
        if (table === "nfc_credentials" || table === "students") query = query.eq("status", "active");
        const { count, error } = await query;
        if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
        return { table, label, count: count ?? 0 };
      }),
    ),
    supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, status, room, class:class_sections!inner(id, name, room, teachers:class_teachers(teacher:teachers!inner(first_name, last_name))), records:attendance_records(status, checked_in_at)",
      )
      .eq("school_id", schoolId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .returns<TodaySession[]>(),
    supabase
      .from("scan_events")
      .select("id, effective_at, outcome, response, device:devices!inner(name), student:students(id, first_name, last_name)")
      .eq("school_id", schoolId)
      .order("received_at", { ascending: false })
      .limit(7)
      .returns<ScanRow[]>(),
    supabase
      .from("devices")
      .select("id, name, kind, status, last_seen_at")
      .eq("school_id", schoolId)
      .returns<DeviceRow[]>(),
    supabase
      .from("class_sections")
      .select("id, name, teachers:class_teachers(id), schedules:class_schedules(id)")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .returns<ClassRow[]>(),
    supabase.rpc("attendance_summary_by_student", {
      p_school_id: schoolId,
      p_from: addDays(today, -29),
      p_to: today,
      p_class_section_id: null,
    }),
    fetchBucketTotals(
      supabase,
      schoolId,
      last14.map((d) => ({ from: d, to: d, label: fmtDayKey(d) })),
    ),
  ]);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (studentsRes.error) throw new Error(studentsRes.error.message);

  const count = (t: string) => counts.find((c) => c.table === t)?.count ?? 0;
  const sessions = (sessionsRes.data ?? []).filter((s) => localDateKey(new Date(s.starts_at), tz) === today);
  const live = sessions.filter((s) => s.status !== "cancelled" && new Date(s.starts_at) <= now && now < new Date(s.ends_at));
  const upcoming = sessions.filter((s) => s.status !== "cancelled" && new Date(s.starts_at) > now);
  const finished = sessions.filter((s) => s.status !== "cancelled" && new Date(s.ends_at) <= now);

  // Today's totals.
  const t = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const s of sessions) for (const r of s.records) t[r.status]++;
  const rateToday = attendanceRate(t);

  // Baseline: the last 7 days that had classes.
  const schoolDays = daily.filter((d) => d.present + d.late + d.absent + d.excused > 0);
  const last7 = schoolDays.slice(-7);
  const sum7 = last7.reduce(
    (a, d) => ({ present: a.present + d.present, late: a.late + d.late, absent: a.absent + d.absent }),
    { present: 0, late: 0, absent: 0 },
  );
  const rate7 = attendanceRate(sum7);
  const avgLate = last7.length ? sum7.late / last7.length : null;
  const avgAbsent = last7.length ? sum7.absent / last7.length : null;

  // Check-ins per hour today (school time).
  const checkins = sessions.flatMap((s) => s.records).filter((r) => r.checked_in_at && (r.status === "present" || r.status === "late"));
  const hours = sessions.length
    ? {
        min: Math.min(...sessions.map((s) => hourInZone(s.starts_at, tz))) - 1,
        max: Math.max(...sessions.map((s) => hourInZone(s.ends_at, tz))),
      }
    : { min: 6, max: 14 };
  const hourBars = [];
  for (let h = Math.max(0, hours.min); h <= Math.min(23, hours.max); h++) {
    const inHour = checkins.filter((r) => hourInZone(r.checked_in_at!, tz) === h);
    const p = inHour.filter((r) => r.status === "present").length;
    const l = inHour.length - p;
    hourBars.push({
      label: `${h}:00`,
      title: `${h}:00 — ${p} a tiempo, ${l} tarde`,
      segments: [
        { value: p, color: CHART_COLORS.primary },
        { value: l, color: CHART_COLORS.orange },
      ],
    });
  }

  // Students (last 30 days).
  const students = (studentsRes.data ?? []) as StudentSummary[];
  const topLate = students
    .filter((s) => Number(s.late) > 0)
    .sort((a, b) => Number(b.late) - Number(a.late) || a.last_name.localeCompare(b.last_name))
    .slice(0, 5);
  const atRisk = students.filter((s) => s.attendance_rate !== null && Number(s.attendance_rate) < 75 && Number(s.total) >= 3);

  // Alerts computed from real data.
  const readers = (devicesRes.data ?? []).filter((d) => d.kind === "reader");
  const staleReaders = readers.filter(
    (d) => d.status === "active" && (!d.last_seen_at || now.getTime() - new Date(d.last_seen_at).getTime() > 24 * 3600_000),
  );
  const disabledReaders = readers.filter((d) => d.status === "disabled");
  const withoutCard = Math.max(0, count("students") - count("nfc_credentials"));
  const noTeacher = (classesRes.data ?? []).filter((c) => c.teachers.length === 0);
  const noSchedule = (classesRes.data ?? []).filter((c) => c.schedules.length === 0);
  const alerts: { tone: "danger" | "warning" | "info"; text: string; href: string }[] = [];
  if (atRisk.length)
    alerts.push({
      tone: "danger",
      text: `${atRisk.length} estudiante${atRisk.length === 1 ? "" : "s"} con asistencia menor al 75% en los últimos 30 días`,
      href: `${base}/students?risk=risk`,
    });
  if (disabledReaders.length)
    alerts.push({ tone: "warning", text: `${disabledReaders.length} lector(es) NFC desactivado(s)`, href: `${base}/devices` });
  if (staleReaders.length)
    alerts.push({ tone: "warning", text: `${staleReaders.length} lector(es) NFC sin conexión en 24 h`, href: `${base}/devices` });
  if (noTeacher.length)
    alerts.push({ tone: "warning", text: `${noTeacher.length} clase(s) sin docente asignado`, href: `${base}/classes` });
  if (withoutCard > 0)
    alerts.push({ tone: "info", text: `${withoutCard} estudiante(s) activos sin tarjeta NFC`, href: `${base}/students?card=none` });
  if (noSchedule.length)
    alerts.push({ tone: "info", text: `${noSchedule.length} clase(s) sin horario semanal`, href: `${base}/classes` });

  const setupSteps = [
    { done: count("teachers") > 0 && count("students") > 0, text: "Agrega docentes y estudiantes", href: `${base}/students` },
    { done: count("class_sections") > 0, text: "Crea cursos y clases con su horario semanal", href: `${base}/classes` },
    { done: noTeacher.length === 0 && count("class_sections") > 0, text: "Asigna un docente a cada clase e inscribe a sus estudiantes", href: `${base}/classes` },
    { done: count("nfc_credentials") > 0, text: "Entrega una tarjeta NFC a cada estudiante", href: `${base}/students` },
    { done: false, optional: true, text: "Revisa las reglas de asistencia (a tiempo / tarde / ausente)", href: `${base}/rules` },
  ];
  const setupIncomplete = setupSteps.some((s) => !s.done && !s.optional);

  const name = firstName(profile?.full_name, access.user.email);
  const trendLabels = schoolDays.map((d) => d.label);
  const trendValues = schoolDays.map((d) => attendanceRate(d));

  return (
    <div className="stack-lg">
      <header className="page-header">
        <div>
          <h1>
            Hola{name ? `, ${name}` : ""} <span aria-hidden="true">👋</span>
          </h1>
          <p>
            {greeting(hourInZone(now, tz))}. Aquí tienes un resumen de hoy · {fmtLongDate(now, tz)}
          </p>
        </div>
        <div className="page-actions">
          <Link className="button secondary" href={`${base}/attendance`}>
            <TrendingUp size={16} /> Analytics
          </Link>
          <Link className="button" href={`${base}/simulator`}>
            <Nfc size={16} /> Tomar asistencia
          </Link>
        </div>
      </header>

      <section className="grid-kpi">
        <KpiCard
          icon={CircleCheck}
          tone="green"
          value={rateToday === null ? "—" : fmtRate(rateToday).replace("%", "")}
          suffix={rateToday === null ? undefined : "%"}
          label="Asistencia hoy"
          trend={rateToday !== null && rate7 !== null ? { delta: rateToday - rate7, unit: " pts", goodWhen: "up" } : null}
          foot={rate7 !== null ? `Promedio 7 días: ${fmtRate(rate7)}` : "Sin datos previos"}
        />
        <KpiCard
          icon={Clock}
          tone="orange"
          value={t.late}
          label="Llegadas tarde"
          trend={avgLate !== null ? { delta: t.late - avgLate, goodWhen: "down" } : null}
          foot={avgLate !== null ? `Promedio diario: ${avgLate.toFixed(1)}` : "Hoy"}
        />
        <KpiCard
          icon={UserX}
          tone="red"
          value={t.absent}
          label="Ausencias"
          trend={avgAbsent !== null ? { delta: t.absent - avgAbsent, goodWhen: "down" } : null}
          foot={avgAbsent !== null ? `Promedio diario: ${avgAbsent.toFixed(1)}` : "Se registran al cierre de cada clase"}
        />
        <KpiCard
          icon={BookOpen}
          tone="blue"
          value={sessions.filter((s) => s.status !== "cancelled").length}
          label="Clases hoy"
          foot={`${live.length} en curso · ${finished.length} finalizadas`}
        />
      </section>

      {setupIncomplete && (
        <Card title="Configura tu colegio" subtitle="Completa estos pasos para empezar a registrar asistencia con NFC.">
          <ul className="list">
            {setupSteps.map((s) => (
              <li key={s.text} className="list-item">
                {s.done ? (
                  <CheckCircle2 size={20} color="var(--success)" />
                ) : (
                  <CircleDashed size={20} color="var(--muted)" />
                )}
                <Link href={s.href} className={`grow ${s.done ? "muted" : "cell-title"}`} style={s.done ? { textDecoration: "line-through" } : undefined}>
                  {s.text}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid-main">
        <Card
          title="Asistencia por hora"
          subtitle="Registros NFC de hoy según la hora de llegada"
          action={
            <Legend
              items={[
                { label: "A tiempo", color: CHART_COLORS.primary },
                { label: "Tarde", color: CHART_COLORS.orange },
              ]}
            />
          }
        >
          {checkins.length === 0 ? (
            <EmptyState icon={Nfc} title="Aún no hay registros hoy" compact>
              Las llegadas aparecerán aquí en cuanto los estudiantes acerquen su tarjeta.
            </EmptyState>
          ) : (
            <BarChart data={hourBars} height={230} />
          )}
        </Card>

        <Card title="Clases en curso" subtitle={live.length ? `${live.length} ahora mismo` : "Ninguna en este momento"} link={{ href: `${base}/classes`, label: "Ver clases" }}>
          {live.length === 0 && upcoming.length === 0 ? (
            <EmptyState icon={BookOpen} title="No hay más clases hoy" compact />
          ) : (
            <div className="stack-sm">
              {(live.length ? live : upcoming.slice(0, 3)).map((s) => {
                const c = { present: 0, late: 0, absent: 0, excused: 0 };
                for (const r of s.records) c[r.status]++;
                const teacher = s.class.teachers[0]?.teacher;
                const isLive = live.includes(s);
                return (
                  <Link key={s.id} href={`/s/${schoolSlug}/sessions/${s.id}`} className={`session-card${isLive ? " live" : ""}`}>
                    <div className="row-between">
                      <div className="grow">
                        <div className="cell-title truncate">{s.class.name}</div>
                        <div className="cell-sub truncate">
                          {teacher ? `${teacher.first_name} ${teacher.last_name}` : "Sin docente"}
                          {(s.room ?? s.class.room) && ` · Salón ${s.room ?? s.class.room}`}
                        </div>
                      </div>
                      {isLive ? (
                        <Badge tone="success">
                          <span className="live-dot" /> En vivo
                        </Badge>
                      ) : (
                        <span className="time-pill">{fmtTime(s.starts_at, tz)}</span>
                      )}
                    </div>
                    <StatusBar {...c} />
                    <div className="stat-row">
                      <span>
                        <b>{c.present}</b> presentes
                      </span>
                      <span>
                        <b>{c.late}</b> tarde
                      </span>
                      <span className="nowrap">
                        {fmtTime(s.starts_at, tz)} – {fmtTime(s.ends_at, tz)}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {!live.length && <p className="hint">Próximas clases de hoy</p>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Actividad reciente" link={{ href: `${base}/simulator`, label: "Ver todo" }}>
          {(scansRes.data ?? []).length === 0 ? (
            <EmptyState icon={RadioTower} title="Sin actividad todavía" compact />
          ) : (
            <ul className="list">
              {(scansRes.data ?? []).map((s) => {
                const st = s.response?.attendance?.status;
                const ok = s.outcome === "recorded";
                const dup = s.outcome === "duplicate";
                const tone = ok ? (st === "late" ? "tone-orange" : "tone-green") : dup ? "tone-gray" : "tone-red";
                const Icon = ok ? (st === "late" ? Clock : CheckCircle2) : dup ? CreditCard : XCircle;
                return (
                  <li key={s.id} className="list-item">
                    <span className={`feed-icon ${tone}`}>
                      <Icon size={16} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="cell-title truncate" style={{ fontSize: "0.85rem" }}>
                        {s.student ? `${s.student.first_name} ${s.student.last_name}` : "Tarjeta desconocida"}
                      </div>
                      <div className="cell-sub truncate">
                        {ok
                          ? `${st === "late" ? "Llegó tarde" : "Asistencia registrada"}${s.response?.attendance?.class_name ? ` · ${s.response.attendance.class_name}` : ""}`
                          : dup
                            ? "Toque repetido (ignorado)"
                            : (s.response?.message ?? s.outcome.replaceAll("_", " "))}
                      </div>
                    </div>
                    <span className="feed-time">{fmtTime(s.effective_at, tz)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Más tardanzas" subtitle="Últimos 30 días" link={{ href: `${base}/attendance`, label: "Analytics" }}>
          {topLate.length === 0 ? (
            <EmptyState icon={Clock} title="Sin tardanzas" compact>
              Nadie ha llegado tarde en los últimos 30 días.
            </EmptyState>
          ) : (
            <ul className="list">
              {topLate.map((s, i) => (
                <li key={s.student_id} className="list-item">
                  <span className="rank">{i + 1}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <Person
                      first={s.first_name}
                      last={s.last_name}
                      id={s.student_id}
                      size="sm"
                      sub={s.student_number}
                      href={`${base}/students/${s.student_id}`}
                    />
                  </div>
                  <Badge tone="warning">{s.late} tardes</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Alertas importantes" id="alertas">
          {alerts.length === 0 ? (
            <div className="callout success">
              <CheckCircle2 size={18} />
              <p>Todo en orden. No hay alertas en este momento.</p>
            </div>
          ) : (
            <div className="stack-sm">
              {alerts.map((a) => (
                <Link key={a.text} href={a.href} className={`callout ${a.tone}`}>
                  {a.tone === "danger" ? <AlertTriangle size={17} /> : a.tone === "warning" ? <RadioTower size={17} /> : <CreditCard size={17} />}
                  <p>{a.text}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-main">
        <Card
          title="Tendencia de asistencia"
          subtitle="Últimos 14 días (solo días con clases)"
          action={<Legend items={[{ label: "Tasa de asistencia", color: CHART_COLORS.primary }]} />}
        >
          {schoolDays.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Aún no hay historial" compact>
              La tendencia aparecerá cuando haya asistencia registrada en días anteriores.
            </EmptyState>
          ) : (
            <LineChart
              labels={trendLabels}
              series={[{ name: "Asistencia", color: CHART_COLORS.primary, values: trendValues, area: true }]}
              min={Math.max(0, Math.floor((Math.min(...trendValues.filter((v): v is number => v !== null)) - 10) / 10) * 10)}
              height={220}
            />
          )}
        </Card>

        <Card title="Reportes recientes" link={{ href: `/s/${schoolSlug}/reports`, label: "Reportes" }}>
          <EmptyState icon={ClipboardList} title="Módulo de reportes en preparación" compact>
            Aquí verás los últimos reportes de disciplina, académicos y de asistencia en cuanto se active el módulo.
          </EmptyState>
        </Card>
      </div>

      <section className="grid">
        {counts.map(({ label, count: n, table }) => (
          <Link key={table} href={table === "class_sections" ? `${base}/classes` : table === "teachers" ? `${base}/teachers` : `${base}/students`} className="card card-hover">
            <div className="kpi-label" style={{ marginTop: 0 }}>
              {label}
            </div>
            <div className="kpi-value" style={{ marginTop: "0.4rem", color: "var(--text)" }}>
              {n}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
