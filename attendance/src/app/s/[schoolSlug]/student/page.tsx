import { formatLocalDate, formatLocalTime } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";

type RecordRow = {
  id: string;
  status: "present" | "late" | "absent" | "excused";
  checked_in_at: string | null;
  session: { starts_at: string; class: { name: string } | null } | null;
};

export default async function StudentAttendance({ params }: PageProps<"/s/[schoolSlug]/student">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "student");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("school_id", access.school.id)
    .eq("user_id", access.user.id)
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);

  let records: RecordRow[] = [];
  if (student) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, status, checked_in_at, session:class_sessions!inner(starts_at, class:class_sections!inner(name))")
      .eq("school_id", access.school.id)
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<RecordRow[]>();
    if (error) throw new Error(error.message);
    records = data ?? [];
  }

  const count = (st: RecordRow["status"]) => records.filter((r) => r.status === st).length;
  const attended = count("present") + count("late");
  const rate = attended + count("absent") ? Math.round((1000 * attended) / (attended + count("absent"))) / 10 : null;

  return (
    <div className="stack">
      <h1>My attendance</h1>
      {records.length > 0 && (
        <section className="grid">
          <div className="card">
            <div className="muted">Attendance rate</div>
            <div className="stat">{rate === null ? "—" : `${rate}%`}</div>
          </div>
          {(["present", "late", "absent", "excused"] as const).map((st) => (
            <div key={st} className="card">
              <div className="muted">{st[0].toUpperCase() + st.slice(1)}</div>
              <div className="stat">{count(st)}</div>
            </div>
          ))}
        </section>
      )}
      {!student ? (
        <div className="card muted">Your account is not linked to a student record yet.</div>
      ) : records.length === 0 ? (
        <div className="card muted">No attendance recorded yet.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Status</th>
                <th>Checked in</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.session ? formatLocalDate(r.session.starts_at, tz) : "—"}</td>
                  <td>{r.session?.class?.name}</td>
                  <td>
                    <span className="badge">{r.status}</span>
                  </td>
                  <td>{r.checked_in_at ? formatLocalTime(r.checked_in_at, tz) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
