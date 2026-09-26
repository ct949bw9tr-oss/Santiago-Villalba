// Pure role/tenant helpers. No I/O here: the server loads memberships from the
// database (never from the browser) and passes them in.

export const ROLES = ["school_admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  school_admin: "Admin",
  teacher: "Teacher",
  student: "Student",
};

export type SchoolStatus = "active" | "suspended";

export type SchoolSummary = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: SchoolStatus;
};

/** One active membership row joined with its school. */
export type Membership = {
  role: Role;
  school: SchoolSummary;
};

/** Everything the caller may do in one school. */
export type SchoolAccess = {
  school: SchoolSummary;
  roles: Role[];
};

/** Groups membership rows by school, keeping roles in canonical order. */
export function groupBySchool(memberships: Membership[]): SchoolAccess[] {
  const bySchool = new Map<string, SchoolAccess>();
  for (const m of memberships) {
    const entry = bySchool.get(m.school.id) ?? { school: m.school, roles: [] };
    if (!entry.roles.includes(m.role)) entry.roles.push(m.role);
    bySchool.set(m.school.id, entry);
  }
  return [...bySchool.values()]
    .map((a) => ({ ...a, roles: ROLES.filter((r) => a.roles.includes(r)) }))
    .sort((a, b) => a.school.name.localeCompare(b.school.name));
}

export function findSchoolAccess(memberships: Membership[], slug: string): SchoolAccess | null {
  return groupBySchool(memberships).find((a) => a.school.slug === slug) ?? null;
}

export function hasRole(access: SchoolAccess, role: Role): boolean {
  return access.roles.includes(role);
}

/** Where a user lands inside a school: the most privileged role wins. */
export function schoolHomePath(access: SchoolAccess): string {
  const base = `/s/${access.school.slug}`;
  if (hasRole(access, "school_admin")) return `${base}/admin`;
  if (hasRole(access, "teacher")) return `${base}/teacher`;
  return `${base}/student`;
}

/** Where a user lands right after signing in. */
export function postLoginPath(memberships: Membership[]): string {
  const schools = groupBySchool(memberships);
  if (schools.length === 0) return "/no-access";
  if (schools.length === 1) return `/s/${schools[0].school.slug}`;
  return "/select-school";
}

/**
 * Only allow same-origin relative redirects (prevents open redirects via
 * ?next=https://evil.example).
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
