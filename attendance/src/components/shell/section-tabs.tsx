import { Tabs } from "@/components/ui/tabs";

/** Sub-navigation of the "Clases" section. */
export function ClassesTabs({ slug, active }: { slug: string; active: "classes" | "courses" | "teachers" }) {
  const base = `/s/${slug}/admin`;
  return (
    <Tabs
      label="Clases"
      active={active}
      items={[
        { key: "classes", label: "Clases", href: `${base}/classes` },
        { key: "courses", label: "Cursos (materias)", href: `${base}/courses` },
        { key: "teachers", label: "Docentes", href: `${base}/teachers` },
      ]}
    />
  );
}

/** Sub-navigation of the "Configuración" section. */
export function SettingsTabs({ slug, active }: { slug: string; active: "rules" | "devices" }) {
  const base = `/s/${slug}/admin`;
  return (
    <Tabs
      label="Configuración"
      active={active}
      items={[
        { key: "rules", label: "Reglas de asistencia", href: `${base}/rules` },
        { key: "devices", label: "Lectores NFC", href: `${base}/devices` },
      ]}
    />
  );
}
