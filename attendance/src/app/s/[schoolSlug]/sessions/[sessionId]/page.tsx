import { CheckCircle2, Clock, History, Pencil, UserX, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { hasRole } from "@/lib/auth/roles";
import { localDateKey } from "@/lib/time";
import { fmtLongDate, fmtTime, SOURCE_LABEL } from "@/lib/ui/format";
import { correctAttendance } from "@/server/attendance/corrections";
import { requireSchoolAccess } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { LiveRefresh } from "./live-refresh";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBar } from "@/components/ui/rate";
import { Badge, StatusBadge } from "@/components/ui/status-badge";

type Status = "present" | "late" | "absent" | "excused";
type Rule = { early_checkin_minutes: number; late_after_minutes: number; absent_after_minutes: number };
type SessionRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  room: string | null;
  finalized_at: string | null;
  rule_snapshot: Rule | null;
  class: { id: string; name: string; room: string | null };
};
type Person = { id: string; student_number: string; first_name: string; last_name: string };
type RecordRow = {
  id: string;
  status: Status;
  source: "nfc" | "manual" | "system";
  checked_in_at: string | null;
  note: string | null;
  version: number;
  student: Person;
};
type AuditRow = {
  id: string;
  created_at: string;
  actor_type: "user" | "device" | "system";
  actor_user_id: string | null;
  entity_id: string;
  before: { status?: Status } | null;
  after: { status?: Status; student_id?: string } | null;
  reason: string | null;
};

const STATUS_LABEL: Record<Status, string> = { present: "Presente", late: "Tarde", absent: "Ausente", excused: "Excusado" };

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000);
}

export default async function SessionPage({ params }: PageProps<"/s/[schoolSlug]/sessions/[sessionId]">) {
  const { schoolSlug, sessionId } = await params;
  const access = await requireSchoolAccess(schoolSlug);
  const isAdmin = hasRole(access, "school_admin");
  if (!isAdmin && !hasRole(access, "teacher")) notFound();

  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;

  // RLS only returns sessions of classes this teacher teaches (or any, for admins).
  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, status, room, finalized_at, rule_snapshot, class:class_sections!inner(id, name, room)")
    .eq("school_id", schoolId)
    .eq("id", sessionId)
    .returns<SessionRow[]>()
    .maybeSingle();
  if (!session) notFound();

  const day = localDateKey(new Date(session.starts_at), tz);
  const [{ data: rule }, { data: enrollments }, { data: records }] = await Promise.all([
    session.rule_snapshot
      ? Promise.resolve({ data: session.rule_snapshot })
      : supabase
          .from("attendance_rules")
          .select("early_checkin_minutes, late_after_minutes, absent_after_minutes")
          .eq("school_id", schoolId)
          .eq("is_default", true)
          .returns<Rule[]>()
          .maybeSingle(),
    supabase
      .from("enrollments")
      .select("student:students!inner(id, student_number, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_section_id", session.class.id)
      .lte("enrolled_on", day)
      .or(`withdrawn_on.is.null,withdrawn_on.gt.${day}`)
      .returns<{ student: Person }[]>(),
    supabase
      .from("attendance_records")
      .select("id, status, source, checked_in_at, note, version, student:students!inner(id, student_number, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_session_id", session.id)
      .returns<RecordRow[]>(),
  ]);

  const recordByStudent = new Map((records ?? []).map((r) => [r.student.id, r]));
  const students = new Map<string, Person>();
  for (const e of enrollments ?? []) students.set(e.student.id, e.student);
  for (const r of records ?? []) students.set(r.student.id, r.student);
  const roster = [...students.values()].sort(
    (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
  );

  const recordIds = (records ?? []).map((r) => r.id);
  const { data: audit } = recordIds.length
    ? await supabase
        .from("audit_logs")
        .select("id, created_at, actor_type, actor_user_id, entity_id, before, after, reason")
        .eq("school_id", schoolId)
        .eq("entity_type", "attendance_records")
        .in("entity_id", recordIds)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<AuditRow[]>()
    : { data: [] as AuditRow[] };

  // Names of staff who made changes (admins can read them; others see "you"/"staff").
  const actorIds = [...new Set((audit ?? []).map((a) => a.actor_user_id).filter((id): id is string => !!id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] as { id: string; full_name: string; email: string | null }[] };
  const actorName = (a: AuditRow) => {
    if (a.actor_type === "device") return "Lector NFC";
    if (a.actor_type === "system") return "Automático";
    if (a.actor_user_id === access.user.id) return "Tú";
    const p = (actors ?? []).find((x) => x.id === a.actor_user_id);
    return p?.full_name || p?.email || "Personal del colegio";
  };
  const recordStudent = new Map((records ?? []).map((r) => [r.id, r.student]));

  const counts = { present: 0, late: 0, absent: 0, excused: 0, pending: 0 };
  for (const s of roster) {
    const r = recordByStudent.get(s.id);
    if (r) counts[r.status]++;
    else counts.pending++;
  }
  const backHref = isAdmin ? `/s/${schoolSlug}/admin/classes/${session.class.id}` : `/s/${schoolSlug}/teacher`;
  const room = session.room ?? session.class.room;

  return (
    <div className="stack-lg">
      <PageHeader
        back={{ href: backHref, label: isAdmin ? "Clase" : "Mis clases" }}
        title={session.class.name}
        subtitle={`${fmtLongDate(session.starts_at, tz)} · ${fmtTime(session.starts_at, tz)} – ${fmtTime(session.ends_at, tz)}${room ? ` · Salón ${room}` : ""}`}
        actions={session.status === "cancelled" ? <Badge tone="danger">Cancelada</Badge> : <LiveRefresh sessionId={session.id} />}
      />

      {rule && (
        <div className="callout info">
          <Clock size={17} />
          <p>
            A tiempo hasta las <strong>{fmtTime(addMinutes(session.starts_at, rule.late_after_minutes), tz)}</strong> · tarde hasta las{" "}
            <strong>{fmtTime(addMinutes(session.starts_at, rule.absent_after_minutes), tz)}</strong>
            {session.finalized_at ? " · ausencias ya registradas" : " · después, quienes no hayan registrado lectura quedan ausentes"}
          </p>
        </div>
      )}

      <section className="grid-kpi">
        <KpiCard icon={CheckCircle2} tone="green" value={counts.present} label="Presentes" />
        <KpiCard icon={Clock} tone="orange" value={counts.late} label="Tarde" />
        <KpiCard icon={UserX} tone="red" value={counts.absent} label="Ausentes" foot={counts.excused ? `${counts.excused} excusados` : undefined} />
        <KpiCard icon={Users} tone="gray" value={counts.pending} label="Sin registrar" foot={`de ${roster.length} estudiantes`} />
      </section>

      <div className="grid-main">
        <Card title={`Estudiantes (${roster.length})`} action={<div style={{ width: 160 }}><StatusBar {...counts} /></div>}>
          {roster.length === 0 ? (
            <EmptyState icon={Users} title="No hay estudiantes inscritos en esta clase" compact />
          ) : (
            <ul className="list">
              {roster.map((s) => {
                const r = recordByStudent.get(s.id);
                return (
                  <li key={s.id} className="list-item" style={{ flexWrap: "wrap" }}>
                    <div className="grow" style={{ minWidth: 180 }}>
                      <Person
                        first={s.first_name}
                        last={s.last_name}
                        id={s.id}
                        size="sm"
                        sub={
                          r
                            ? `${r.checked_in_at ? `Llegó ${fmtTime(r.checked_in_at, tz)} · ` : ""}${SOURCE_LABEL[r.source]}${r.source === "manual" && r.note ? `: ${r.note}` : ""}`
                            : s.student_number
                        }
                      />
                    </div>
                    <StatusBadge status={r?.status} />
                    <details className="popover">
                      <summary className="button ghost small" aria-label={`Cambiar asistencia de ${s.first_name}`}>
                        <Pencil size={14} /> Cambiar
                      </summary>
                      <div className="popover-panel">
                        <ActionForm action={correctAttendance} submitLabel="Guardar" className="stack-sm small">
                          <SchoolSlugInput slug={schoolSlug} />
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="studentId" value={s.id} />
                          {r && <input type="hidden" name="expectedVersion" value={r.version} />}
                          <label>
                            Nuevo estado
                            <select name="status" defaultValue={r?.status ?? "present"}>
                              <option value="present">Presente</option>
                              <option value="late">Tarde</option>
                              <option value="absent">Ausente</option>
                              <option value="excused">Excusado</option>
                            </select>
                          </label>
                          <label>
                            Motivo
                            <input name="reason" required minLength={3} maxLength={500} placeholder="Obligatorio" />
                          </label>
                        </ActionForm>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Historial" subtitle="Cada cambio queda auditado">
          {(audit ?? []).length === 0 ? (
            <EmptyState icon={History} title="Aún no hay asistencia registrada" compact />
          ) : (
            <ul className="list">
              {(audit ?? []).map((a) => {
                const st = recordStudent.get(a.entity_id);
                const from = a.before?.status;
                const to = a.after?.status;
                return (
                  <li key={a.id} className="list-item" style={{ alignItems: "flex-start" }}>
                    <span className={`feed-icon ${a.actor_type === "user" ? "tone-violet" : a.actor_type === "device" ? "tone-blue" : "tone-gray"}`}>
                      {a.actor_type === "user" ? <Pencil size={14} /> : <CheckCircle2 size={15} />}
                    </span>
                    <div className="grow small-text" style={{ minWidth: 0 }}>
                      <div>
                        <strong>{st ? `${st.first_name} ${st.last_name}` : "Estudiante"}</strong>:{" "}
                        {from && to && from !== to ? (
                          <>
                            {STATUS_LABEL[from]} → {STATUS_LABEL[to]}
                          </>
                        ) : (
                          to && STATUS_LABEL[to]
                        )}
                      </div>
                      <div className="cell-sub">
                        por {actorName(a)}
                        {a.reason && a.actor_type === "user" ? ` — “${a.reason}”` : ""}
                      </div>
                    </div>
                    <span className="feed-time">{fmtTime(a.created_at, tz)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
