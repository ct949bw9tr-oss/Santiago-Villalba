import Link from "next/link";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";

const COUNTED_TABLES = [
  { table: "students", label: "Students" },
  { table: "teachers", label: "Teachers" },
  { table: "class_sections", label: "Classes" },
  { table: "nfc_credentials", label: "NFC cards" },
] as const;

export default async function AdminDashboard({ params }: PageProps<"/s/[schoolSlug]/admin">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  // Always scope by school_id explicitly: RLS allows every school the user
  // administers, and a person can be an admin in more than one school.
  const counts = await Promise.all(
    COUNTED_TABLES.map(async ({ table, label }) => {
      let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("school_id", access.school.id);
      if (table === "nfc_credentials") query = query.eq("status", "active");
      const { count, error } = await query;
      if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
      return { label, count: count ?? 0 };
    }),
  );

  return (
    <div className="stack">
      <div>
        <h1>Admin</h1>
        <p className="muted">Timezone: {access.school.timezone}</p>
      </div>

      <section className="grid">
        {counts.map(({ label, count }) => (
          <div key={label} className="card">
            <div className="muted">{label}</div>
            <div className="stat">{count}</div>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Setting up your school</h2>
        <ol className="stack" style={{ margin: 0, paddingLeft: "1.25rem", gap: "0.4rem" }}>
          <li>
            Add <Link href={`/s/${schoolSlug}/admin/teachers`}>teachers</Link> and{" "}
            <Link href={`/s/${schoolSlug}/admin/students`}>students</Link>.
          </li>
          <li>
            Create <Link href={`/s/${schoolSlug}/admin/courses`}>courses</Link> (subjects), then{" "}
            <Link href={`/s/${schoolSlug}/admin/classes`}>classes</Link> with their weekly schedule.
          </li>
          <li>In each class, assign its teacher and enroll its students.</li>
          <li>Give each student an NFC card from their student page.</li>
          <li>
            Review the <Link href={`/s/${schoolSlug}/admin/rules`}>attendance rules</Link> (on time / late / absent).
          </li>
        </ol>
      </section>
    </div>
  );
}
