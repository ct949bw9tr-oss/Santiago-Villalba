import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { updateCourse } from "@/server/admin/courses";

type Course = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  classes: { id: string; name: string }[];
};

export default async function CoursePage({ params }: PageProps<"/s/[schoolSlug]/admin/courses/[courseId]">) {
  const { schoolSlug, courseId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, name, description, classes:class_sections(id, name)")
    .eq("school_id", access.school.id)
    .eq("id", courseId)
    .returns<Course[]>()
    .maybeSingle();
  if (!course) notFound();
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack">
      <p>
        <Link href={`${base}/courses`}>← Courses</Link>
      </p>
      <h1>{course.name}</h1>

      <section className="card stack">
        <h2>Details</h2>
        <ActionForm action={updateCourse} submitLabel="Save">
          <SchoolSlugInput slug={schoolSlug} />
          <input type="hidden" name="courseId" value={course.id} />
          <div className="form-grid">
            <label>
              Code
              <input name="code" defaultValue={course.code} required maxLength={32} />
            </label>
            <label>
              Name
              <input name="name" defaultValue={course.name} required maxLength={200} />
            </label>
            <label>
              Description
              <input name="description" defaultValue={course.description ?? ""} maxLength={1000} />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Classes of this course</h2>
        {course.classes.length === 0 ? (
          <p className="muted">
            None yet. <Link href={`${base}/classes`}>Create a class</Link>.
          </p>
        ) : (
          <ul>
            {course.classes.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/classes/${c.id}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
