import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Mail } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { teacherSignInLink, updateTeacher } from "@/server/admin/teachers";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/status-badge";

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string | null;
  status: "active" | "inactive";
  profile: { email: string | null } | null;
  classes: { id: string; role: string; class: { id: string; name: string } }[];
};

export default async function TeacherPage({ params }: PageProps<"/s/[schoolSlug]/admin/teachers/[teacherId]">) {
  const { schoolSlug, teacherId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select(
      "id, first_name, last_name, employee_number, status, profile:profiles(email), classes:class_teachers(id, role, class:class_sections!inner(id, name))",
    )
    .eq("school_id", access.school.id)
    .eq("id", teacherId)
    .returns<Teacher[]>()
    .maybeSingle();
  if (!teacher) notFound();
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack-lg">
      <PageHeader back={{ href: `${base}/teachers`, label: "Docentes" }} title="Perfil del docente" />

      <section className="card profile-hero">
        <Avatar first={teacher.first_name} last={teacher.last_name} id={teacher.id} size="xl" />
        <div className="grow">
          <div className="inline">
            <h1>
              {teacher.first_name} {teacher.last_name}
            </h1>
            <Badge tone={teacher.status === "active" ? "success" : "neutral"}>{teacher.status === "active" ? "Activo" : "Inactivo"}</Badge>
          </div>
          <div className="meta-row">
            {teacher.profile?.email && (
              <span>
                <Mail size={14} /> {teacher.profile.email}
              </span>
            )}
            <span>
              <BookOpen size={14} /> {teacher.classes.length} {teacher.classes.length === 1 ? "clase" : "clases"}
            </span>
            {teacher.employee_number && <span>Empleado {teacher.employee_number}</span>}
          </div>
        </div>
      </section>

      <div className="grid-main">
        <div className="stack">
          <Card title="Datos">
            <ActionForm action={updateTeacher} submitLabel="Guardar">
              <SchoolSlugInput slug={schoolSlug} />
              <input type="hidden" name="teacherId" value={teacher.id} />
              <div className="form-grid">
                <label>
                  Nombres
                  <input name="first_name" defaultValue={teacher.first_name} required maxLength={100} />
                </label>
                <label>
                  Apellidos
                  <input name="last_name" defaultValue={teacher.last_name} required maxLength={100} />
                </label>
                <label>
                  N.º de empleado
                  <input name="employee_number" defaultValue={teacher.employee_number ?? ""} maxLength={64} />
                </label>
                <label>
                  Estado
                  <select name="status" defaultValue={teacher.status}>
                    <option value="active">Activo (puede ingresar)</option>
                    <option value="inactive">Inactivo (acceso bloqueado)</option>
                  </select>
                </label>
              </div>
            </ActionForm>
          </Card>
          <Card title="Enlace de acceso" subtitle="Si perdió la invitación u olvidó su contraseña, crea un nuevo enlace de un solo uso y envíaselo.">
            <ActionForm action={teacherSignInLink} submitLabel="Crear enlace de acceso" variant="secondary">
              <SchoolSlugInput slug={schoolSlug} />
              <input type="hidden" name="teacherId" value={teacher.id} />
            </ActionForm>
          </Card>
        </div>
        <Card title="Clases">
          {teacher.classes.length === 0 ? (
            <EmptyState icon={BookOpen} title="Sin clases asignadas" compact>
              Asigna docentes desde la página de cada clase.
            </EmptyState>
          ) : (
            <ul className="list">
              {teacher.classes.map((c) => (
                <li key={c.id} className="list-item">
                  <span className="feed-icon tone-blue">
                    <BookOpen size={15} />
                  </span>
                  <Link className="cell-title grow" href={`${base}/classes/${c.class.id}`}>
                    {c.class.name}
                  </Link>
                  <Badge tone="neutral">{c.role === "primary" ? "Principal" : "Asistente"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
