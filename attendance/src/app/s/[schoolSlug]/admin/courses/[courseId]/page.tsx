import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { updateCourse } from "@/server/admin/courses";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type Course = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  classes: { id: string; name: string }[];
};

export default async function CoursePage({ params }: PageProps<"/s/[schoolSlug]/admin/courses/[courseId]">) {
  const { schoolSlug, courseId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, name, description, classes:class_sections(id, name)")
    .eq("school_id", access.school.id)
    .eq("id", courseId)
    .returns<Course[]>()
    .maybeSingle();
  if (!course) notFound();
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack-lg">
      <PageHeader back={{ href: `${base}/courses`, label: "Cursos" }} title={course.name} subtitle={`Código ${course.code}`} />
      <div className="grid-main">
        <Card title="Datos del curso">
          <ActionForm action={updateCourse} submitLabel="Guardar">
            <SchoolSlugInput slug={schoolSlug} />
            <input type="hidden" name="courseId" value={course.id} />
            <div className="form-grid">
              <label>
                Código
                <input name="code" defaultValue={course.code} required maxLength={32} />
              </label>
              <label>
                Nombre
                <input name="name" defaultValue={course.name} required maxLength={200} />
              </label>
              <label>
                Descripción
                <input name="description" defaultValue={course.description ?? ""} maxLength={1000} />
              </label>
            </div>
          </ActionForm>
        </Card>
        <Card title="Clases de este curso">
          {course.classes.length === 0 ? (
            <EmptyState icon={BookOpen} title="Ninguna todavía" compact action={<Link className="button secondary" href={`${base}/classes`}>Crear una clase</Link>} />
          ) : (
            <ul className="list">
              {course.classes.map((c) => (
                <li key={c.id} className="list-item">
                  <span className="feed-icon tone-blue">
                    <BookOpen size={15} />
                  </span>
                  <Link className="cell-title" href={`${base}/classes/${c.id}`}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
