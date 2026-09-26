import { CalendarCheck } from "lucide-react";
import { attendanceRate, fmtDate, fmtRate, fmtTime, STATUS_LABEL } from "@/lib/ui/format";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, Donut } from "@/components/ui/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";

type RecordRow = {
  id: string;
  status: "present" | "late" | "absent" | "excused";
  checked_in_at: string | null;
  session: { starts_at: string; class: { name: string } | null } | null;
};

export const metadata = { title: "Mi asistencia" };

export default async function StudentAttendance({ params }: PageProps<"/s/[schoolSlug]/student">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "student");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, first_name, last_name, student_number, grade_level")
    .eq("school_id", access.school.id)
    .eq("user_id", access.user.id)
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);

  let records: RecordRow[] = [];
  if (student) {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, status, checked_in_at, session:class_sessions!inner(starts_at, class:class_sections!inner(name))")
      .eq("school_id", access.school.id)
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<RecordRow[]>();
    if (error) throw new Error(error.message);
    records = data ?? [];
  }

  const count = (st: RecordRow["status"]) => records.filter((r) => r.status === st).length;
  const c = { present: count("present"), late: count("late"), absent: count("absent"), excused: count("excused") };
  const rate = attendanceRate(c);
  const colors = { present: CHART_COLORS.green, late: CHART_COLORS.orange, absent: CHART_COLORS.red, excused: CHART_COLORS.violet };

  return (
    <div className="stack-lg">
      {!student ? (
        <Card>
          <EmptyState icon={CalendarCheck} title="Tu cuenta aún no está vinculada a un estudiante">
            Pide a la administración del colegio que la vincule.
          </EmptyState>
        </Card>
      ) : (
        <>
          <section className="card profile-hero">
            <Avatar first={student.first_name} last={student.last_name} id={student.id} size="lg" />
            <div className="grow">
              <h1>
                {student.first_name} {student.last_name}
              </h1>
              <div className="meta-row">
                <span>{student.student_number}</span>
                {student.grade_level && <span>Grado {student.grade_level}</span>}
              </div>
            </div>
          </section>

          <div className="grid-side">
            <Card title="Mi asistencia">
              <div className="donut-wrap">
                <Donut
                  size={140}
                  center={fmtRate(rate)}
                  sub="asistencia"
                  segments={(["present", "late", "absent", "excused"] as const).map((k) => ({ value: c[k], color: colors[k], label: STATUS_LABEL[k] }))}
                />
                <div className="legend-list">
                  {(["present", "late", "absent", "excused"] as const).map((k) => (
                    <div key={k} className="legend-row">
                      <i style={{ background: colors[k] }} />
                      {STATUS_LABEL[k]}
                      <strong>{c[k]}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title="Historial" flush>
              {records.length === 0 ? (
                <EmptyState icon={CalendarCheck} title="Aún no hay asistencia registrada" compact />
              ) : (
                <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
                  <table className="stack-mobile">
                    <thead>
                      <tr>
                        <th style={{ paddingLeft: "1.35rem" }}>Fecha</th>
                        <th>Clase</th>
                        <th>Estado</th>
                        <th>Llegada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td style={{ paddingLeft: "1.35rem" }} className="cell-title">
                            {r.session ? fmtDate(r.session.starts_at, tz) : "—"}
                          </td>
                          <td data-label="Clase">{r.session?.class?.name}</td>
                          <td data-label="Estado">
                            <StatusBadge status={r.status} />
                          </td>
                          <td data-label="Llegada">{r.checked_in_at ? fmtTime(r.checked_in_at, tz) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
