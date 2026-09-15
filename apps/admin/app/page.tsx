import { query } from "../lib/db";
import { PageHeader } from "../components/PageHeader";
import { formatMoney, formatPercent } from "../lib/format";

export const dynamic = "force-dynamic";

interface Metrics {
  total_users: number;
  active_providers: number;
  completed_services: number;
  gmv: number;
  platform_revenue: number;
  active_disputes: number;
  total_bookings: number;
  cancelled_bookings: number;
  accepted_or_further: number;
  requested_total: number;
  repeat_customers: number;
  customers_with_completed: number;
}

async function getMetrics(): Promise<Metrics> {
  const [row] = await query<Metrics>(`
    select
      (select count(*) from users where is_provider = false) as total_users,
      (select count(*) from provider_profiles where is_online = true) as active_providers,
      (select count(*) from bookings where status = 'completed') as completed_services,
      (select coalesce(sum(total_amount), 0) from bookings where status = 'completed') as gmv,
      (select coalesce(sum(customer_fee), 0) from bookings where status = 'completed') as platform_revenue,
      (select count(*) from disputes where status in ('open', 'investigating')) as active_disputes,
      (select count(*) from bookings) as total_bookings,
      (select count(*) from bookings where status in ('cancelled_customer', 'cancelled_provider')) as cancelled_bookings,
      (select count(*) from bookings where status not in ('requested', 'pending_provider', 'expired')) as accepted_or_further,
      (select count(*) from bookings) as requested_total,
      (select count(*) from (
        select customer_id from bookings where status = 'completed' group by customer_id having count(*) > 1
      ) t) as repeat_customers,
      (select count(distinct customer_id) from bookings where status = 'completed') as customers_with_completed
  `);
  return row!;
}

export default async function DashboardPage() {
  const m = await getMetrics();
  const currency = "COP";
  const aov = m.completed_services > 0 ? Math.round(m.gmv / m.completed_services) : 0;
  const cancellationRate = m.total_bookings > 0 ? m.cancelled_bookings / m.total_bookings : 0;
  const repeatRate = m.customers_with_completed > 0 ? m.repeat_customers / m.customers_with_completed : 0;
  const acceptanceRate = m.requested_total > 0 ? m.accepted_or_further / m.requested_total : 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen general del marketplace" />
      <div className="metrics-grid">
        <Metric label="Usuarios (clientes)" value={String(m.total_users)} />
        <Metric label="Proveedores activos" value={String(m.active_providers)} sub="En línea ahora" />
        <Metric label="Servicios completados" value={String(m.completed_services)} />
        <Metric label="GMV" value={formatMoney(m.gmv, currency)} sub="Valor bruto transaccionado" />
        <Metric label="Ingresos de la plataforma" value={formatMoney(m.platform_revenue, currency)} sub="Tarifas de servicio" />
        <Metric label="Valor promedio de orden" value={formatMoney(aov, currency)} />
        <Metric label="Tasa de cancelación" value={formatPercent(cancellationRate)} />
        <Metric label="Clientes recurrentes" value={formatPercent(repeatRate)} />
        <Metric label="Disputas activas" value={String(m.active_disputes)} />
        <Metric label="Tasa de aceptación de proveedores" value={formatPercent(acceptanceRate)} />
      </div>
    </>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {sub && <p className="metric-sub">{sub}</p>}
    </div>
  );
}
