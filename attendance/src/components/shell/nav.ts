import { hasRole, type SchoolAccess } from "@/lib/auth/roles";

export type NavIcon =
  | "home"
  | "attendance"
  | "students"
  | "classes"
  | "myclasses"
  | "reports"
  | "discipline"
  | "messages"
  | "calendar"
  | "analytics"
  | "ai"
  | "settings";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  /** Path prefixes that mark this item active (first match wins, longest first). */
  match: string[];
  exact?: boolean;
  soon?: boolean;
};

export type Navigation = { items: NavItem[]; mobile: string[]; fab: string | null };

/** Menu for the caller's roles. Links only: every page re-checks access. */
export function buildNavigation(access: SchoolAccess): Navigation {
  const base = `/s/${access.school.slug}`;
  const admin = hasRole(access, "school_admin");
  const teacher = hasRole(access, "teacher");
  const items: NavItem[] = [];

  const soon = (key: string, label: string, path: string, icon: NavIcon): NavItem => ({
    key,
    label,
    href: `${base}/${path}`,
    icon,
    match: [`${base}/${path}`],
    soon: true,
  });

  if (admin) {
    items.push(
      { key: "home", label: "Inicio", href: `${base}/admin`, icon: "home", match: [`${base}/admin`], exact: true },
      { key: "attendance", label: "Asistencia", href: `${base}/admin/simulator`, icon: "attendance", match: [`${base}/admin/simulator`] },
    );
    if (teacher) {
      items.push({ key: "myclasses", label: "Mis clases", href: `${base}/teacher`, icon: "myclasses", match: [`${base}/teacher`] });
    }
    items.push(
      { key: "students", label: "Estudiantes", href: `${base}/admin/students`, icon: "students", match: [`${base}/admin/students`] },
      {
        key: "classes",
        label: "Clases",
        href: `${base}/admin/classes`,
        icon: "classes",
        match: [`${base}/admin/classes`, `${base}/admin/courses`, `${base}/admin/teachers`, `${base}/sessions`],
      },
      soon("reports", "Reportes", "reports", "reports"),
      soon("discipline", "Disciplina", "discipline", "discipline"),
      soon("messages", "Comunicación", "messages", "messages"),
      { key: "calendar", label: "Calendario", href: `${base}/calendar`, icon: "calendar", match: [`${base}/calendar`] },
      { key: "analytics", label: "Analytics", href: `${base}/admin/attendance`, icon: "analytics", match: [`${base}/admin/attendance`] },
      soon("ai", "EduTrack AI", "ai", "ai"),
      {
        key: "settings",
        label: "Configuración",
        href: `${base}/admin/rules`,
        icon: "settings",
        match: [`${base}/admin/rules`, `${base}/admin/devices`],
      },
    );
    return { items, mobile: ["home", "students", "attendance", "analytics"], fab: "attendance" };
  }

  if (teacher) {
    items.push(
      { key: "home", label: "Inicio", href: `${base}/teacher`, icon: "home", match: [`${base}/teacher`, `${base}/sessions`] },
      soon("reports", "Reportes", "reports", "reports"),
      soon("discipline", "Disciplina", "discipline", "discipline"),
      soon("messages", "Comunicación", "messages", "messages"),
      { key: "calendar", label: "Calendario", href: `${base}/calendar`, icon: "calendar", match: [`${base}/calendar`] },
      soon("ai", "EduTrack AI", "ai", "ai"),
    );
    return { items, mobile: ["home", "reports", "calendar"], fab: null };
  }

  items.push(
    { key: "home", label: "Inicio", href: `${base}/student`, icon: "home", match: [`${base}/student`] },
    soon("messages", "Comunicación", "messages", "messages"),
    { key: "calendar", label: "Calendario", href: `${base}/calendar`, icon: "calendar", match: [`${base}/calendar`] },
  );
  return { items, mobile: ["home", "calendar"], fab: null };
}

export function activeKey(items: NavItem[], pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const item of items) {
    for (const m of item.match) {
      const hit = item.exact ? pathname === m : pathname === m || pathname.startsWith(`${m}/`);
      if (hit && (!best || m.length > best.len)) best = { key: item.key, len: m.length };
    }
  }
  return best?.key ?? null;
}
