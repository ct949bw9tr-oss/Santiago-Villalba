import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { formatDate } from "../../lib/format";

export const dynamic = "force-dynamic";

interface DisputeRow {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  booking_id: string;
  raised_by_first: string;
  raised_by_last: string;
}

async function getDisputes(): Promise<DisputeRow[]> {
  return query<DisputeRow>(`
    select d.id, d.reason, d.status, d.created_at, d.booking_id, u.first_name as raised_by_first, u.last_name as raised_by_last
    from disputes d
    join users u on u.id = d.raised_by
    order by d.created_at desc
  `);
}

export default async function DisputesPage() {
  const disputes = await getDisputes();
  return (
    <>
      <PageHeader title="Disputas" subtitle={`${disputes.length} disputas registradas`} />
      <div className="card">
        {disputes.length === 0 ? (
          <p className="empty">No hay disputas abiertas. 🎉</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reportado por</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.raised_by_first} {d.raised_by_last}
                  </td>
                  <td>{d.reason}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  <td>{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
