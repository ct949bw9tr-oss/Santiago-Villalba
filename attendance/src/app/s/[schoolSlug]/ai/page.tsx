import { ClipboardList, Send, ShieldCheck, Sparkles } from "lucide-react";
import { requireSchoolAccess } from "@/server/auth/session";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Card } from "@/components/ui/card";

export const metadata = { title: "EduTrack AI" };

const EXAMPLES = [
  "Ponle un reporte a Enrique por usar el celular en clase.",
  "Muéstrame los estudiantes con más de 3 tardanzas este mes.",
  "¿Cuál fue la asistencia de 10A esta semana?",
  "Prepara un resumen de los reportes de hoy.",
];

export default async function AiPage({ params }: PageProps<"/s/[schoolSlug]/ai">) {
  await requireSchoolAccess((await params).schoolSlug);
  return (
    <ComingSoon
      icon={Sparkles}
      title="EduTrack AI"
      subtitle="Tu asistente para gestionar el colegio en lenguaje natural."
      summary="Pregunta o pide acciones en español; EduTrack AI responde con tus datos reales."
      features={[
        "Consultas: asistencia por clase, tardanzas, estudiantes en riesgo.",
        "Acciones como crear reportes, siempre con una tarjeta de confirmación antes de guardar.",
        "Respeta los mismos permisos de tu rol: nunca ve ni cambia más de lo que tú puedes.",
        "Cada acción confirmada queda registrada en la auditoría.",
      ]}
    >
      <div className="grid-main">
        <Card title="Así funcionará" subtitle="Vista previa del diseño: el asistente aún no está conectado.">
          <div className="stack">
            <div className="ai-box" aria-disabled="true">
              <Sparkles size={18} color="var(--primary)" />
              <input disabled placeholder="Pídele algo a EduTrack AI…" aria-label="Comando (no disponible todavía)" />
              <button type="button" disabled aria-label="Enviar">
                <Send size={16} />
              </button>
            </div>
            <div className="prompt-chips">
              {EXAMPLES.map((e) => (
                <span key={e} className="prompt-chip">
                  {e}
                </span>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Confirmación obligatoria" subtitle="Toda acción que modifica datos se confirma primero.">
          <div className="confirm-card">
            <div className="cc-head">
              <span className="kpi-icon tone-blue" style={{ width: 30, height: 30, borderRadius: 8 }}>
                <ClipboardList size={15} />
              </span>
              Crear reporte
            </div>
            <div className="cc-body">
              <dl className="kv" style={{ gridTemplateColumns: "auto 1fr" }}>
                <dt>Estudiante</dt>
                <dd>(estudiante)</dd>
                <dt>Categoría</dt>
                <dd>Disciplina</dd>
                <dt>Motivo</dt>
                <dd>(motivo)</dd>
              </dl>
            </div>
            <div className="cc-actions">
              <button type="button" className="secondary small" disabled>
                Cancelar
              </button>
              <button type="button" className="small" disabled>
                Confirmar reporte
              </button>
            </div>
          </div>
          <p className="hint inline" style={{ marginTop: "0.9rem" }}>
            <ShieldCheck size={14} /> La acción se ejecuta con tu sesión y tus permisos.
          </p>
        </Card>
      </div>
    </ComingSoon>
  );
}
