import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { inviteTeacher } from "@/server/admin/teachers";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string | null;
  status: string;
  classes: { id: string }[];
};

export default async function TeachersPage({ params }: PageProps<"/s/[schoolSlug]/admin/teachers">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("id, first_name, last_name, employee_number, status, classes:class_teachers(id)")
    .eq("school_id", access.school.id)
    .order("last_name")
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const teachers = data ?? [];
  const base = `/s/${schoolSlug}/admin/teachers`;

  return (
    <div className="stack">
      <h1>Teachers</h1>

      <section className="card stack">
        <h2>Add a teacher</h2>
        <p className="muted" style={{ margin: 0 }}>
          Creates their account and gives you a one-time sign-in link to send them (WhatsApp, email…). They open it and
          choose their password.
        </p>
        <ActionForm action={inviteTeacher} submitLabel="Add teacher" resetOnSuccess>
          <SchoolSlugInput slug={schoolSlug} />
          <div className="form-grid">
            <label>
              Email
              <input name="email" type="email" required maxLength={320} autoCapitalize="none" autoComplete="off" />
            </label>
            <label>
              First name
              <input name="first_name" required maxLength={100} />
            </label>
            <label>
              Last name
              <input name="last_name" required maxLength={100} />
            </label>
            <label>
              Employee number (optional)
              <input name="employee_number" maxLength={64} />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>All teachers ({teachers.length})</h2>
        {teachers.length === 0 ? (
          <p className="muted">No teachers yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee #</th>
                  <th>Classes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`${base}/${t.id}`}>
                        {t.last_name}, {t.first_name}
                      </Link>
                    </td>
                    <td>{t.employee_number ?? "—"}</td>
                    <td>{t.classes.length}</td>
                    <td>
                      <span className="badge">{t.status}</span>
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
