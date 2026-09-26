import { BarChart3, Nfc, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark, BrandName } from "./brand";

/** Split-screen frame for sign-in and account screens. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <section className="auth-brand">
        <div className="brand" style={{ padding: 0 }}>
          <BrandMark />
          <BrandName />
        </div>
        <div className="auth-hide">
          <h2>La gestión escolar, clara y en tiempo real.</h2>
          <p>Asistencia con tarjetas NFC, seguimiento de estudiantes y analítica para tomar mejores decisiones cada día.</p>
          <div className="auth-points">
            <div>
              <Nfc size={18} /> Asistencia NFC confirmada al instante
            </div>
            <div>
              <BarChart3 size={18} /> Analítica por clase, grado y estudiante
            </div>
            <div>
              <ShieldCheck size={18} /> Datos aislados por colegio y auditados
            </div>
            <div>
              <Sparkles size={18} /> EduTrack AI, próximamente
            </div>
          </div>
        </div>
        <p className="auth-hide small-text" style={{ margin: 0, opacity: 0.7 }}>
          © EduTrack
        </p>
      </section>
      <section className="auth-form">
        <div className="auth-card stack-lg">{children}</div>
      </section>
    </main>
  );
}
