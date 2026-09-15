import { query } from "../../lib/db";
import { PageHeader } from "../../components/PageHeader";
import { updateFee } from "./actions";

export const dynamic = "force-dynamic";

interface FeeRow {
  id: string;
  country_code: string;
  country_name: string;
  category_name: string | null;
  customer_fee_percent: string;
  provider_commission_percent: string;
  min_fee_amount: string;
  max_fee_amount: string | null;
}

async function getFees(): Promise<FeeRow[]> {
  return query<FeeRow>(`
    select f.id, f.country_code, c.name as country_name, cat.name as category_name,
      f.customer_fee_percent, f.provider_commission_percent, f.min_fee_amount, f.max_fee_amount
    from platform_fees f
    join countries c on c.country_code = f.country_code
    left join categories cat on cat.id = f.category_id
    order by f.country_code
  `);
}

export default async function FeesPage() {
  const fees = await getFees();
  return (
    <>
      <PageHeader
        title="Comisiones"
        subtitle="Configura la tarifa de servicio al cliente y la comisión del proveedor por país, sin publicar una nueva versión de la app"
      />
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>País</th>
              <th>Categoría</th>
              <th>Tarifa al cliente (%)</th>
              <th>Comisión proveedor (%)</th>
              <th>Tarifa mínima</th>
              <th>Tarifa máxima</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fees.map((f) => {
              const formId = `fee-form-${f.id}`;
              return (
                <tr key={f.id}>
                  <td>{f.country_name}</td>
                  <td>{f.category_name ?? "Todas"}</td>
                  <td>
                    <input form={formId} className="input" name="customer_fee_percent" type="number" step="0.1" defaultValue={f.customer_fee_percent} />
                  </td>
                  <td>
                    <input
                      form={formId}
                      className="input"
                      name="provider_commission_percent"
                      type="number"
                      step="0.1"
                      defaultValue={f.provider_commission_percent}
                    />
                  </td>
                  <td>
                    <input form={formId} className="input" name="min_fee_amount" type="number" defaultValue={f.min_fee_amount} />
                  </td>
                  <td>
                    <input form={formId} className="input" name="max_fee_amount" type="number" defaultValue={f.max_fee_amount ?? ""} />
                  </td>
                  <td>
                    {/* This empty <form> just supplies the action; its inputs live in the row's cells via the `form` attribute above,
                       since HTML doesn't allow a <form> to be the direct parent of multiple <td> siblings inside a <tr>. */}
                    <form id={formId} action={updateFee.bind(null, f.id)} />
                    <button form={formId} className="btn btn-primary" type="submit">
                      Guardar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
