import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { formatMoney } from "../../lib/format";
import { approveProvider, rejectProvider } from "./actions";

export const dynamic = "force-dynamic";

interface ProviderRow {
  id: string;
  first_name: string;
  last_name: string;
  headline: string;
  verification_state: string;
  rating_average: string;
  rating_count: number;
  completed_jobs_count: number;
  is_online: boolean;
  city: string | null;
  price: number | null;
  currency: string | null;
}

async function getProviders(): Promise<ProviderRow[]> {
  return query<ProviderRow>(`
    select u.id, u.first_name, u.last_name, pp.headline, pp.verification_state, pp.rating_average, pp.rating_count,
      pp.completed_jobs_count, pp.is_online, sa.city, ps.price, ps.currency
    from provider_profiles pp
    join users u on u.id = pp.id
    left join provider_service_areas sa on sa.provider_id = pp.id
    left join provider_services ps on ps.provider_id = pp.id
    order by pp.completed_jobs_count desc
  `);
}

const VERIFICATION_LABEL: Record<string, string> = {
  unverified: "Sin verificar",
  phone_verified: "Teléfono verificado",
  identity_pending: "Verificación pendiente",
  identity_verified: "Verificado",
  rejected: "Rechazado",
  suspended: "Suspendido",
};

export default async function ProvidersPage() {
  const providers = await getProviders();
  return (
    <>
      <PageHeader title="Proveedores" subtitle={`${providers.length} proveedores en la plataforma`} />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Ciudad</th>
              <th>Calificación</th>
              <th>Trabajos</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Verificación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="row-inline">
                    <span className="avatar">
                      {p.first_name[0]}
                      {p.last_name[0]}
                    </span>
                    <span>
                      {p.first_name} {p.last_name}
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.headline}</div>
                    </span>
                  </span>
                </td>
                <td>{p.city ?? "—"}</td>
                <td>
                  ★ {Number(p.rating_average).toFixed(1)} ({p.rating_count})
                </td>
                <td>{p.completed_jobs_count}</td>
                <td>{p.price !== null ? formatMoney(p.price, p.currency ?? "COP") : "Cotización"}</td>
                <td>
                  <StatusBadge status={p.is_online ? "identity_verified" : "unverified"} label={p.is_online ? "En línea" : "Fuera de línea"} />
                </td>
                <td>
                  <StatusBadge status={p.verification_state} label={VERIFICATION_LABEL[p.verification_state] ?? p.verification_state} />
                </td>
                <td>
                  {p.verification_state !== "identity_verified" && (
                    <form action={approveProvider.bind(null, p.id)} style={{ display: "inline" }}>
                      <button className="btn btn-primary" type="submit">
                        Verificar
                      </button>
                    </form>
                  )}
                  {p.verification_state !== "rejected" && p.verification_state !== "identity_verified" && (
                    <form action={rejectProvider.bind(null, p.id)} style={{ display: "inline", marginLeft: 6 }}>
                      <button className="btn" type="submit">
                        Rechazar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
