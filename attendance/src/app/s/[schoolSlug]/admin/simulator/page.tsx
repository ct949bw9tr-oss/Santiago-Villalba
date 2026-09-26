import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { formatUid } from "@/lib/nfc/uid";
import { formatLocalTime, localDateKey, utcWindowAroundLocalDay } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { runAbsenceCheck, setSimulatorEnabled } from "@/server/admin/devices";
import { Simulator } from "./simulator";

type CardRow = { uid_normalized: string; student: { id: string; first_name: string; last_name: string; status: string } };
type ScanRow = {
  id: string;
  received_at: string;
  effective_at: string;
  uid_normalized: string;
  outcome: string;
  outcome_detail: string | null;
  device: { name: string; kind: string };
  student: { first_name: string; last_name: string } | null;
  record: { status: string } | null;
};
type SessionRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  finalized_at: string | null;
  class: { name: string };
  records: { status: string }[];
};

const STATUSES = ["present", "late", "absent", "excused"] as const;

export default async function SimulatorPage({ params }: PageProps<"/s/[schoolSlug]/admin/simulator">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;

  const { data: school } = await supabase.from("schools").select("settings").eq("id", schoolId).single();
  const enabled = Boolean(school?.settings?.simulator_enabled);

  if (!enabled) {
    return (
      <div className="stack">
        <h1>NFC simulator</h1>
        <section className="card stack">
          <p style={{ margin: 0 }}>
            The simulator lets you tap a student&apos;s card from this page, before any physical reader is installed. Taps
            go through the same attendance API that real readers use and are logged as coming from the simulator.
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Switch it off again once real readers are in use.
          </p>
          <ActionForm action={setSimulatorEnabled} submitLabel="Enable simulator">
            <SchoolSlugInput slug={schoolSlug} />
            <input type="hidden" name="enabled" value="true" />
          </ActionForm>
        </section>
      </div>
    );
  }

  const now = new Date();
  const { from, to } = utcWindowAroundLocalDay(now);
  const [{ data: cards }, { data: scans }, { data: sessions }] = await Promise.all([
    supabase
      .from("nfc_credentials")
      .select("uid_normalized, student:students!inner(id, first_name, last_name, status)")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .returns<CardRow[]>(),
    supabase
      .from("scan_events")
      .select(
        "id, received_at, effective_at, uid_normalized, outcome, outcome_detail, device:devices!inner(name, kind), student:students(first_name, last_name), record:attendance_records!scan_events_school_id_attendance_record_id_fkey(status)",
      )
      .eq("school_id", schoolId)
      .order("received_at", { ascending: false })
      .limit(15)
      .returns<ScanRow[]>(),
    supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, status, finalized_at, class:class_sections!inner(name), records:attendance_records(status)")
      .eq("school_id", schoolId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .returns<SessionRow[]>(),
  ]);

  const students = (cards ?? [])
    .filter((c) => c.student.status === "active")
    .map((c) => ({
      id: c.student.id,
      name: `${c.student.last_name}, ${c.student.first_name} — ${formatUid(c.uid_normalized)}`,
      uid: formatUid(c.uid_normalized),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = localDateKey(now, tz);
  const todaysSessions = (sessions ?? []).filter((s) => localDateKey(new Date(s.starts_at), tz) === today);

  return (
    <div className="stack">
      <div>
        <h1>NFC simulator</h1>
        <p className="muted" style={{ margin: 0 }}>
          School time now: <strong>{formatLocalTime(now, tz)}</strong> ({tz})
        </p>
      </div>

      <section className="card stack">
        {students.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            No student has an NFC card yet — assign one from a student&apos;s page, or type any UID below.
          </p>
        )}
        <Simulator schoolSlug={schoolSlug} timeZone={tz} students={students} />
      </section>

      <section className="card stack">
        <div className="section-head">
          <h2>Today&apos;s classes</h2>
          <ActionForm action={runAbsenceCheck} submitLabel="Run absence check now" variant="secondary" className="inline small">
            <SchoolSlugInput slug={schoolSlug} />
          </ActionForm>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          The absence check runs automatically every 5 minutes: once a class passes its “absent after” time, enrolled
          students without a tap are marked absent.
        </p>
        {todaysSessions.length === 0 ? (
          <p className="muted">No classes today.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Class</th>
                  {STATUSES.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {todaysSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {formatLocalTime(s.starts_at, tz)}–{formatLocalTime(s.ends_at, tz)}
                    </td>
                    <td>{s.class.name}</td>
                    {STATUSES.map((st) => (
                      <td key={st}>{s.records.filter((r) => r.status === st).length}</td>
                    ))}
                    <td>
                      {s.status === "cancelled" ? (
                        <span className="badge">cancelled</span>
                      ) : (
                        s.finalized_at && <span className="badge">closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Latest taps</h2>
        {(scans ?? []).length === 0 ? (
          <p className="muted">No taps yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Card</th>
                  <th>Student</th>
                  <th>Result</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {(scans ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>
                      {formatLocalTime(s.effective_at, tz)}
                      {s.outcome_detail === "simulated time" && <div className="muted">simulated</div>}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{formatUid(s.uid_normalized)}</td>
                    <td>{s.student ? `${s.student.first_name} ${s.student.last_name}` : "—"}</td>
                    <td>
                      <span className="badge">{s.outcome.replaceAll("_", " ")}</span>
                      {s.record && <span className="muted"> {s.record.status}</span>}
                    </td>
                    <td>{s.device.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <ActionForm
          action={setSimulatorEnabled}
          submitLabel="Disable simulator"
          variant="secondary"
          className="inline small"
          confirmText="Disable the simulator for this school?"
        >
          <SchoolSlugInput slug={schoolSlug} />
          <input type="hidden" name="enabled" value="false" />
        </ActionForm>
      </section>
    </div>
  );
}
