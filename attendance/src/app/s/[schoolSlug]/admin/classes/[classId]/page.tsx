import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronDown, Pencil, UserPlus, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { fmtDate, fmtTime, SESSION_STATUS_LABEL } from "@/lib/ui/format";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import {
  addClassTeacher,
  addSchedule,
  enrollStudents,
  generateSessions,
  removeClassTeacher,
  removeSchedule,
  setSessionStatus,
  unenrollStudent,
  updateClass,
} from "@/server/admin/classes";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/status-badge";

const WEEKDAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type ClassRow = { id: string; name: string; room: string | null; status: "active" | "archived"; course_id: string };
type Assignment = { id: string; role: string; teacher: { id: string; first_name: string; last_name: string } };
type Schedule = { id: string; weekday: number; start_time: string; end_time: string; room: string | null };
type Enrollment = {
  id: string;
  enrolled_on: string;
  student: { id: string; student_number: string; first_name: string; last_name: string };
};
type Session = { id: string; starts_at: string; ends_at: string; status: string; room: string | null };
type PersonRow = { id: string; first_name: string; last_name: string; student_number?: string };

export default async function ClassPage({ params }: PageProps<"/s/[schoolSlug]/admin/classes/[classId]">) {
  const { schoolSlug, classId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;

  const { data: cls } = await supabase
    .from("class_sections")
    .select("id, name, room, status, course_id")
    .eq("school_id", schoolId)
    .eq("id", classId)
    .returns<ClassRow[]>()
    .maybeSingle();
  if (!cls) notFound();

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [courses, assignments, allTeachers, schedules, enrollments, allStudents, sessions] = await Promise.all([
    supabase.from("courses").select("id, code, name").eq("school_id", schoolId).order("code"),
    supabase
      .from("class_teachers")
      .select("id, role, teacher:teachers!inner(id, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .returns<Assignment[]>(),
    supabase
      .from("teachers")
      .select("id, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("last_name")
      .returns<PersonRow[]>(),
    supabase
      .from("class_schedules")
      .select("id, weekday, start_time, end_time, room")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .order("weekday")
      .order("start_time")
      .returns<Schedule[]>(),
    supabase
      .from("enrollments")
      .select("id, enrolled_on, student:students!inner(id, student_number, first_name, last_name)")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .is("withdrawn_on", null)
      .returns<Enrollment[]>(),
    supabase
      .from("students")
      .select("id, student_number, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("last_name")
      .order("first_name")
      .returns<PersonRow[]>(),
    supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, status, room")
      .eq("school_id", schoolId)
      .eq("class_section_id", cls.id)
      .gte("starts_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lt("starts_at", horizon.toISOString())
      .order("starts_at")
      .returns<Session[]>(),
  ]);

  const assigned = new Set((assignments.data ?? []).map((a) => a.teacher.id));
  const assignable = (allTeachers.data ?? []).filter((t) => !assigned.has(t.id));
  const enrolledRows = (enrollments.data ?? []).sort((a, b) => a.student.last_name.localeCompare(b.student.last_name));
  const enrolledIds = new Set(enrolledRows.map((e) => e.student.id));
  const enrollable = (allStudents.data ?? []).filter((s) => !enrolledIds.has(s.id));
  const base = `/s/${schoolSlug}/admin`;
  const course = (courses.data ?? []).find((c) => c.id === cls.course_id);
  const hidden = (
    <>
      <SchoolSlugInput slug={schoolSlug} />
      <input type="hidden" name="classId" value={cls.id} />
    </>
  );

  return (
    <div className="stack-lg">
      <PageHeader
        back={{ href: `${base}/classes`, label: "Clases" }}
        title={
          <span className="inline" style={{ gap: "0.75rem" }}>
            {cls.name}
            <Badge tone={cls.status === "active" ? "success" : "neutral"}>{cls.status === "active" ? "Activa" : "Archivada"}</Badge>
          </span>
        }
        subtitle={[course ? `${course.code} · ${course.name}` : null, cls.room ? `Salón ${cls.room}` : null].filter(Boolean).join(" · ")}
        actions={
          <Link className="button secondary" href={`${base}/attendance?class=${cls.id}`}>
            Ver analytics
          </Link>
        }
      />

      <div className="grid-main">
        <div className="stack">
          <Card title={`Estudiantes (${enrolledRows.length})`}>
            {enrolledRows.length === 0 ? (
              <EmptyState icon={Users} title="Nadie inscrito todavía" compact />
            ) : (
              <ul className="list">
                {enrolledRows.map((e) => (
                  <li key={e.id} className="list-item">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <Person
                        first={e.student.first_name}
                        last={e.student.last_name}
                        id={e.student.id}
                        size="sm"
                        sub={`${e.student.student_number} · desde ${e.enrolled_on}`}
                        href={`${base}/students/${e.student.id}`}
                      />
                    </div>
                    <ActionForm
                      action={unenrollStudent}
                      submitLabel="Retirar"
                      variant="ghost"
                      className="inline small"
                      confirmText="¿Retirar a este estudiante de la clase?"
                      confirmLabel="Retirar"
                      quiet
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="enrollmentId" value={e.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            {enrollable.length > 0 ? (
              <details className="disclosure" style={{ marginTop: "1rem" }}>
                <summary>
                  <UserPlus size={16} /> Inscribir estudiantes ({enrollable.length} disponibles)
                  <ChevronDown size={16} className="chev" />
                </summary>
                <div className="disclosure-body">
                  <ActionForm action={enrollStudents} submitLabel="Inscribir seleccionados">
                    {hidden}
                    <div className="checklist" style={{ background: "var(--surface)" }}>
                      {enrollable.map((s) => (
                        <label key={s.id}>
                          <input type="checkbox" name="studentIds" value={s.id} />
                          {s.last_name}, {s.first_name} <span className="muted">{s.student_number}</span>
                        </label>
                      ))}
                    </div>
                  </ActionForm>
                </div>
              </details>
            ) : (
              (allStudents.data ?? []).length === 0 && (
                <p className="muted">
                  Primero <Link href={`${base}/students`}>agrega estudiantes</Link>.
                </p>
              )
            )}
          </Card>

          <Card
            title="Sesiones"
            subtitle="Últimas 24 horas y próximos 14 días"
            action={
              <ActionForm action={generateSessions} submitLabel="Regenerar sesiones" pendingLabel="Generando…" variant="secondary" className="inline small" quiet>
                <SchoolSlugInput slug={schoolSlug} />
              </ActionForm>
            }
            flush
          >
            {(sessions.data ?? []).length === 0 ? (
              <EmptyState icon={CalendarClock} title="No hay sesiones próximas" compact>
                Agrega una franja al horario semanal.
              </EmptyState>
            ) : (
              <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
                <table>
                  <tbody>
                    {(sessions.data ?? []).map((s) => (
                      <tr key={s.id}>
                        <td style={{ paddingLeft: "1.35rem" }}>
                          <Link className="cell-title" href={`/s/${schoolSlug}/sessions/${s.id}`}>
                            {fmtDate(s.starts_at, tz)}
                          </Link>
                          <div className="cell-sub">
                            {fmtTime(s.starts_at, tz)} – {fmtTime(s.ends_at, tz)}
                          </div>
                        </td>
                        <td>
                          <Badge tone={s.status === "cancelled" ? "danger" : s.status === "completed" ? "neutral" : "info"}>
                            {SESSION_STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right", paddingRight: "1.35rem" }}>
                          {s.status !== "completed" && (
                            <ActionForm
                              action={setSessionStatus}
                              submitLabel={s.status === "cancelled" ? "Restaurar" : "Cancelar"}
                              variant="ghost"
                              className="inline small"
                              confirmText={s.status === "cancelled" ? undefined : "¿Cancelar esta sesión (p. ej. festivo)?"}
                              confirmLabel="Cancelar sesión"
                              quiet
                            >
                              <SchoolSlugInput slug={schoolSlug} />
                              <input type="hidden" name="sessionId" value={s.id} />
                              <input type="hidden" name="status" value={s.status === "cancelled" ? "scheduled" : "cancelled"} />
                            </ActionForm>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Docentes">
            {(assignments.data ?? []).length === 0 ? (
              <div className="callout warning" style={{ marginBottom: "0.75rem" }}>
                <p>Esta clase no tiene docente asignado.</p>
              </div>
            ) : (
              <ul className="list" style={{ marginBottom: "0.75rem" }}>
                {(assignments.data ?? []).map((a) => (
                  <li key={a.id} className="list-item">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <Person
                        first={a.teacher.first_name}
                        last={a.teacher.last_name}
                        id={a.teacher.id}
                        size="sm"
                        sub={a.role === "primary" ? "Principal" : "Asistente"}
                        href={`${base}/teachers/${a.teacher.id}`}
                      />
                    </div>
                    <ActionForm
                      action={removeClassTeacher}
                      submitLabel="Quitar"
                      variant="ghost"
                      className="inline small"
                      confirmText="¿Quitar a este docente de la clase?"
                      confirmLabel="Quitar"
                      quiet
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="assignmentId" value={a.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            {assignable.length > 0 ? (
              <ActionForm action={addClassTeacher} submitLabel="Asignar" className="stack-sm">
                {hidden}
                <div className="form-grid">
                  <select name="teacherId" required defaultValue="" aria-label="Docente">
                    <option value="" disabled>
                      Elegir docente…
                    </option>
                    {assignable.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.last_name}, {t.first_name}
                      </option>
                    ))}
                  </select>
                  <select name="role" defaultValue="primary" aria-label="Rol">
                    <option value="primary">Principal</option>
                    <option value="assistant">Asistente</option>
                  </select>
                </div>
              </ActionForm>
            ) : (
              (allTeachers.data ?? []).length === 0 && (
                <p className="muted">
                  Primero <Link href={`${base}/teachers`}>agrega docentes</Link>.
                </p>
              )
            )}
          </Card>

          <Card title="Horario semanal" subtitle={`Hora del colegio (${tz})`}>
            {(schedules.data ?? []).length === 0 ? (
              <EmptyState icon={CalendarClock} title="Sin franjas todavía" compact />
            ) : (
              <ul className="list">
                {(schedules.data ?? []).map((s) => (
                  <li key={s.id} className="list-item">
                    <span className="feed-icon tone-blue">
                      <CalendarClock size={15} />
                    </span>
                    <div className="grow">
                      <div className="cell-title small-text">{WEEKDAYS[s.weekday]}</div>
                      <div className="cell-sub">
                        {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        {s.room && ` · ${s.room}`}
                      </div>
                    </div>
                    <ActionForm
                      action={removeSchedule}
                      submitLabel="Quitar"
                      variant="ghost"
                      className="inline small"
                      confirmText="¿Quitar esta franja? Se borrarán sus sesiones futuras sin asistencia."
                      confirmLabel="Quitar franja"
                      quiet
                    >
                      <SchoolSlugInput slug={schoolSlug} />
                      <input type="hidden" name="scheduleId" value={s.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
            <details className="disclosure" style={{ marginTop: "1rem" }}>
              <summary>
                Agregar franja <ChevronDown size={16} className="chev" />
              </summary>
              <div className="disclosure-body">
                <ActionForm action={addSchedule} submitLabel="Agregar franja">
                  {hidden}
                  <div className="form-grid">
                    <label>
                      Día
                      <select name="weekday" defaultValue="1">
                        {WEEKDAYS.slice(1).map((d, i) => (
                          <option key={d} value={i + 1}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Inicia
                      <input name="start_time" type="time" required defaultValue="07:30" />
                    </label>
                    <label>
                      Termina
                      <input name="end_time" type="time" required defaultValue="08:30" />
                    </label>
                    <label>
                      Salón (opcional)
                      <input name="room" maxLength={64} placeholder={cls.room ?? ""} />
                    </label>
                  </div>
                  <p className="hint">Las sesiones se crean para las próximas 4 semanas y se extienden automáticamente cada día.</p>
                </ActionForm>
              </div>
            </details>
          </Card>

          <details className="disclosure card" style={{ padding: 0 }}>
            <summary>
              <Pencil size={16} /> Editar clase
              <ChevronDown size={18} className="chev" />
            </summary>
            <div className="disclosure-body">
              <ActionForm action={updateClass} submitLabel="Guardar">
                {hidden}
                <div className="form-grid">
                  <label>
                    Curso
                    <select name="course_id" defaultValue={cls.course_id} required>
                      {(courses.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nombre
                    <input name="name" defaultValue={cls.name} required maxLength={200} />
                  </label>
                  <label>
                    Salón
                    <input name="room" defaultValue={cls.room ?? ""} maxLength={64} />
                  </label>
                  <label>
                    Estado
                    <select name="status" defaultValue={cls.status}>
                      <option value="active">Activa</option>
                      <option value="archived">Archivada (sin nuevas sesiones)</option>
                    </select>
                  </label>
                </div>
              </ActionForm>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
