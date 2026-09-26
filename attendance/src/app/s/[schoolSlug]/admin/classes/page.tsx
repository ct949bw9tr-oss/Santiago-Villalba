import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createClass } from "@/server/admin/classes";

type Row = {
  id: string;
  name: string;
  room: string | null;
  status: string;
  course: { code: string; name: string };
  teachers: { teacher: { first_name: string; last_name: string } }[];
  enrollments: { withdrawn_on: string | null }[];
  schedules: { id: string }[];
};

export default async function ClassesPage({ params }: PageProps<"/s/[schoolSlug]/admin/classes">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const [{ data, error }, { data: courses }] = await Promise.all([
    supabase
      .from("class_sections")
      .select(
        "id, name, room, status, course:courses!inner(code, name), teachers:class_teachers(teacher:teachers!inner(first_name, last_name)), enrollments(withdrawn_on), schedules:class_schedules(id)",
      )
      .eq("school_id", access.school.id)
      .order("name")
      .returns<Row[]>(),
    supabase.from("courses").select("id, code, name").eq("school_id", access.school.id).order("code"),
  ]);
  if (error) throw new Error(error.message);
  const classes = data ?? [];
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack">
      <h1>Classes</h1>

      <section className="card stack">
        <h2>Create a class</h2>
        {(courses ?? []).length === 0 ? (
          <p className="muted">
            First <Link href={`${base}/courses`}>create a course</Link> (the subject), then create its classes here.
          </p>
        ) : (
          <ActionForm action={createClass} submitLabel="Create class">
            <SchoolSlugInput slug={schoolSlug} />
            <div className="form-grid">
              <label>
                Course
                <select name="course_id" required defaultValue="">
                  <option value="" disabled>
                    Choose…
                  </option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Class name
                <input name="name" required maxLength={200} placeholder="Math 7A" />
              </label>
              <label>
                Room (optional)
                <input name="room" maxLength={64} placeholder="101" />
              </label>
            </div>
          </ActionForm>
        )}
      </section>

      <section className="card stack">
        <h2>All classes ({classes.length})</h2>
        {classes.length === 0 ? (
          <p className="muted">No classes yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Course</th>
                  <th>Teachers</th>
                  <th>Students</th>
                  <th>Weekly slots</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`${base}/classes/${c.id}`}>{c.name}</Link>
                      {c.room && <span className="muted"> · {c.room}</span>}
                    </td>
                    <td>{c.course.code}</td>
                    <td>
                      {c.teachers.length === 0 ? (
                        <span className="muted">none</span>
                      ) : (
                        c.teachers.map((t) => `${t.teacher.first_name} ${t.teacher.last_name}`).join(", ")
                      )}
                    </td>
                    <td>{c.enrollments.filter((e) => !e.withdrawn_on).length}</td>
                    <td>{c.schedules.length}</td>
                    <td>
                      <span className="badge">{c.status}</span>
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
