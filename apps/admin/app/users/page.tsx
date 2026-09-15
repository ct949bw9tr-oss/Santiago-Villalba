import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { formatDate } from "../../lib/format";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  country_code: string;
  is_provider: boolean;
  created_at: string;
  completed_bookings: number;
}

async function getUsers(): Promise<UserRow[]> {
  return query<UserRow>(`
    select u.id, u.first_name, u.last_name, u.phone, u.email, u.country_code, u.is_provider, u.created_at,
      (select count(*) from bookings b where b.customer_id = u.id and b.status = 'completed') as completed_bookings
    from users u
    where u.is_provider = false
    order by u.created_at desc
  `);
}

export default async function UsersPage() {
  const users = await getUsers();
  return (
    <>
      <PageHeader title="Usuarios" subtitle={`${users.length} clientes registrados`} />
      <div className="card">
        {users.length === 0 ? (
          <p className="empty">No hay usuarios todavía.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>País</th>
                <th>Servicios completados</th>
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="row-inline">
                      <span className="avatar">
                        {u.first_name[0]}
                        {u.last_name[0]}
                      </span>
                      {u.first_name} {u.last_name}
                    </span>
                  </td>
                  <td>{u.phone ?? u.email ?? "—"}</td>
                  <td>{u.country_code}</td>
                  <td>{u.completed_bookings}</td>
                  <td>{formatDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
