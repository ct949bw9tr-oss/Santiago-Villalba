import Link from "next/link";
import { AlertTriangle, ChevronDown, CreditCard, Eye, GraduationCap, Search, UserPlus, Users } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { addDays } from "@/lib/reports/filters";
import { localDateKey } from "@/lib/time";
import { RISK_LABEL, riskLevel, STUDENT_STATUS_LABEL, type Risk } from "@/lib/ui/format";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { createStudent } from "@/server/admin/students";
import type { StudentSummary } from "@/server/reports/queries";
import { Person } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { RateCell } from "@/components/ui/rate";
import { Badge, type BadgeTone } from "@/components/ui/status-badge";

type Row = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  status: string;
  cards: { status: string }[];
  enrollments: { class_section_id: string; withdrawn_on: string | null }[];
};

const RISK_TONE: Record<Risk, BadgeTone> = { ok: "success", watch: "warning", risk: "danger", none: "neutral" };
const STATUS_TONE: Record<string, BadgeTone> = { active: "success", inactive: "neutral", graduated: "info", withdrawn: "neutral" };

export const metadata = { title: "Estudiantes" };

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) ?? "";
}

export default async function StudentsPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/admin/students">) {
  const { schoolSlug } = await params;
  const sp = await searchParams;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const search = one(sp.q);
  const grade = one(sp.grade);
  const classId = one(sp.class);
  const status = one(sp.status);
  const risk = one(sp.risk) as Risk | "";
  const card = one(sp.card);
  const today = localDateKey(new Date(), access.school.timezone);

  let query = supabase
    .from("students")
    .select(
      "id, student_number, first_name, last_name, grade_level, status, cards:nfc_credentials(status), enrollments(class_section_id, withdrawn_on)",
    )
    .eq("school_id", schoolId)
    .order("last_name")
    .order("first_name")
    .limit(500);
  if (search) {
    // Strip PostgREST filter syntax characters from user input.
    const term = search.replace(/[,()*%]/g, " ");
    query = query.or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,student_number.ilike.*${term}*`);
  }
  const [{ data, error }, { data: classes }, summary] = await Promise.all([
    query.returns<Row[]>(),
    supabase.from("class_sections").select("id, name").eq("school_id", schoolId).order("name"),
    supabase.rpc("attendance_summary_by_student", {
      p_school_id: schoolId,
      p_from: addDays(today, -29),
      p_to: today,
      p_class_section_id: null,
    }),
  ]);
  if (error) throw new Error(error.message);
  if (summary.error) throw new Error(summary.error.message);

  const stats = new Map(((summary.data ?? []) as StudentSummary[]).map((s) => [s.student_id, s]));
  const all = (data ?? []).map((s) => {
    const st = stats.get(s.id);
    const rate = st?.attendance_rate === null || st?.attendance_rate === undefined ? null : Number(st.attendance_rate);
    const late = Number(st?.late ?? 0);
    return {
      ...s,
      rate,
      late,
      absent: Number(st?.absent ?? 0),
      risk: riskLevel(rate, late),
      hasCard: s.cards.some((c) => c.status === "active"),
      classIds: s.enrollments.filter((e) => !e.withdrawn_on).map((e) => e.class_section_id),
    };
  });
  const grades = [...new Set(all.map((s) => s.grade_level).filter((g): g is string => !!g))].sort();
  const students = all.filter(
    (s) =>
      (!grade || s.grade_level === grade) &&
      (!classId || s.classIds.includes(classId)) &&
      (!status || s.status === status) &&
      (!risk || s.risk === risk) &&
      (card !== "none" || (!s.hasCard && s.status === "active")),
  );
  const base = `/s/${schoolSlug}/admin/students`;
  const active = all.filter((s) => s.status === "active");
  const filtered = Boolean(search || grade || classId || status || risk || card);

  const quick = [
    { label: "Estudiantes activos", value: active.length, icon: Users, tone: "tone-blue", href: `${base}?status=active` },
    { label: "En riesgo", value: active.filter((s) => s.risk === "risk").length, icon: AlertTriangle, tone: "tone-red", href: `${base}?risk=risk` },
    { label: "En observación", value: active.filter((s) => s.risk === "watch").length, icon: Eye, tone: "tone-orange", href: `${base}?risk=watch` },
    { label: "Sin tarjeta NFC", value: active.filter((s) => !s.hasCard).length, icon: CreditCard, tone: "tone-violet", href: `${base}?card=none` },
  ];

  return (
    <div className="stack-lg">
      <PageHeader title="Estudiantes" subtitle="Directorio, asistencia de los últimos 30 días y alertas." />

      <section className="grid-kpi">
        {quick.map((q) => (
          <Link key={q.label} href={q.href} className="card card-hover row" style={{ color: "var(--text)" }}>
            <span className={`kpi-icon ${q.tone}`}>
              <q.icon size={19} />
            </span>
            <div>
              <div className="kpi-value" style={{ fontSize: "1.45rem" }}>
                {q.value}
              </div>
              <div className="kpi-label" style={{ marginTop: 2 }}>
                {q.label}
              </div>
            </div>
          </Link>
        ))}
      </section>

      <details className="disclosure card" style={{ padding: 0 }}>
        <summary>
          <span className="kpi-icon tone-blue" style={{ width: 32, height: 32, borderRadius: 9 }}>
            <UserPlus size={16} />
          </span>
          Agregar estudiante
          <ChevronDown size={18} className="chev" />
        </summary>
        <div className="disclosure-body">
          <ActionForm action={createStudent} submitLabel="Agregar estudiante" resetOnSuccess>
            <SchoolSlugInput slug={schoolSlug} />
            <div className="form-grid">
              <label>
                Código / ID
                <input name="student_number" required maxLength={64} />
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
                Grado
                <input name="grade_level" maxLength={32} placeholder="Ej. 10A" />
              </label>
            </div>
          </ActionForm>
        </div>
      </details>

      <section className="card stack">
        <form className="filter-bar" action={base}>
          <div className="search">
            <Search size={17} />
            <input name="q" type="search" defaultValue={search} placeholder="Buscar por nombre o código" aria-label="Buscar" />
          </div>
          <label>
            Grado
            <select name="grade" defaultValue={grade}>
              <option value="">Todos</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            Clase
            <select name="class" defaultValue={classId}>
              <option value="">Todas</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select name="status" defaultValue={status}>
              <option value="">Todos</option>
              {Object.entries(STUDENT_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Riesgo
            <select name="risk" defaultValue={risk}>
              <option value="">Todos</option>
              <option value="risk">En riesgo</option>
              <option value="watch">En observación</option>
              <option value="ok">Sin alertas</option>
              <option value="none">Sin datos</option>
            </select>
          </label>
          {card === "none" && <input type="hidden" name="card" value="none" />}
          <div className="inline">
            <button type="submit">Filtrar</button>
            {filtered && (
              <Link href={base} className="button ghost">
                Limpiar
              </Link>
            )}
          </div>
        </form>

        <div className="row-between">
          <h2 style={{ margin: 0 }}>
            {students.length} {students.length === 1 ? "estudiante" : "estudiantes"}
            {card === "none" && <span className="muted"> · sin tarjeta NFC</span>}
          </h2>
          <span className="hint">Asistencia, tardanzas y ausencias: últimos 30 días</span>
        </div>

        {students.length === 0 ? (
          <EmptyState icon={GraduationCap} title={filtered ? "Ningún estudiante coincide" : "Aún no hay estudiantes"}>
            {filtered ? "Prueba con otros filtros." : "Agrega el primer estudiante con el formulario de arriba."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th>Grado</th>
                  <th>Asistencia</th>
                  <th className="num">Tardes</th>
                  <th className="num">Ausencias</th>
                  <th>NFC</th>
                  <th>Estado</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Person first={s.first_name} last={s.last_name} id={s.id} sub={s.student_number} href={`${base}/${s.id}`} />
                    </td>
                    <td data-label="Grado">{s.grade_level ?? <span className="muted">—</span>}</td>
                    <td data-label="Asistencia">
                      <RateCell rate={s.rate} />
                    </td>
                    <td data-label="Tardes" className="num">
                      {s.late}
                    </td>
                    <td data-label="Ausencias" className="num">
                      {s.absent}
                    </td>
                    <td data-label="NFC">
                      {s.hasCard ? <Badge tone="info">Asignada</Badge> : <Badge tone="neutral">Sin tarjeta</Badge>}
                    </td>
                    <td data-label="Estado">
                      <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{STUDENT_STATUS_LABEL[s.status] ?? s.status}</Badge>
                    </td>
                    <td data-label="Alerta">
                      <Badge tone={RISK_TONE[s.risk]} dot={s.risk !== "none"}>
                        {RISK_LABEL[s.risk]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
