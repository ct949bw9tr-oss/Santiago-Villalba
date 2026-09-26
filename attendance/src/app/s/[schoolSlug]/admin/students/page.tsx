import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createStudent } from "@/server/admin/students";

type Row = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  status: string;
  cards: { status: string }[];
};

export default async function StudentsPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/admin/students">) {
  const { schoolSlug } = await params;
  const { q } = await searchParams;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const search = typeof q === "string" ? q.trim().slice(0, 100) : "";

  let query = supabase
    .from("students")
    .select("id, student_number, first_name, last_name, grade_level, status, cards:nfc_credentials(status)")
    .eq("school_id", access.school.id)
    .order("last_name")
    .order("first_name")
    .limit(500);
  if (search) {
    // Strip PostgREST filter syntax characters from user input.
    const term = search.replace(/[,()*%]/g, " ");
    query = query.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,student_number.ilike.*${term}*`);
  }
  const { data, error } = await query.returns<Row[]>();
  if (error) throw new Error(error.message);
  const students = data ?? [];
  const base = `/s/${schoolSlug}/admin/students`;

  return (
    <div className="stack">
      <h1>Students</h1>

      <section className="card stack">
        <h2>Add a student</h2>
        <ActionForm action={createStudent} submitLabel="Add student" resetOnSuccess>
          <SchoolSlugInput slug={schoolSlug} />
          <div className="form-grid">
            <label>
              Student number
              <input name="student_number" required maxLength={64} />
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
              Grade
              <input name="grade_level" maxLength={32} placeholder="e.g. 7" />
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <div className="section-head">
          <h2>All students ({students.length})</h2>
          <form className="inline" action={base}>
            <input name="q" defaultValue={search} placeholder="Search name or number" aria-label="Search" />
            <button type="submit" className="secondary">
              Search
            </button>
          </form>
        </div>
        {students.length === 0 ? (
          <p className="muted">{search ? "No students match." : "No students yet."}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Name</th>
                  <th>Grade</th>
                  <th>NFC card</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.student_number}</td>
                    <td>
                      <Link href={`${base}/${s.id}`}>
                        {s.last_name}, {s.first_name}
                      </Link>
                    </td>
                    <td>{s.grade_level ?? "—"}</td>
                    <td>{s.cards.some((c) => c.status === "active") ? "✓" : <span className="muted">none</span>}</td>
                    <td>
                      <span className="badge">{s.status}</span>
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
