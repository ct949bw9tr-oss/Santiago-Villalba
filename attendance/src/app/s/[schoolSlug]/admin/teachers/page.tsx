import { ChevronDown, Presentation, UserPlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { inviteTeacher } from "@/server/admin/teachers";
import { ClassesTabs } from "@/components/shell/section-tabs";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/status-badge";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string | null;
  status: string;
  classes: { id: string }[];
};

export const metadata = { title: "Docentes" };

export default async function TeachersPage({ params }: PageProps<"/s/[schoolSlug]/admin/teachers">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("id, first_name, last_name, employee_number, status, classes:class_teachers(id)")
    .eq("school_id", access.school.id)
    .order("last_name")
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const teachers = data ?? [];
  const base = `/s/${schoolSlug}/admin/teachers`;

  return (
    <div className="stack-lg">
      <PageHeader title="Clases" subtitle="Docentes del colegio y sus clases asignadas." />
      <ClassesTabs slug={schoolSlug} active="teachers" />

      <details className="disclosure card" style={{ padding: 0 }} open={teachers.length === 0 || undefined}>
        <summary>
          <span className="kpi-icon tone-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <UserPlus size={16} />
          </span>
          Agregar docente
          <ChevronDown size={18} className="chev" />
        </summary>
        <div className="disclosure-body stack">
          <p className="hint">
            Crea su cuenta y te da un enlace de acceso de un solo uso para enviárselo (WhatsApp, correo…). Al abrirlo, elige su contraseña.
          </p>
          <ActionForm action={inviteTeacher} submitLabel="Agregar docente" resetOnSuccess>
            <SchoolSlugInput slug={schoolSlug} />
            <div className="form-grid">
              <label>
                Correo
                <input name="email" type="email" required maxLength={320} autoCapitalize="none" autoComplete="off" />
              </label>
              <label>
                Nombres
                <input name="first_name" required maxLength={100} />
              </label>
              <label>
                Apellidos
                <input name="last_name" required maxLength={100} />
              </label>
              <label>
                N.º de empleado (opcional)
                <input name="employee_number" maxLength={64} />
              </label>
            </div>
          </ActionForm>
        </div>
      </details>

      <Card title={`Docentes (${teachers.length})`} flush>
        {teachers.length === 0 ? (
          <EmptyState icon={Presentation} title="Aún no hay docentes" compact />
        ) : (
          <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1.35rem" }}>Docente</th>
                  <th>N.º empleado</th>
                  <th className="num">Clases</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td style={{ paddingLeft: "1.35rem" }}>
                      <Person first={t.first_name} last={t.last_name} id={t.id} href={`${base}/${t.id}`} />
                    </td>
                    <td data-label="N.º empleado">{t.employee_number ?? <span className="muted">—</span>}</td>
                    <td data-label="Clases" className="num">
                      {t.classes.length}
                    </td>
                    <td data-label="Estado">
                      <Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status === "active" ? "Activo" : "Inactivo"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
