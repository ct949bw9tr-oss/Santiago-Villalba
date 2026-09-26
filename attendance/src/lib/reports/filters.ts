// Report filters come from the URL (?from=…&to=…&class=…&student=…&status=…)
// so reports can be bookmarked and the CSV export uses exactly the same
// selection. Everything is validated; the school is never part of it.

export const STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof STATUSES)[number];

export type ReportFilters = {
  from: string; // YYYY-MM-DD, school-local
  to: string;
  classId: string | null;
  studentId: string | null;
  status: AttendanceStatus | null;
};

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | undefined {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Parses URL params; invalid values fall back to defaults and are reported. */
export function parseReportFilters(params: Params, today: string): { filters: ReportFilters; error: string | null } {
  let error: string | null = null;
  let to = one(params, "to") ?? today;
  let from = one(params, "from") ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));

  if (!isRealDate(to) || !isRealDate(from)) {
    error = "Las fechas deben tener el formato 2026-09-28.";
    to = today;
    from = addDays(today, -(DEFAULT_RANGE_DAYS - 1));
  } else if (from > to) {
    error = "La fecha inicial es posterior a la final.";
    [from, to] = [to, from];
  }
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) {
    error = `Los reportes cubren como máximo ${MAX_RANGE_DAYS} días.`;
    from = addDays(to, -(MAX_RANGE_DAYS - 1));
  }

  const classId = one(params, "class");
  const studentId = one(params, "student");
  const status = one(params, "status");
  return {
    filters: {
      from,
      to,
      classId: classId && UUID.test(classId) ? classId : null,
      studentId: studentId && UUID.test(studentId) ? studentId : null,
      status: STATUSES.includes(status as AttendanceStatus) ? (status as AttendanceStatus) : null,
    },
    error,
  };
}

export function filtersToQuery(f: ReportFilters): string {
  const q = new URLSearchParams({ from: f.from, to: f.to });
  if (f.classId) q.set("class", f.classId);
  if (f.studentId) q.set("student", f.studentId);
  if (f.status) q.set("status", f.status);
  return q.toString();
}
