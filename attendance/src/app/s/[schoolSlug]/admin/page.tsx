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
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("school_id", access.school.id);
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

      <section className="card">
        <h2>Coming next (Phase 2)</h2>
        <p className="muted">
          Management screens for students, teachers, courses, classes, schedules, enrollments, NFC cards and
          attendance rules.
        </p>
      </section>
    </div>
  );
}
