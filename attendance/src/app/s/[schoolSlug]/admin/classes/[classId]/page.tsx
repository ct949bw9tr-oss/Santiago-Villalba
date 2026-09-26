import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { formatLocalDate, formatLocalTime } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import {
  addClassTeacher,
  addSchedule,
  enrollStudents,
  generateSessions,
  removeClassTeacher,
  removeSchedule,
  setSessionStatus,
  unenrollStudent,
  updateClass,
} from "@/server/admin/classes";

const WEEKDAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ClassRow = { id: string; name: string; room: string | null; status: "active" | "archived"; course_id: string };
type Assignment = { id: string; role: string; teacher: { id: string; first_name: string; last_name: string } };
type Schedule = { id: string; weekday: number; start_time: string; end_time: string; room: string | null };
type Enrollment = {
  id: string;
  enrolled_on: string;
  student: { id: string; student_number: string; first_name: string; last_name: string };
};
type Session = { id: string; starts_at: string; ends_at: string; status: string; room: string | null };
type Person = { id: string; first_name: string; last_name: string; student_number?: string };

export default async function ClassPage({ params }: PageProps<"/s/[schoolSlug]/admin/classes/[classId]">) {
  const { schoolSlug, classId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;

  const { data: cls } = await supabase
    .from("class_sections")
    .select("id, name, room, status, course_id")
    .eq("school_id", schoolId)
    .eq("id", classId)
    .returns<ClassRow[]>()
    .maybeSingle();
  if (!cls) notFound();

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [courses, assignments, allTeachers, schedules, enrollments, allStudents, sessions] = await Promise.all([
    supabase.from("courses").select("id, code, name").eq("school_id", schoolId).order("code"),
    supabase
      .from("class_teachers")
      .select("id, role, teacher:teachers!inner(id, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .returns<Assignment[]>(),
    supabase
      .from("teachers")
      .select("id, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("last_name")
      .returns<Person[]>(),
    supabase
      .from("class_schedules")
      .select("id, weekday, start_time, end_time, room")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .order("weekday")
      .order("start_time")
      .returns<Schedule[]>(),
    supabase
      .from("enrollments")
      .select("id, enrolled_on, student:students!inner(id, student_number, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .is("withdrawn_on", null)
      .returns<Enrollment[]>(),
    supabase
      .from("students")
      .select("id, student_number, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("last_name")
      .order("first_name")
      .returns<Person[]>(),
    supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, status, room")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .gte("ends_at", now.toISOString())
      .lt("starts_at", horizon.toISOString())
      .order("starts_at")
      .returns<Session[]>(),
  ]);

  const assigned = new Set((assignments.data ?? []).map((a) => a.teacher.id));
  const assignable = (allTeachers.data ?? []).filter((t) => !assigned.has(t.id));
  const enrolledRows = (enrollments.data ?? []).sort((a, b) => a.student.last_name.localeCompare(b.student.last_name));
  const enrolledIds = new Set(enrolledRows.map((e) => e.student.id));
  const enrollable = (allStudents.data ?? []).filter((s) => !enrolledIds.has(s.id));
  const base = `/s/${schoolSlug}/admin`;
  const hidden = (
    <>
      <SchoolSlugInput slug={schoolSlug} />
      <input type="hidden" name="classId" value={cls.id} />
    </>
  );

  return (
    <div className="stack">
      <p>
        <Link href={`${base}/classes`}>← Classes</Link>
      </p>
      <h1>{cls.name}</h1>

      {/* Details */}
      <section className="card stack">
        <h2>Details</h2>
        <ActionForm action={updateClass} submitLabel="Save">
          {hidden}
          <div className="form-grid">
            <label>
              Course
              <select name="course_id" defaultValue={cls.course_id} required>
                {(courses.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Class name
              <input name="name" defaultValue={cls.name} required maxLength={200} />
            </label>
            <label>
              Room
              <input name="room" defaultValue={cls.room ?? ""} maxLength={64} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={cls.status}>
                <option value="active">Active</option>
                <option value="archived">Archived (no new sessions)</option>
              </select>
            </label>
          </div>
        </ActionForm>
      </section>

      {/* Teachers */}
      <section className="card stack">
        <h2>Teachers</h2>
        {(assignments.data ?? []).length === 0 ? (
          <p className="muted">No teacher assigned.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: "0.5rem" }}>
            {(assignments.data ?? []).map((a) => (
              <li key={a.id} className="inline">
                <span>
                  {a.teacher.first_name} {a.teacher.last_name} <span className="muted">({a.role})</span>
                </span>
                <ActionForm
                  action={removeClassTeacher}
                  submitLabel="Remove"
                  variant="secondary"
                  className="inline small"
                  confirmText="Remove this teacher from the class?"
                >
                  <SchoolSlugInput slug={schoolSlug} />
                  <input type="hidden" name="assignmentId" value={a.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        {assignable.length > 0 ? (
          <ActionForm action={addClassTeacher} submitLabel="Assign" className="inline">
            {hidden}
            <select name="teacherId" required defaultValue="" aria-label="Teacher">
              <option value="" disabled>
                Choose a teacher…
              </option>
              {assignable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.last_name}, {t.first_name}
                </option>
              ))}
            </select>
            <select name="role" defaultValue="primary" aria-label="Role">
              <option value="primary">Primary</option>
              <option value="assistant">Assistant</option>
            </select>
          </ActionForm>
        ) : (
          (allTeachers.data ?? []).length === 0 && (
            <p className="muted">
              <Link href={`${base}/teachers`}>Add teachers</Link> first.
            </p>
          )
        )}
      </section>

      {/* Weekly schedule */}
      <section className="card stack">
        <h2>Weekly schedule</h2>
        {(schedules.data ?? []).length === 0 ? (
          <p className="muted">No time slots yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: "0.5rem" }}>
            {(schedules.data ?? []).map((s) => (
              <li key={s.id} className="inline">
                <span>
                  <strong>{WEEKDAYS[s.weekday]}</strong> {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  {s.room && <span className="muted"> · {s.room}</span>}
                </span>
                <ActionForm
                  action={removeSchedule}
                  submitLabel="Remove"
                  variant="secondary"
                  className="inline small"
                  confirmText="Remove this time slot? Its future sessions without attendance will be deleted."
                >
                  <SchoolSlugInput slug={schoolSlug} />
                  <input type="hidden" name="scheduleId" value={s.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addSchedule} submitLabel="Add time slot">
          {hidden}
          <div className="form-grid">
            <label>
              Day
              <select name="weekday" defaultValue="1">
                {WEEKDAYS.slice(1).map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Starts
              <input name="start_time" type="time" required defaultValue="07:30" />
            </label>
            <label>
              Ends
              <input name="end_time" type="time" required defaultValue="08:30" />
            </label>
            <label>
              Room (optional)
              <input name="room" maxLength={64} placeholder={cls.room ?? ""} />
            </label>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Times are in the school&apos;s timezone ({tz}). Sessions are created for the next 4 weeks and extended
            automatically every day.
          </p>
        </ActionForm>
      </section>

      {/* Students */}
      <section className="card stack">
        <h2>Students ({enrolledRows.length})</h2>
        {enrolledRows.length > 0 && (
          <div className="table-wrap">
            <table>
              <tbody>
                {enrolledRows.map((e) => (
                  <tr key={e.id}>
                    <td>{e.student.student_number}</td>
                    <td>
                      <Link href={`${base}/students/${e.student.id}`}>
                        {e.student.last_name}, {e.student.first_name}
                      </Link>
                    </td>
                    <td className="muted">since {e.enrolled_on}</td>
                    <td>
                      <ActionForm
                        action={unenrollStudent}
                        submitLabel="Remove"
                        variant="secondary"
                        className="inline small"
                        confirmText="Remove this student from the class?"
                      >
                        <SchoolSlugInput slug={schoolSlug} />
                        <input type="hidden" name="enrollmentId" value={e.id} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {enrollable.length > 0 ? (
          <details>
            <summary>Add students ({enrollable.length} available)</summary>
            <ActionForm action={enrollStudents} submitLabel="Enroll selected">
              {hidden}
              <div className="checklist">
                {enrollable.map((s) => (
                  <label key={s.id}>
                    <input type="checkbox" name="studentIds" value={s.id} />
                    {s.last_name}, {s.first_name} <span className="muted">{s.student_number}</span>
                  </label>
                ))}
              </div>
            </ActionForm>
          </details>
        ) : (
          (allStudents.data ?? []).length === 0 && (
            <p className="muted">
              <Link href={`${base}/students`}>Add students</Link> first.
            </p>
          )
        )}
      </section>

      {/* Upcoming sessions */}
      <section className="card stack">
        <div className="section-head">
          <h2>Next 14 days</h2>
          <ActionForm action={generateSessions} submitLabel="Regenerate sessions" variant="secondary" className="inline small">
            <SchoolSlugInput slug={schoolSlug} />
          </ActionForm>
        </div>
        {(sessions.data ?? []).length === 0 ? (
          <p className="muted">No upcoming sessions. Add a time slot above.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <tbody>
                {(sessions.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{formatLocalDate(s.starts_at, tz)}</td>
                    <td>
                      {formatLocalTime(s.starts_at, tz)}–{formatLocalTime(s.ends_at, tz)}
                    </td>
                    <td>
                      <span className="badge">{s.status}</span>
                    </td>
                    <td>
                      {s.status !== "completed" && (
                        <ActionForm
                          action={setSessionStatus}
                          submitLabel={s.status === "cancelled" ? "Restore" : "Cancel"}
                          variant="secondary"
                          className="inline small"
                          confirmText={s.status === "cancelled" ? undefined : "Cancel this session (e.g. holiday)?"}
                        >
                          <SchoolSlugInput slug={schoolSlug} />
                          <input type="hidden" name="sessionId" value={s.id} />
                          <input type="hidden" name="status" value={s.status === "cancelled" ? "scheduled" : "cancelled"} />
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
