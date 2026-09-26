import Link from "next/link";
import { ChevronDown, Library, Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createCourse } from "@/server/admin/courses";
import { ClassesTabs } from "@/components/shell/section-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type Row = { id: string; code: string; name: string; classes: { id: string }[] };

export const metadata = { title: "Cursos" };

export default async function CoursesPage({ params }: PageProps<"/s/[schoolSlug]/admin/courses">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("courses")
    .select("id, code, name, classes:class_sections(id)")
    .eq("school_id", access.school.id)
    .order("code")
    .returns<Row[]>();
  if (error) throw new Error(error.message);
  const courses = data ?? [];

  return (
    <div className="stack-lg">
      <PageHeader title="Clases" subtitle="Un curso es la materia (p. ej. “Matemáticas 10”); las clases son los grupos que se reúnen con horario." />
      <ClassesTabs slug={schoolSlug} active="courses" />

      <details className="disclosure card" style={{ padding: 0 }} open={courses.length === 0 || undefined}>
        <summary>
          <span className="kpi-icon tone-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <Plus size={16} />
          </span>
          Agregar un curso
          <ChevronDown size={18} className="chev" />
        </summary>
        <div className="disclosure-body">
          <ActionForm action={createCourse} submitLabel="Agregar curso" resetOnSuccess>
            <SchoolSlugInput slug={schoolSlug} />
            <div className="form-grid">
              <label>
                Código
                <input name="code" required maxLength={32} placeholder="MAT10" />
              </label>
              <label>
                Nombre
                <input name="name" required maxLength={200} placeholder="Matemáticas 10" />
              </label>
              <label>
                Descripción (opcional)
                <input name="description" maxLength={1000} />
              </label>
            </div>
          </ActionForm>
        </div>
      </details>

      <Card title={`Cursos (${courses.length})`} flush>
        {courses.length === 0 ? (
          <EmptyState icon={Library} title="Aún no hay cursos" compact />
        ) : (
          <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1.35rem" }}>Código</th>
                  <th>Nombre</th>
                  <th className="num" style={{ paddingRight: "1.35rem" }}>
                    Clases
                  </th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td style={{ paddingLeft: "1.35rem" }}>
                      <span className="badge info mono">{c.code}</span>
                    </td>
                    <td>
                      <Link className="cell-title" href={`/s/${schoolSlug}/admin/courses/${c.id}`}>
                        {c.name}
                      </Link>
                    </td>
                    <td className="num" style={{ paddingRight: "1.35rem" }}>
                      {c.classes.length}
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
