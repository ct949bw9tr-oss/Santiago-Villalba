import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { hasRole } from "@/lib/auth/roles";
import { formatLocalDate, formatLocalTime, localDateKey } from "@/lib/time";
import { correctAttendance } from "@/server/attendance/corrections";
import { requireSchoolAccess } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { LiveRefresh } from "./live-refresh";

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

const STATUS_LABEL: Record<Status, string> = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };
const STATUS_COLOR: Record<Status, string> = { present: "#2e7d32", late: "#b26a00", absent: "#b3261e", excused: "#1565c0" };
const SOURCE_LABEL = { nfc: "card", manual: "changed by staff", system: "automatic" } as const;

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
    if (a.actor_type === "device") return "Card reader";
    if (a.actor_type === "system") return "Automatic";
    if (a.actor_user_id === access.user.id) return "You";
    const p = (actors ?? []).find((x) => x.id === a.actor_user_id);
    return p?.full_name || p?.email || "School staff";
  };
  const recordStudent = new Map((records ?? []).map((r) => [r.id, r.student]));

  const counts = { present: 0, late: 0, absent: 0, excused: 0, pending: 0 };
  for (const s of roster) {
    const r = recordByStudent.get(s.id);
    if (r) counts[r.status]++;
    else counts.pending++;
  }
  const backHref = isAdmin ? `/s/${schoolSlug}/admin/classes/${session.class.id}` : `/s/${schoolSlug}/teacher`;

  return (
    <div className="stack">
      <p style={{ margin: 0 }}>
        <Link href={backHref}>← Back</Link>
      </p>
      <div className="section-head">
        <div>
          <h1>{session.class.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {formatLocalDate(session.starts_at, tz)} · {formatLocalTime(session.starts_at, tz)}–
            {formatLocalTime(session.ends_at, tz)}
            {(session.room ?? session.class.room) && ` · Room ${session.room ?? session.class.room}`}
          </p>
        </div>
        {session.status === "cancelled" ? <span className="badge">Cancelled</span> : <LiveRefresh sessionId={session.id} />}
      </div>

      {rule && (
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          On time until <strong>{formatLocalTime(addMinutes(session.starts_at, rule.late_after_minutes), tz)}</strong> ·
          late until <strong>{formatLocalTime(addMinutes(session.starts_at, rule.absent_after_minutes), tz)}</strong>
          {session.finalized_at ? " · absences recorded" : " · students without a tap are marked absent after that"}
        </p>
      )}

      <section className="grid">
        {(
          [
            ["Present", counts.present, STATUS_COLOR.present],
            ["Late", counts.late, STATUS_COLOR.late],
            ["Absent", counts.absent, STATUS_COLOR.absent],
            ["Excused", counts.excused, STATUS_COLOR.excused],
            ["Not yet", counts.pending, "var(--muted)"],
          ] as const
        ).map(([label, n, color]) => (
          <div key={label} className="card">
            <div className="muted">{label}</div>
            <div className="stat" style={{ color }}>
              {n}
            </div>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Students ({roster.length})</h2>
        {roster.length === 0 ? (
          <p className="muted">No students are enrolled in this class.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Checked in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => {
                  const r = recordByStudent.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.last_name}, {s.first_name}
                        <div className="muted" style={{ fontSize: "0.8rem" }}>
                          {s.student_number}
                        </div>
                      </td>
                      <td>
                        {r ? (
                          <>
                            <strong style={{ color: STATUS_COLOR[r.status] }}>{STATUS_LABEL[r.status]}</strong>
                            <div className="muted" style={{ fontSize: "0.8rem" }}>
                              {SOURCE_LABEL[r.source]}
                              {r.source === "manual" && r.note ? `: ${r.note}` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="muted">Not yet</span>
                        )}
                      </td>
                      <td>{r?.checked_in_at ? formatLocalTime(r.checked_in_at, tz) : "—"}</td>
                      <td>
                        <details>
                          <summary style={{ cursor: "pointer" }}>Change</summary>
                          <ActionForm action={correctAttendance} submitLabel="Save" className="stack small">
                            <SchoolSlugInput slug={schoolSlug} />
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="studentId" value={s.id} />
                            {r && <input type="hidden" name="expectedVersion" value={r.version} />}
                            <select name="status" defaultValue={r?.status ?? "present"} aria-label="New status">
                              <option value="present">Present</option>
                              <option value="late">Late</option>
                              <option value="absent">Absent</option>
                              <option value="excused">Excused</option>
                            </select>
                            <input name="reason" required minLength={3} maxLength={500} placeholder="Reason (required)" />
                          </ActionForm>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>History</h2>
        {(audit ?? []).length === 0 ? (
          <p className="muted">No attendance recorded yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: "0.5rem" }}>
            {(audit ?? []).map((a) => {
              const st = recordStudent.get(a.entity_id);
              const from = a.before?.status;
              const to = a.after?.status;
              return (
                <li key={a.id}>
                  <span className="muted">{formatLocalTime(a.created_at, tz)}</span> ·{" "}
                  <strong>{st ? `${st.first_name} ${st.last_name}` : "Student"}</strong>:{" "}
                  {from && to && from !== to ? (
                    <>
                      {STATUS_LABEL[from]} → {STATUS_LABEL[to]}
                    </>
                  ) : (
                    to && STATUS_LABEL[to]
                  )}{" "}
                  <span className="muted">
                    by {actorName(a)}
                    {a.reason && a.actor_type === "user" ? ` — “${a.reason}”` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
