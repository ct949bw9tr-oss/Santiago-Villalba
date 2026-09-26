import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createCourse } from "@/server/admin/courses";

type Row = { id: string; code: string; name: string; classes: { id: string }[] };

export default async function CoursesPage({ params }: PageProps<"/s/[schoolSlug]/admin/courses">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("courses")
    .select("id, code, name, classes:class_sections(id)")
    .eq("school_id", access.school.id)
    .order("code")
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const courses = data ?? [];

  return (
    <div className="stack">
      <h1>Courses</h1>
      <p className="muted" style={{ margin: 0 }}>
        A course is the subject (e.g. “Mathematics 7”). Classes are the actual groups that meet on a schedule.
      </p>

      <section className="card stack">
        <h2>Add a course</h2>
        <ActionForm action={createCourse} submitLabel="Add course" resetOnSuccess>
          <SchoolSlugInput slug={schoolSlug} />
          <div className="form-grid">
            <label>
              Code
              <input name="code" required maxLength={32} placeholder="MAT7" />
            </label>
            <label>
              Name
              <input name="name" required maxLength={200} placeholder="Mathematics 7" />
            </label>
            <label>
              Description (optional)
              <input name="description" maxLength={1000} />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>All courses ({courses.length})</h2>
        {courses.length === 0 ? (
          <p className="muted">No courses yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Classes</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code}</td>
                    <td>
                      <Link href={`/s/${schoolSlug}/admin/courses/${c.id}`}>{c.name}</Link>
                    </td>
                    <td>{c.classes.length}</td>
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
