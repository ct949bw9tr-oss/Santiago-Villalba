import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { formatLocalDate, formatLocalTime } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createReader, rotateReaderToken, setDeviceStatus } from "@/server/admin/devices";

type Device = {
  id: string;
  name: string;
  kind: "reader" | "simulator";
  status: "active" | "disabled";
  location: string | null;
  token_last4: string | null;
  last_seen_at: string | null;
  class: { name: string } | null;
};

export default async function DevicesPage({ params }: PageProps<"/s/[schoolSlug]/admin/devices">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;

  const [{ data: devices, error }, { data: classes }] = await Promise.all([
    supabase
      .from("devices")
      .select("id, name, kind, status, location, token_last4, last_seen_at, class:class_sections(name)")
      .eq("school_id", access.school.id)
      .order("kind")
      .order("name")
      .returns<Device[]>(),
    supabase.from("class_sections").select("id, name").eq("school_id", access.school.id).eq("status", "active").order("name"),
  ]);
  if (error) throw new Error(error.message);

  return (
    <div className="stack">
      <h1>Devices</h1>
      <p className="muted" style={{ margin: 0 }}>
        NFC readers send card taps to the attendance API with their own token. A reader can be tied to one classroom, or
        left general (e.g. at the school gate).
      </p>

      <section className="card stack">
        <h2>Add a reader</h2>
        <ActionForm action={createReader} submitLabel="Create reader" resetOnSuccess>
          <SchoolSlugInput slug={schoolSlug} />
          <div className="form-grid">
            <label>
              Name
              <input name="name" required maxLength={100} placeholder="Room 101 reader" />
            </label>
            <label>
              Location (optional)
              <input name="location" maxLength={100} placeholder="Door, 1st floor" />
            </label>
            <label>
              Classroom (optional)
              <select name="class_section_id" defaultValue="">
                <option value="">Any class (general reader)</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>All devices</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Classroom</th>
                <th>Last seen</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(devices ?? []).map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.name}
                    {d.location && <div className="muted">{d.location}</div>}
                  </td>
                  <td>
                    {d.kind === "simulator" ? "Simulator" : "Reader"}
                    {d.token_last4 && <div className="muted">token …{d.token_last4}</div>}
                  </td>
                  <td>{d.class?.name ?? <span className="muted">any</span>}</td>
                  <td>
                    {d.last_seen_at ? `${formatLocalDate(d.last_seen_at, tz)} ${formatLocalTime(d.last_seen_at, tz)}` : "—"}
                  </td>
                  <td>
                    <span className="badge">{d.status}</span>
                  </td>
                  <td className="stack" style={{ gap: "0.4rem" }}>
                    {d.kind === "reader" && (
                      <ActionForm
                        action={rotateReaderToken}
                        submitLabel="New token"
                        variant="secondary"
                        className="stack small"
                        confirmText="Create a new token? The reader's current token stops working immediately."
                      >
                        <SchoolSlugInput slug={schoolSlug} />
                        <input type="hidden" name="deviceId" value={d.id} />
                      </ActionForm>
                    )}
                    <ActionForm
                      action={setDeviceStatus}
                      submitLabel={d.status === "active" ? "Disable" : "Enable"}
                      variant="secondary"
                      className="inline small"
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="deviceId" value={d.id} />
                      <input type="hidden" name="status" value={d.status === "active" ? "disabled" : "active"} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
