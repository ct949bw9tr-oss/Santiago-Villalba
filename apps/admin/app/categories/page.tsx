import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";

export const dynamic = "force-dynamic";

interface CategoryRow {
  id: string;
  name: string;
  name_en: string;
  icon: string;
  subcategory_count: number;
  service_count: number;
  provider_count: number;
}

async function getCategories(): Promise<CategoryRow[]> {
  return query<CategoryRow>(`
    select c.id, c.name, c.name_en, c.icon,
      (select count(*) from subcategories sc where sc.category_id = c.id) as subcategory_count,
      (select count(*) from services s join subcategories sc on sc.id = s.subcategory_id where sc.category_id = c.id) as service_count,
      (select count(distinct ps.provider_id) from provider_services ps
        join services s on s.id = ps.service_id
        join subcategories sc on sc.id = s.subcategory_id
        where sc.category_id = c.id) as provider_count
    from categories c
    order by c.sort_order
  `);
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <>
      <PageHeader title="Categorías" subtitle="Catálogo de servicios de TaskSwift. Nuevas categorías se agregan sin publicar una nueva versión de la app." />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Nombre (EN)</th>
              <th>Subcategorías</th>
              <th>Servicios</th>
              <th>Proveedores activos</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.name_en}</td>
                <td>{c.subcategory_count}</td>
                <td>{c.service_count}</td>
                <td>{c.provider_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
