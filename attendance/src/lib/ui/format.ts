// Presentation helpers shared by every EduTrack screen (Spanish UI).
import type { Role } from "@/lib/auth/roles";
import type { AttendanceStatus } from "@/lib/reports/filters";

export const LOCALE = "es-CO";

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Presente",
  late: "Tarde",
  absent: "Ausente",
  excused: "Excusado",
};

export const ROLE_LABEL: Record<Role, string> = {
  school_admin: "Administrador",
  teacher: "Docente",
  student: "Estudiante",
};

export const SOURCE_LABEL = { nfc: "Tarjeta NFC", manual: "Corregido por personal", system: "Automático" } as const;

export const STUDENT_STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  inactive: "Inactivo",
  graduated: "Graduado",
  withdrawn: "Retirado",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "Programada",
  cancelled: "Cancelada",
  completed: "Finalizada",
};

export function fmtTime(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(instant));
}

export function fmtDate(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(instant),
  );
}

export function fmtShortDate(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, day: "numeric", month: "short" }).format(new Date(instant));
}

export function fmtLongDate(instant: Date | string, timeZone: string): string {
  const s = new Intl.DateTimeFormat(LOCALE, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(
    new Date(instant),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "YYYY-MM-DD" (a school-local calendar day) as a short label, e.g. "12 sept". */
export function fmtDayKey(day: string): string {
  const parts = new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", day: "numeric", month: "short" }).formatToParts(
    new Date(`${day}T12:00:00Z`),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month").replace(".", "")}`;
}

/** Hour of day (0-23) of `instant` in `timeZone`. */
export function hourInZone(instant: Date | string, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(instant)),
  );
}

/** Attendance rate as used everywhere: (present + late) / (present + late + absent). */
export function attendanceRate(c: { present: number; late: number; absent: number }): number | null {
  const attended = Number(c.present) + Number(c.late);
  const base = attended + Number(c.absent);
  return base ? Math.round((1000 * attended) / base) / 10 : null;
}

export function fmtRate(rate: number | null): string {
  return rate === null ? "—" : `${Number.isInteger(rate) ? rate : rate.toFixed(1)}%`;
}

export type Tone = "green" | "orange" | "red" | "blue" | "violet" | "gray";

export function rateTone(rate: number | null): Tone {
  if (rate === null) return "gray";
  if (rate >= 90) return "green";
  if (rate >= 75) return "orange";
  return "red";
}

export type Risk = "ok" | "watch" | "risk" | "none";

/** Risk band from a recent attendance rate and number of late arrivals. */
export function riskLevel(rate: number | null, late: number): Risk {
  if (rate === null) return "none";
  if (rate < 75) return "risk";
  if (rate < 90 || late >= 3) return "watch";
  return "ok";
}

export const RISK_LABEL: Record<Risk, string> = {
  ok: "Sin alertas",
  watch: "En observación",
  risk: "En riesgo",
  none: "Sin datos",
};

export function initials(first: string, last?: string): string {
  const a = first.trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? first.trim().split(/\s+/)[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

/** Stable avatar color bucket (0-7) for an id or name. */
export function avatarTone(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 8;
}

export function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function firstName(fullName: string | null | undefined, email: string | null | undefined): string {
  const n = (fullName ?? "").trim().split(/\s+/)[0];
  if (n) return n;
  return (email ?? "").split("@")[0] || "";
}
