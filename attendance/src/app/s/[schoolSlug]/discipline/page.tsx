import { ShieldAlert } from "lucide-react";
import { requireSchoolAccess } from "@/server/auth/session";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata = { title: "Disciplina" };

export default async function DisciplinePage({ params }: PageProps<"/s/[schoolSlug]/discipline">) {
  await requireSchoolAccess((await params).schoolSlug);
  return (
    <ComingSoon
      icon={ShieldAlert}
      title="Disciplina"
      subtitle="Seguimiento de convivencia y comportamiento."
      summary="Una vista de convivencia construida sobre los reportes de disciplina."
      features={[
        "Estudiantes con reportes recurrentes y alertas tempranas.",
        "Seguimiento de casos: abierto, en seguimiento, cerrado.",
        "Relación con la asistencia (tardanzas y ausencias).",
        "Tendencias por grado y por clase.",
      ]}
    />
  );
}
