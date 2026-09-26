import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { updateDefaultRule } from "@/server/admin/rules";

type Rule = {
  early_checkin_minutes: number;
  late_after_minutes: number;
  absent_after_minutes: number;
  scan_after_cutoff: "late" | "absent" | "reject";
  duplicate_window_seconds: number;
  auto_finalize: boolean;
};

export default async function RulesPage({ params }: PageProps<"/s/[schoolSlug]/admin/rules">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data: rule } = await supabase
    .from("attendance_rules")
    .select("early_checkin_minutes, late_after_minutes, absent_after_minutes, scan_after_cutoff, duplicate_window_seconds, auto_finalize")
    .eq("school_id", access.school.id)
    .eq("is_default", true)
    .returns<Rule[]>()
    .maybeSingle();
  if (!rule) return <p className="error">This school has no default attendance rule.</p>;

  return (
    <div className="stack">
      <h1>Attendance rules</h1>
      <p className="muted" style={{ margin: 0 }}>
        All minutes are counted from the moment the class starts.
      </p>

      <section className="card stack">
        <ActionForm action={updateDefaultRule} submitLabel="Save rules">
          <SchoolSlugInput slug={schoolSlug} />
          <div className="form-grid">
            <label>
              Check-in opens (minutes before class)
              <input name="early_checkin_minutes" type="number" min={0} max={240} required defaultValue={rule.early_checkin_minutes} />
            </label>
            <label>
              On time until (minutes after start)
              <input name="late_after_minutes" type="number" min={0} max={240} required defaultValue={rule.late_after_minutes} />
            </label>
            <label>
              Absent if no scan by (minutes after start)
              <input name="absent_after_minutes" type="number" min={0} max={480} required defaultValue={rule.absent_after_minutes} />
            </label>
            <label>
              A scan after that counts as
              <select name="scan_after_cutoff" defaultValue={rule.scan_after_cutoff}>
                <option value="late">Late</option>
                <option value="absent">Absent (scan is logged)</option>
                <option value="reject">Rejected</option>
              </select>
            </label>
            <label>
              Ignore repeated taps within (seconds)
              <input
                name="duplicate_window_seconds"
                type="number"
                min={0}
                max={3600}
                required
                defaultValue={rule.duplicate_window_seconds}
              />
            </label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" name="auto_finalize" defaultChecked={rule.auto_finalize} />
              Mark students without a scan as absent automatically
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2>Example</h2>
        <p style={{ margin: 0 }}>
          For a class at <strong>07:30</strong>: taps from{" "}
          <strong>{minutesToClock(450 - rule.early_checkin_minutes)}</strong> to{" "}
          <strong>{minutesToClock(450 + rule.late_after_minutes)}</strong> are <em>present</em>; until{" "}
          <strong>{minutesToClock(450 + rule.absent_after_minutes)}</strong> they are <em>late</em>; students who
          haven&apos;t tapped by then are <em>absent</em>.
        </p>
      </section>
    </div>
  );
}

function minutesToClock(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
