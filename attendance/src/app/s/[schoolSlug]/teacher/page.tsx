import Link from "next/link";
import { formatLocalDate, formatLocalTime, localDateKey, utcWindowAroundLocalDay } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";

type SessionRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  room: string | null;
  class: { name: string; room: string | null } | null;
  records: { status: string }[];
};

export default async function TeacherToday({ params }: PageProps<"/s/[schoolSlug]/teacher">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "teacher");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;

  // Only classes this teacher is assigned to. RLS would also return every
  // class if the same person is an admin here, so filter explicitly.
  const { data: assignments, error: assignmentError } = await supabase
    .from("class_teachers")
    .select("class_section_id, teacher:teachers!inner(user_id)")
    .eq("school_id", access.school.id)
    .eq("teacher.user_id", access.user.id);
  if (assignmentError) throw new Error(assignmentError.message);
  const classIds = (assignments ?? []).map((a) => a.class_section_id as string);

  const now = new Date();
  const today = localDateKey(now, tz);
  let sessions: SessionRow[] = [];

  if (classIds.length > 0) {
    const { from, to } = utcWindowAroundLocalDay(now);
    const { data, error } = await supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, status, room, class:class_sections!inner(name, room), records:attendance_records(status)")
      .eq("school_id", access.school.id)
      .in("class_section_id", classIds)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .returns<SessionRow[]>();
    if (error) throw new Error(error.message);
    sessions = (data ?? []).filter((s) => localDateKey(new Date(s.starts_at), tz) === today);
  }

  return (
    <div className="stack">
      <div>
        <h1>Today&apos;s classes</h1>
        <p className="muted">{formatLocalDate(now, tz)}</p>
      </div>

      {sessions.length === 0 ? (
        <div className="card muted">
          {classIds.length === 0 ? "You are not assigned to any classes yet." : "No classes scheduled today."}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Class</th>
                <th>Room</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {formatLocalTime(s.starts_at, tz)}–{formatLocalTime(s.ends_at, tz)}
                  </td>
                  <td>
                    <Link href={`/s/${schoolSlug}/sessions/${s.id}`}>{s.class?.name}</Link>
                  </td>
                  <td>{s.room ?? s.class?.room ?? "—"}</td>
                  <td>{s.records.filter((r) => r.status === "present").length}</td>
                  <td>{s.records.filter((r) => r.status === "late").length}</td>
                  <td>{s.records.filter((r) => r.status === "absent").length}</td>
                  <td>
                    <span className="badge">{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Open a class to see who has arrived and to correct attendance.
      </p>
    </div>
  );
}
