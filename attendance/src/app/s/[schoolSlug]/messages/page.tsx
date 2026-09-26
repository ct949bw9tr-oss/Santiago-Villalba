import { MessagesSquare } from "lucide-react";
import { requireSchoolAccess } from "@/server/auth/session";
import { ComingSoon } from "@/components/ui/coming-soon";

export const metadata = { title: "Comunicación" };

export default async function MessagesPage({ params }: PageProps<"/s/[schoolSlug]/messages">) {
  await requireSchoolAccess((await params).schoolSlug);
  return (
    <ComingSoon
      icon={MessagesSquare}
      title="Comunicación"
      subtitle="Mensajes entre el colegio, docentes y familias."
      summary="Avisos a familias cuando importa: ausencias, tardanzas y reportes."
      features={[
        "Notificación a acudientes cuando un estudiante no llega a clase.",
        "Circulares a un grado, una clase o todo el colegio.",
        "Mensajes directos entre docentes y administración.",
        "Registro de lectura y historial por estudiante.",
      ]}
    />
  );
}
