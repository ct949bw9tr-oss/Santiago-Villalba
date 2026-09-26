import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { teacherSignInLink, updateTeacher } from "@/server/admin/teachers";

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string | null;
  status: "active" | "inactive";
  profile: { email: string | null } | null;
  classes: { id: string; role: string; class: { id: string; name: string } }[];
};

export default async function TeacherPage({ params }: PageProps<"/s/[schoolSlug]/admin/teachers/[teacherId]">) {
  const { schoolSlug, teacherId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select(
      "id, first_name, last_name, employee_number, status, profile:profiles(email), classes:class_teachers(id, role, class:class_sections!inner(id, name))",
    )
    .eq("school_id", access.school.id)
    .eq("id", teacherId)
    .returns<Teacher[]>()
    .maybeSingle();
  if (!teacher) notFound();
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack">
      <p>
        <Link href={`${base}/teachers`}>← Teachers</Link>
      </p>
      <h1>
        {teacher.first_name} {teacher.last_name}
      </h1>
      {teacher.profile?.email && <p className="muted">{teacher.profile.email}</p>}

      <section className="card stack">
        <h2>Details</h2>
        <ActionForm action={updateTeacher} submitLabel="Save">
          <SchoolSlugInput slug={schoolSlug} />
          <input type="hidden" name="teacherId" value={teacher.id} />
          <div className="form-grid">
            <label>
              First name
              <input name="first_name" defaultValue={teacher.first_name} required maxLength={100} />
            </label>
            <label>
              Last name
              <input name="last_name" defaultValue={teacher.last_name} required maxLength={100} />
            </label>
            <label>
              Employee number
              <input name="employee_number" defaultValue={teacher.employee_number ?? ""} maxLength={64} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={teacher.status}>
                <option value="active">Active (can sign in)</option>
                <option value="inactive">Inactive (access blocked)</option>
              </select>
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Sign-in link</h2>
        <p className="muted" style={{ margin: 0 }}>
          If they lost their invitation or forgot their password, create a new one-time link and send it to them.
        </p>
        <ActionForm action={teacherSignInLink} submitLabel="Create sign-in link" variant="secondary">
          <SchoolSlugInput slug={schoolSlug} />
          <input type="hidden" name="teacherId" value={teacher.id} />
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>Classes</h2>
        {teacher.classes.length === 0 ? (
          <p className="muted">Not assigned to any class yet. Assign teachers from a class page.</p>
        ) : (
          <ul>
            {teacher.classes.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/classes/${c.class.id}`}>{c.class.name}</Link>{" "}
                <span className="muted">({c.role})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
