import Link from "next/link";
import { BookOpen, CalendarClock, ChevronDown, DoorOpen, Plus, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createClass } from "@/server/admin/classes";
import { ClassesTabs } from "@/components/shell/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/status-badge";

type Row = {
  id: string;
  name: string;
  room: string | null;
  status: string;
  course: { code: string; name: string };
  teachers: { teacher: { first_name: string; last_name: string } }[];
  enrollments: { withdrawn_on: string | null }[];
  schedules: { id: string }[];
};

export const metadata = { title: "Clases" };

export default async function ClassesPage({ params }: PageProps<"/s/[schoolSlug]/admin/classes">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const [{ data, error }, { data: courses }] = await Promise.all([
    supabase
      .from("class_sections")
      .select(
        "id, name, room, status, course:courses!inner(code, name), teachers:class_teachers(teacher:teachers!inner(first_name, last_name)), enrollments(withdrawn_on), schedules:class_schedules(id)",
      )
      .eq("school_id", access.school.id)
      .order("name")
      .returns<Row[]>(),
    supabase.from("courses").select("id, code, name").eq("school_id", access.school.id).order("code"),
  ]);
  if (error) throw new Error(error.message);
  const classes = data ?? [];
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack-lg">
      <PageHeader title="Clases" subtitle="Grupos que se reúnen según un horario semanal, con su docente y estudiantes." />
      <ClassesTabs slug={schoolSlug} active="classes" />

      <details className="disclosure card" style={{ padding: 0 }} open={classes.length === 0 || undefined}>
        <summary>
          <span className="kpi-icon tone-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <Plus size={16} />
          </span>
          Crear una clase
          <ChevronDown size={18} className="chev" />
        </summary>
        <div className="disclosure-body">
          {(courses ?? []).length === 0 ? (
            <p className="muted">
              Primero <Link href={`${base}/courses`}>crea un curso</Link> (la materia) y luego sus clases aquí.
            </p>
          ) : (
            <ActionForm action={createClass} submitLabel="Crear clase">
              <SchoolSlugInput slug={schoolSlug} />
              <div className="form-grid">
                <label>
                  Curso
                  <select name="course_id" required defaultValue="">
                    <option value="" disabled>
                      Elegir…
                    </option>
                    {(courses ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nombre de la clase
                  <input name="name" required maxLength={200} placeholder="Matemáticas 10A" />
                </label>
                <label>
                  Salón (opcional)
                  <input name="room" maxLength={64} placeholder="201" />
                </label>
              </div>
            </ActionForm>
          )}
        </div>
      </details>

      {classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={BookOpen} title="Aún no hay clases">
            Crea la primera clase con el formulario de arriba.
          </EmptyState>
        </div>
      ) : (
        <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))" }}>
          {classes.map((c) => {
            const students = c.enrollments.filter((e) => !e.withdrawn_on).length;
            return (
              <Link key={c.id} href={`${base}/classes/${c.id}`} className="card card-hover stack" style={{ color: "var(--text)" }}>
                <div className="row-between">
                  <span className="kpi-icon tone-blue">
                    <BookOpen size={19} />
                  </span>
                  <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status === "active" ? "Activa" : "Archivada"}</Badge>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.02rem" }}>{c.name}</h3>
                  <div className="cell-sub">
                    {c.course.code} · {c.course.name}
                  </div>
                </div>
                <div className="stat-row">
                  <span className="inline" style={{ gap: 4 }}>
                    <Users size={14} /> <b>{students}</b> estudiantes
                  </span>
                  <span className="inline" style={{ gap: 4 }}>
                    <CalendarClock size={14} /> <b>{c.schedules.length}</b> franjas/sem
                  </span>
                  {c.room && (
                    <span className="inline" style={{ gap: 4 }}>
                      <DoorOpen size={14} /> {c.room}
                    </span>
                  )}
                </div>
                <div className="small-text text-2" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.7rem" }}>
                  {c.teachers.length === 0 ? (
                    <span style={{ color: "var(--warning)" }}>Sin docente asignado</span>
                  ) : (
                    c.teachers.map((t) => `${t.teacher.first_name} ${t.teacher.last_name}`).join(", ")
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
