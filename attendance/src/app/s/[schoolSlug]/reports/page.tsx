import { ClipboardList } from "lucide-react";
import { requireSchoolAccess } from "@/server/auth/session";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata = { title: "Reportes" };

export default async function ReportsPage({ params }: PageProps<"/s/[schoolSlug]/reports">) {
  await requireSchoolAccess((await params).schoolSlug);
  return (
    <ComingSoon
      icon={ClipboardList}
      title="Reportes"
      subtitle="Reportes de estudiantes: disciplina, académico, asistencia y otros."
      summary="Registra un reporte en segundos y haz seguimiento hasta cerrarlo."
      features={[
        "Categorías: Disciplina, Académico, Asistencia y Otros, con insignias de color.",
        "Creación rápida desde el perfil del estudiante o desde EduTrack AI.",
        "Estudiante, descripción, docente que reporta, fecha, hora y estado.",
        "Filtros por categoría, estado, clase y fechas.",
        "Historial auditado, con permisos por rol (docente / administrador).",
      ]}
    />
  );
}
