import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  CreditCard,
  GraduationCap,
  Hash,
  NotebookPen,
  Pencil,
  UserX,
  XCircle,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { formatUid } from "@/lib/nfc/uid";
import { addDays } from "@/lib/reports/filters";
import { localDateKey } from "@/lib/time";
import {
  attendanceRate,
  fmtDate,
  fmtRate,
  fmtShortDate,
  fmtTime,
  RISK_LABEL,
  riskLevel,
  SOURCE_LABEL,
  STATUS_LABEL,
  STUDENT_STATUS_LABEL,
} from "@/lib/ui/format";
import { OUTCOME_LABEL, outcomeTone, type ScanOutcome } from "@/lib/ui/scan";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { assignCard, revokeCard, updateStudent } from "@/server/admin/students";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, Donut } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";

type Status = "present" | "late" | "absent" | "excused";
type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  status: string;
};
type CardRow = { id: string; uid_normalized: string; label: string | null; status: string; issued_at: string; revoked_at: string | null };
type Enrollment = { id: string; enrolled_on: string; withdrawn_on: string | null; class: { id: string; name: string } };
type RecordRow = {
  id: string;
  status: Status;
  source: "nfc" | "manual" | "system";
  checked_in_at: string | null;
  note: string | null;
  session: { id: string; starts_at: string; class: { name: string } };
};
type ScanRow = {
  id: string;
  effective_at: string;
  outcome: ScanOutcome;
  device: { name: string; kind: string };
  response: { attendance?: { class_name?: string; status?: Status } | null } | null;
};

const TABS = ["resumen", "asistencia", "reportes", "notas", "actividad"] as const;
type Tab = (typeof TABS)[number];
const RISK_TONE = { ok: "success", watch: "warning", risk: "danger", none: "neutral" } as const;

export default async function StudentPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/admin/students/[studentId]">) {
  const { schoolSlug, studentId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "resumen";
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;
  const schoolId = access.school.id;

  const { data: student } = await supabase
    .from("students")
    .select("id, student_number, first_name, last_name, grade_level, status")
    .eq("school_id", schoolId)
    .eq("id", studentId)
    .returns<Student[]>()
    .maybeSingle();
  if (!student) notFound();

  const [{ data: cards }, { data: enrollments }, { data: records }, { data: scans }] = await Promise.all([
    supabase
      .from("nfc_credentials")
      .select("id, uid_normalized, label, status, issued_at, revoked_at")
      .eq("school_id", schoolId)
      .eq("student_id", student.id)
      .order("issued_at", { ascending: false })
      .returns<CardRow[]>(),
    supabase
      .from("enrollments")
      .select("id, enrolled_on, withdrawn_on, class:class_sections!inner(id, name)")
      .eq("school_id", schoolId)
      .eq("student_id", student.id)
      .order("enrolled_on", { ascending: false })
      .returns<Enrollment[]>(),
    supabase
      .from("attendance_records")
      .select("id, status, source, checked_in_at, note, session:class_sessions!inner(id, starts_at, class:class_sections!inner(name))")
      .eq("school_id", schoolId)
      .eq("student_id", student.id)
      .order("session(starts_at)", { ascending: false })
      .limit(300)
      .returns<RecordRow[]>(),
    supabase
      .from("scan_events")
      .select("id, effective_at, outcome, response, device:devices!inner(name, kind)")
      .eq("school_id", schoolId)
      .eq("student_id", student.id)
      .order("received_at", { ascending: false })
      .limit(25)
      .returns<ScanRow[]>(),
  ]);

  const all = records ?? [];
  const since = addDays(localDateKey(new Date(), tz), -29);
  const recent = all.filter((r) => localDateKey(new Date(r.session.starts_at), tz) >= since);
  const tally = (rows: RecordRow[]) => {
    const c = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  };
  const c30 = tally(recent);
  const cAll = tally(all);
  const rate30 = attendanceRate(c30);
  const rateAll = attendanceRate(cAll);
  const risk = riskLevel(rate30, c30.late);
  const activeCard = (cards ?? []).find((c) => c.status === "active");
  const current = (enrollments ?? []).filter((e) => !e.withdrawn_on);
  const base = `/s/${schoolSlug}/admin`;
  const self = `${base}/students/${student.id}`;

  return (
    <div className="stack-lg">
      <PageHeader title="Perfil del estudiante" back={{ href: `${base}/students`, label: "Estudiantes" }} />

      <section className="card stack">
        <div className="profile-hero">
          <Avatar first={student.first_name} last={student.last_name} id={student.id} size="xl" />
          <div className="grow" style={{ minWidth: 220 }}>
            <div className="inline">
              <h1>
                {student.first_name} {student.last_name}
              </h1>
              <Badge tone={student.status === "active" ? "success" : "neutral"}>{STUDENT_STATUS_LABEL[student.status] ?? student.status}</Badge>
              <Badge tone={RISK_TONE[risk]} dot={risk !== "none"}>
                {RISK_LABEL[risk]}
              </Badge>
            </div>
            <div className="meta-row">
              <span>
                <Hash size={14} /> {student.student_number}
              </span>
              <span>
                <GraduationCap size={14} /> Grado {student.grade_level ?? "—"}
              </span>
              <span>
                <BookOpen size={14} /> {current.length ? current.map((e) => e.class.name).join(", ") : "Sin clases"}
              </span>
              <span>
                <CreditCard size={14} /> {activeCard ? <span className="mono">{formatUid(activeCard.uid_normalized)}</span> : "Sin tarjeta NFC"}
              </span>
            </div>
          </div>
          <Link className="button secondary" href={`${base}/attendance?student=${student.id}`}>
            <BarChart3 size={16} /> Ver en Analytics
          </Link>
        </div>
        <div className="mini-stats">
          <div className="mini-stat">
            <div className="v" style={{ color: rate30 === null ? undefined : rate30 >= 90 ? "var(--success)" : rate30 >= 75 ? "var(--warning)" : "var(--danger)" }}>
              {fmtRate(rate30)}
            </div>
            <div className="l">Asistencia (30 días)</div>
          </div>
          <div className="mini-stat">
            <div className="v">{c30.late}</div>
            <div className="l">Tardanzas (30 días)</div>
          </div>
          <div className="mini-stat">
            <div className="v">{c30.absent}</div>
            <div className="l">Ausencias (30 días)</div>
          </div>
          <div className="mini-stat">
            <div className="v muted">—</div>
            <div className="l">Reportes</div>
          </div>
        </div>
      </section>

      <Tabs
        label="Secciones del perfil"
        active={tab}
        items={[
          { key: "resumen", label: "Resumen", href: self },
          { key: "asistencia", label: "Asistencia", href: `${self}?tab=asistencia`, count: all.length },
          { key: "reportes", label: "Reportes", href: `${self}?tab=reportes` },
          { key: "notas", label: "Notas", href: `${self}?tab=notas` },
          { key: "actividad", label: "Actividad", href: `${self}?tab=actividad` },
        ]}
      />

      {tab === "resumen" && (
        <div className="grid-side">
          <div className="stack">
            <Card title="Asistencia" subtitle="Histórico completo">
              <div className="donut-wrap">
                <Donut
                  size={132}
                  center={fmtRate(rateAll)}
                  sub="asistencia"
                  segments={[
                    { value: cAll.present, color: CHART_COLORS.green, label: "Presente" },
                    { value: cAll.late, color: CHART_COLORS.orange, label: "Tarde" },
                    { value: cAll.absent, color: CHART_COLORS.red, label: "Ausente" },
                    { value: cAll.excused, color: CHART_COLORS.violet, label: "Excusado" },
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
                      <strong>{cAll[k]}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Tarjeta NFC">
              {activeCard ? (
                <div className="stack">
                  <div className="row">
                    <span className="kpi-icon tone-blue">
                      <CreditCard size={19} />
                    </span>
                    <div>
                      <div className="mono cell-title">{formatUid(activeCard.uid_normalized)}</div>
                      <div className="cell-sub">
                        {activeCard.label ? `${activeCard.label} · ` : ""}Entregada {fmtShortDate(activeCard.issued_at, tz)}
                      </div>
                    </div>
                  </div>
                  <div className="inline">
                    <ActionForm
                      action={revokeCard}
                      submitLabel="Marcar como perdida"
                      variant="secondary"
                      className="inline small"
                      confirmText="¿Marcar esta tarjeta como perdida? Dejará de funcionar de inmediato."
                      confirmLabel="Marcar perdida"
                      quiet
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="cardId" value={activeCard.id} />
                      <input type="hidden" name="status" value="lost" />
                    </ActionForm>
                    <ActionForm
                      action={revokeCard}
                      submitLabel="Revocar"
                      variant="secondary"
                      className="inline small"
                      confirmText="¿Revocar esta tarjeta? Dejará de funcionar de inmediato."
                      confirmLabel="Revocar"
                      quiet
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="cardId" value={activeCard.id} />
                      <input type="hidden" name="status" value="revoked" />
                    </ActionForm>
                  </div>
                </div>
              ) : (
                <ActionForm action={assignCard} submitLabel="Asignar tarjeta" resetOnSuccess>
                  <SchoolSlugInput slug={schoolSlug} />
                  <input type="hidden" name="studentId" value={student.id} />
                  <label>
                    UID de la tarjeta
                    <input
                      name="uid"
                      required
                      maxLength={64}
                      placeholder="04:A2:2B:1C:9F:5E:80"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      className="mono"
                    />
                  </label>
                  <label>
                    Etiqueta (opcional)
                    <input name="label" maxLength={64} placeholder="Ej. Tarjeta azul #12" />
                  </label>
                  <p className="hint">El UID viene impreso en la tarjeta o lo muestra cualquier app lectora NFC. Los dos puntos y espacios son opcionales.</p>
                </ActionForm>
              )}
              {(cards ?? []).some((c) => c.status !== "active") && (
                <details className="disclosure" style={{ marginTop: "1rem" }}>
                  <summary>
                    Tarjetas anteriores <ChevronDown size={16} className="chev" />
                  </summary>
                  <div className="disclosure-body">
                    <ul className="list">
                      {(cards ?? [])
                        .filter((c) => c.status !== "active")
                        .map((c) => (
                          <li key={c.id} className="list-item small-text">
                            <span className="mono grow">{formatUid(c.uid_normalized)}</span>
                            <Badge>{c.status === "lost" ? "Perdida" : "Revocada"}</Badge>
                            {c.revoked_at && <span className="muted">{fmtShortDate(c.revoked_at, tz)}</span>}
                          </li>
                        ))}
                    </ul>
                  </div>
                </details>
              )}
            </Card>

            <Card title="Clases">
              {(enrollments ?? []).length === 0 ? (
                <EmptyState icon={BookOpen} title="Sin clases" compact>
                  Inscribe estudiantes desde la página de cada clase.
                </EmptyState>
              ) : (
                <ul className="list">
                  {(enrollments ?? []).map((e) => (
                    <li key={e.id} className="list-item">
                      <span className="feed-icon tone-blue">
                        <BookOpen size={15} />
                      </span>
                      <div className="grow">
                        <Link className="cell-title" href={`${base}/classes/${e.class.id}`}>
                          {e.class.name}
                        </Link>
                        <div className="cell-sub">
                          Desde {e.enrolled_on}
                          {e.withdrawn_on && ` · retirado ${e.withdrawn_on}`}
                        </div>
                      </div>
                      {e.withdrawn_on && <Badge>Retirado</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="stack">
            <Card title="Actividad reciente" link={{ href: `${self}?tab=asistencia`, label: "Ver todo" }}>
              {all.length === 0 ? (
                <EmptyState icon={Clock} title="Sin asistencia registrada" compact />
              ) : (
                <ul className="list">
                  {all.slice(0, 8).map((r) => (
                    <RecordItem key={r.id} r={r} tz={tz} schoolSlug={schoolSlug} />
                  ))}
                </ul>
              )}
            </Card>

            <details className="disclosure card" style={{ padding: 0 }}>
              <summary>
                <span className="kpi-icon tone-gray" style={{ width: 32, height: 32, borderRadius: 9 }}>
                  <Pencil size={15} />
                </span>
                Editar información
                <ChevronDown size={18} className="chev" />
              </summary>
              <div className="disclosure-body">
                <ActionForm action={updateStudent} submitLabel="Guardar cambios">
                  <SchoolSlugInput slug={schoolSlug} />
                  <input type="hidden" name="studentId" value={student.id} />
                  <div className="form-grid">
                    <label>
                      Código / ID
                      <input name="student_number" defaultValue={student.student_number} required maxLength={64} />
                    </label>
                    <label>
                      Nombres
                      <input name="first_name" defaultValue={student.first_name} required maxLength={100} />
                    </label>
                    <label>
                      Apellidos
                      <input name="last_name" defaultValue={student.last_name} required maxLength={100} />
                    </label>
                    <label>
                      Grado
                      <input name="grade_level" defaultValue={student.grade_level ?? ""} maxLength={32} />
                    </label>
                    <label>
                      Estado
                      <select name="status" defaultValue={student.status}>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                        <option value="graduated">Graduado</option>
                        <option value="withdrawn">Retirado</option>
                      </select>
                    </label>
                  </div>
                </ActionForm>
              </div>
            </details>
          </div>
        </div>
      )}

      {tab === "asistencia" && (
        <Card
          title="Historial de asistencia"
          subtitle={`${all.length} registros${all.length === 300 ? " (últimos 300)" : ""}`}
          link={{ href: `${base}/attendance?student=${student.id}`, label: "Filtrar y exportar CSV" }}
        >
          {all.length === 0 ? (
            <EmptyState icon={Clock} title="Sin asistencia registrada" compact />
          ) : (
            <div className="table-wrap">
              <table className="stack-mobile">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Clase</th>
                    <th>Estado</th>
                    <th>Llegada</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link className="cell-title" href={`/s/${schoolSlug}/sessions/${r.session.id}`}>
                          {fmtDate(r.session.starts_at, tz)}
                        </Link>
                        <div className="cell-sub">{fmtTime(r.session.starts_at, tz)}</div>
                      </td>
                      <td data-label="Clase">{r.session.class.name}</td>
                      <td data-label="Estado">
                        <StatusBadge status={r.status} />
                      </td>
                      <td data-label="Llegada">{r.checked_in_at ? fmtTime(r.checked_in_at, tz) : <span className="muted">—</span>}</td>
                      <td data-label="Origen" className="text-2 small-text">
                        {SOURCE_LABEL[r.source]}
                        {r.source === "manual" && r.note ? `: ${r.note}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "reportes" && (
        <Card>
          <EmptyState icon={ClipboardList} title="Reportes del estudiante" action={<Link className="button secondary" href={`/s/${schoolSlug}/reports`}>Conocer el módulo</Link>}>
            El módulo de reportes (disciplina, académico, asistencia) está en preparación. Cuando se active, aquí verás el historial de
            reportes de {student.first_name}.
          </EmptyState>
        </Card>
      )}

      {tab === "notas" && (
        <Card>
          <EmptyState icon={NotebookPen} title="Notas académicas">
            EduTrack todavía no guarda calificaciones. Esta sección mostrará las notas por materia y periodo cuando se integre el
            módulo académico.
          </EmptyState>
        </Card>
      )}

      {tab === "actividad" && (
        <Card title="Lecturas NFC" subtitle="Cada vez que la tarjeta se acercó a un lector">
          {(scans ?? []).length === 0 ? (
            <EmptyState icon={CreditCard} title="Sin lecturas todavía" compact />
          ) : (
            <ul className="list">
              {(scans ?? []).map((s) => {
                const tone = outcomeTone(s.outcome);
                return (
                  <li key={s.id} className="list-item">
                    <span className={`feed-icon tone-${tone === "success" ? "green" : tone === "warning" ? "orange" : "red"}`}>
                      {tone === "success" ? <CheckCircle2 size={16} /> : tone === "warning" ? <Clock size={16} /> : <XCircle size={16} />}
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="cell-title small-text">
                        {s.outcome === "recorded" && s.response?.attendance?.status
                          ? `${STATUS_LABEL[s.response.attendance.status]}${s.response.attendance.class_name ? ` · ${s.response.attendance.class_name}` : ""}`
                          : OUTCOME_LABEL[s.outcome]}
                      </div>
                      <div className="cell-sub">{s.device.kind === "simulator" ? "Simulador" : s.device.name}</div>
                    </div>
                    <span className="feed-time">
                      {fmtShortDate(s.effective_at, tz)} · {fmtTime(s.effective_at, tz)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function RecordItem({ r, tz, schoolSlug }: { r: RecordRow; tz: string; schoolSlug: string }) {
  const Icon = r.status === "present" ? CheckCircle2 : r.status === "late" ? Clock : r.status === "absent" ? UserX : CheckCircle2;
  const tone = { present: "tone-green", late: "tone-orange", absent: "tone-red", excused: "tone-violet" }[r.status];
  return (
    <li className="list-item">
      <span className={`feed-icon ${tone}`}>
        <Icon size={16} />
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <Link href={`/s/${schoolSlug}/sessions/${r.session.id}`} className="cell-title small-text truncate" style={{ display: "block" }}>
          {r.session.class.name}
        </Link>
        <div className="cell-sub">
          {STATUS_LABEL[r.status]}
          {r.checked_in_at ? ` · llegó ${fmtTime(r.checked_in_at, tz)}` : ""}
        </div>
      </div>
      <span className="feed-time">{fmtShortDate(r.session.starts_at, tz)}</span>
    </li>
  );
}
