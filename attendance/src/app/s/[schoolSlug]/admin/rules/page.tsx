import { Clock } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { updateDefaultRule } from "@/server/admin/rules";
import { SettingsTabs } from "@/components/shell/section-tabs";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type Rule = {
  early_checkin_minutes: number;
  late_after_minutes: number;
  absent_after_minutes: number;
  scan_after_cutoff: "late" | "absent" | "reject";
  duplicate_window_seconds: number;
  auto_finalize: boolean;
};

export const metadata = { title: "Configuración" };

export default async function RulesPage({ params }: PageProps<"/s/[schoolSlug]/admin/rules">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();

  const { data: rule } = await supabase
    .from("attendance_rules")
    .select("early_checkin_minutes, late_after_minutes, absent_after_minutes, scan_after_cutoff, duplicate_window_seconds, auto_finalize")
    .eq("school_id", access.school.id)
    .eq("is_default", true)
    .returns<Rule[]>()
    .maybeSingle();

  const start = 450; // 07:30, for the example timeline
  const opens = rule ? start - rule.early_checkin_minutes : 0;
  const lateAt = rule ? start + rule.late_after_minutes : 0;
  const absentAt = rule ? start + rule.absent_after_minutes : 0;
  const span = Math.max(1, absentAt + 15 - opens);
  const pos = (m: number) => `${(100 * (m - opens)) / span}%`;

  return (
    <div className="stack-lg">
      <PageHeader title="Configuración" subtitle={`Zona horaria del colegio: ${access.school.timezone}`} />
      <SettingsTabs slug={schoolSlug} active="rules" />

      {!rule ? (
        <Card>
          <EmptyState icon={Clock} title="Este colegio no tiene regla de asistencia por defecto" />
        </Card>
      ) : (
        <div className="grid-main">
          <Card title="Reglas de asistencia" subtitle="Todos los minutos se cuentan desde el inicio de la clase.">
            <ActionForm action={updateDefaultRule} submitLabel="Guardar reglas">
              <SchoolSlugInput slug={schoolSlug} />
              <div className="form-grid">
                <label>
                  El registro abre (min antes de la clase)
                  <input name="early_checkin_minutes" type="number" min={0} max={240} required defaultValue={rule.early_checkin_minutes} />
                </label>
                <label>
                  A tiempo hasta (min después del inicio)
                  <input name="late_after_minutes" type="number" min={0} max={240} required defaultValue={rule.late_after_minutes} />
                </label>
                <label>
                  Ausente si no hay lectura a los (min)
                  <input name="absent_after_minutes" type="number" min={0} max={480} required defaultValue={rule.absent_after_minutes} />
                </label>
                <label>
                  Una lectura después de eso cuenta como
                  <select name="scan_after_cutoff" defaultValue={rule.scan_after_cutoff}>
                    <option value="late">Tarde</option>
                    <option value="absent">Ausente (la lectura queda registrada)</option>
                    <option value="reject">Rechazada</option>
                  </select>
                </label>
                <label>
                  Ignorar toques repetidos dentro de (segundos)
                  <input name="duplicate_window_seconds" type="number" min={0} max={3600} required defaultValue={rule.duplicate_window_seconds} />
                </label>
              </div>
              <label className="check-label">
                <input type="checkbox" name="auto_finalize" defaultChecked={rule.auto_finalize} />
                Marcar automáticamente como ausentes a quienes no registren lectura
              </label>
            </ActionForm>
          </Card>

          <Card title="Ejemplo" subtitle="Clase que empieza a las 07:30">
            <div className="stack">
              <div style={{ position: "relative", height: 14, borderRadius: 999, overflow: "hidden", display: "flex", background: "#edf0f6" }}>
                <span style={{ width: pos(lateAt), background: "var(--success)" }} />
                <span style={{ width: `calc(${pos(absentAt)} - ${pos(lateAt)})`, background: "#f5a524" }} />
                <span style={{ flex: 1, background: "var(--danger)" }} />
              </div>
              <ul className="list">
                <li className="list-item">
                  <span className="feed-icon tone-green">
                    <Clock size={15} />
                  </span>
                  <div className="grow small-text">
                    <strong>
                      {clock(opens)} – {clock(lateAt)}
                    </strong>
                    <div className="cell-sub">Presente</div>
                  </div>
                </li>
                <li className="list-item">
                  <span className="feed-icon tone-orange">
                    <Clock size={15} />
                  </span>
                  <div className="grow small-text">
                    <strong>
                      {clock(lateAt)} – {clock(absentAt)}
                    </strong>
                    <div className="cell-sub">Tarde</div>
                  </div>
                </li>
                <li className="list-item">
                  <span className="feed-icon tone-red">
                    <Clock size={15} />
                  </span>
                  <div className="grow small-text">
                    <strong>Desde {clock(absentAt)}</strong>
                    <div className="cell-sub">Ausente si no ha registrado lectura</div>
                  </div>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function clock(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
