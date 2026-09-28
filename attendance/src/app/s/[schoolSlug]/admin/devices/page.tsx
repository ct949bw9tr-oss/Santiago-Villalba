import Link from "next/link";
import { ChevronDown, Cpu, ExternalLink, MonitorSmartphone, Plus, RadioTower } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { fmtShortDate, fmtTime } from "@/lib/ui/format";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createReader, rotateReaderToken, setDeviceStatus } from "@/server/admin/devices";
import { SettingsTabs } from "@/components/shell/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/status-badge";

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

export const metadata = { title: "Lectores NFC" };

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
  const now = new Date().getTime();

  return (
    <div className="stack-lg">
      <PageHeader title="Configuración" subtitle="Los lectores NFC envían cada toque al API de asistencia con su propio token." />
      <SettingsTabs slug={schoolSlug} active="devices" />

      <section className="card row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
        <span className="kpi-icon tone-blue">
          <MonitorSmartphone size={20} />
        </span>
        <div className="grow stack-sm" style={{ minWidth: 240 }}>
          <h2 style={{ margin: 0 }}>Pantalla de lector (modo kiosco)</h2>
          <p className="text-2" style={{ margin: 0 }}>
            Conecta un lector NFC USB “tipo teclado” a una tablet, iPad o computador del salón (o usa un teléfono Android con NFC),
            abre la pantalla de lector y pega el token del lector. Cada tarjeta que acerquen queda registrada al instante.
          </p>
          <ol className="hint" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            <li>Crea un lector abajo (o pide “Nuevo token”).</li>
            <li>En el aparato del salón abre el enlace que aparece, o abre /kiosk y pega el token.</li>
            <li>Deja la pantalla abierta: muestra “Acerca la tarjeta NFC”.</li>
          </ol>
        </div>
        <div className="stack-sm">
          <a className="button secondary" href="/kiosk" target="_blank" rel="noopener">
            <ExternalLink size={15} /> Abrir pantalla de lector
          </a>
          <Link className="button secondary" href={`/s/${schoolSlug}/admin/devices/install`}>
            <Cpu size={15} /> Instalar lector Wi-Fi
          </Link>
        </div>
      </section>

      <details className="disclosure card" style={{ padding: 0 }}>
        <summary>
          <span className="kpi-icon tone-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <Plus size={16} />
          </span>
          Agregar lector
          <ChevronDown size={18} className="chev" />
        </summary>
        <div className="disclosure-body stack">
          <p className="hint">Un lector puede quedar asignado a un salón o ser general (p. ej. en la entrada del colegio).</p>
          <ActionForm action={createReader} submitLabel="Crear lector" resetOnSuccess>
            <SchoolSlugInput slug={schoolSlug} />
            <div className="form-grid">
              <label>
                Nombre
                <input name="name" required maxLength={100} placeholder="Lector salón 201" />
              </label>
              <label>
                Ubicación (opcional)
                <input name="location" maxLength={100} placeholder="Puerta, piso 2" />
              </label>
              <label>
                Clase (opcional)
                <select name="class_section_id" defaultValue="">
                  <option value="">Cualquier clase (lector general)</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </ActionForm>
        </div>
      </details>

      {(devices ?? []).length === 0 ? (
        <div className="card">
          <EmptyState icon={RadioTower} title="Aún no hay dispositivos" />
        </div>
      ) : (
        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {(devices ?? []).map((d) => {
            const online = d.status === "active" && d.last_seen_at && now - new Date(d.last_seen_at).getTime() < 24 * 3600_000;
            return (
              <div key={d.id} className="card stack">
                <div className="row-between">
                  <span className={`kpi-icon ${d.kind === "simulator" ? "tone-violet" : "tone-blue"}`}>
                    {d.kind === "simulator" ? <Cpu size={19} /> : <RadioTower size={19} />}
                  </span>
                  {d.status === "disabled" ? (
                    <Badge tone="danger" dot>
                      Desactivado
                    </Badge>
                  ) : online ? (
                    <Badge tone="success" dot>
                      En línea
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      Sin conexión reciente
                    </Badge>
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{d.name}</h3>
                  <div className="cell-sub">{d.kind === "simulator" ? "Simulador web" : "Lector NFC"}{d.location ? ` · ${d.location}` : ""}</div>
                </div>
                <dl className="kv">
                  <dt>Clase</dt>
                  <dd>{d.class?.name ?? "Cualquiera"}</dd>
                  <dt>Última conexión</dt>
                  <dd>{d.last_seen_at ? `${fmtShortDate(d.last_seen_at, tz)} ${fmtTime(d.last_seen_at, tz)}` : "Nunca"}</dd>
                  {d.token_last4 && (
                    <>
                      <dt>Token</dt>
                      <dd className="mono">…{d.token_last4}</dd>
                    </>
                  )}
                </dl>
                <div className="inline" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
                  {d.kind === "reader" && (
                    <ActionForm
                      action={rotateReaderToken}
                      submitLabel="Nuevo token"
                      variant="secondary"
                      className="stack small"
                      confirmText="¿Crear un token nuevo? El token actual del lector deja de funcionar de inmediato."
                      confirmLabel="Crear token"
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="deviceId" value={d.id} />
                    </ActionForm>
                  )}
                  <ActionForm
                    action={setDeviceStatus}
                    submitLabel={d.status === "active" ? "Desactivar" : "Activar"}
                    variant="secondary"
                    className="inline small"
                    quiet
                  >
                    <SchoolSlugInput slug={schoolSlug} />
                    <input type="hidden" name="deviceId" value={d.id} />
                    <input type="hidden" name="status" value={d.status === "active" ? "disabled" : "active"} />
                  </ActionForm>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
