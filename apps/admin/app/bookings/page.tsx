import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { BOOKING_STATUS_LABEL_ES } from "../../lib/bookingLabels";

export const dynamic = "force-dynamic";

interface BookingRow {
  id: string;
  status: string;
  timing: string;
  scheduled_for: string | null;
  created_at: string;
  total_amount: number;
  currency: string;
  customer_first: string;
  customer_last: string;
  provider_first: string;
  provider_last: string;
  category_name: string;
}

async function getBookings(): Promise<BookingRow[]> {
  return query<BookingRow>(`
    select b.id, b.status, b.timing, b.scheduled_for, b.created_at, b.total_amount, b.currency,
      cu.first_name as customer_first, cu.last_name as customer_last,
      pu.first_name as provider_first, pu.last_name as provider_last,
      c.name as category_name
    from bookings b
    join users cu on cu.id = b.customer_id
    join users pu on pu.id = b.provider_id
    join categories c on c.id = b.category_id
    order by b.created_at desc
    limit 100
  `);
}

export default async function BookingsPage() {
  const bookings = await getBookings();
  return (
    <>
      <PageHeader title="Reservas" subtitle={`${bookings.length} reservas recientes`} />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Proveedor</th>
              <th>Categoría</th>
              <th>Cuándo</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.customer_first} {b.customer_last}
                </td>
                <td>
                  {b.provider_first} {b.provider_last}
                </td>
                <td>{b.category_name}</td>
                <td>{b.timing === "now" ? "Inmediato" : formatDate(b.scheduled_for)}</td>
                <td>{formatMoney(b.total_amount, b.currency)}</td>
                <td>
                  <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL_ES[b.status] ?? b.status} />
                </td>
                <td>{formatDate(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
