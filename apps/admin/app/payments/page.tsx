import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  status: string;
  amount: number;
  currency: string;
  provider_reference: string | null;
  created_at: string;
  customer_first: string;
  customer_last: string;
  booking_id: string;
}

async function getPayments(): Promise<PaymentRow[]> {
  return query<PaymentRow>(`
    select p.id, p.status, p.amount, p.currency, p.provider_reference, p.created_at, p.booking_id,
      u.first_name as customer_first, u.last_name as customer_last
    from payments p
    join users u on u.id = p.customer_id
    order by p.created_at desc
    limit 100
  `);
}

export default async function PaymentsPage() {
  const payments = await getPayments();
  const totalCaptured = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <>
      <PageHeader title="Pagos" subtitle={`${payments.length} transacciones · ${formatMoney(totalCaptured, "COP")} procesados`} />
      <div className="card">
        {payments.length === 0 ? (
          <p className="empty">No hay pagos todavía.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Referencia</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.customer_first} {p.customer_last}
                  </td>
                  <td>{formatMoney(p.amount, p.currency)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.provider_reference ?? "—"}</td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
