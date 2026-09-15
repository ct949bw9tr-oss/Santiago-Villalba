import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { formatDate } from "../../lib/format";

export const dynamic = "force-dynamic";

interface ReviewRow {
  id: string;
  rating_overall: number;
  comment: string | null;
  created_at: string;
  author_first: string;
  author_last: string;
  subject_first: string;
  subject_last: string;
  direction: string;
}

async function getReviews(): Promise<ReviewRow[]> {
  return query<ReviewRow>(`
    select r.id, r.rating_overall, r.comment, r.created_at, r.direction,
      au.first_name as author_first, au.last_name as author_last,
      su.first_name as subject_first, su.last_name as subject_last
    from reviews r
    join users au on au.id = r.author_id
    join users su on su.id = r.subject_id
    order by r.created_at desc
    limit 100
  `);
}

export default async function ReviewsPage() {
  const reviews = await getReviews();
  return (
    <>
      <PageHeader title="Reseñas" subtitle={`${reviews.length} reseñas publicadas`} />
      <div className="card">
        {reviews.length === 0 ? (
          <p className="empty">No hay reseñas todavía.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Autor</th>
                <th>Sobre</th>
                <th>Calificación</th>
                <th>Comentario</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.author_first} {r.author_last}
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {r.direction === "customer_to_provider" ? "Cliente → Proveedor" : "Proveedor → Cliente"}
                    </div>
                  </td>
                  <td>
                    {r.subject_first} {r.subject_last}
                  </td>
                  <td>{"★".repeat(r.rating_overall)}</td>
                  <td>{r.comment ?? "—"}</td>
                  <td>{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
