import "server-only";
import { addDays, type AttendanceStatus, type ReportFilters } from "@/lib/reports/filters";
import { zonedWallTimeToUtc } from "@/lib/time";
import { createSupabaseServerClient } from "@/server/db/supabase-server";

// Report queries run as the signed-in user: RLS decides what they may see,
// and every query is also scoped to the active school explicitly.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StudentSummary = {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  attendance_rate: number | null;
};

export type ClassSummary = {
  class_section_id: string;
  class_name: string;
  sessions: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendance_rate: number | null;
};

export type RecordDetail = {
  id: string;
  status: AttendanceStatus;
  source: "nfc" | "manual" | "system";
  checked_in_at: string | null;
  note: string | null;
  session: { id: string; starts_at: string; class: { id: string; name: string } };
  student: { id: string; student_number: string; first_name: string; last_name: string };
};

export async function fetchSummaries(supabase: Supabase, schoolId: string, f: ReportFilters) {
  const [byStudent, byClass] = await Promise.all([
    supabase
      .rpc("attendance_summary_by_student", {
        p_school_id: schoolId,
        p_from: f.from,
        p_to: f.to,
        p_class_section_id: f.classId,
      }),
    supabase
      .rpc("attendance_summary_by_class", { p_school_id: schoolId, p_from: f.from, p_to: f.to }),
  ]);
  if (byStudent.error) throw new Error(byStudent.error.message);
  if (byClass.error) throw new Error(byClass.error.message);
  return {
    byStudent: (byStudent.data ?? []) as StudentSummary[],
    byClass: (byClass.data ?? []) as ClassSummary[],
  };
}

/** One page of attendance records matching the filters, newest class first. */
export async function fetchRecords(
  supabase: Supabase,
  schoolId: string,
  timeZone: string,
  f: ReportFilters,
  range: { offset: number; limit: number },
): Promise<RecordDetail[]> {
  // School-local calendar days -> UTC instants [from 00:00, day after "to" 00:00).
  const fromUtc = zonedWallTimeToUtc(`${f.from}T00:00`, timeZone).toISOString();
  const toUtc = zonedWallTimeToUtc(`${addDays(f.to, 1)}T00:00`, timeZone).toISOString();

  let query = supabase
    .from("attendance_records")
    .select(
      "id, status, source, checked_in_at, note, session:class_sessions!inner(id, starts_at, class:class_sections!inner(id, name)), student:students!inner(id, student_number, first_name, last_name)",
    )
    .eq("school_id", schoolId)
    .gte("session.starts_at", fromUtc)
    .lt("session.starts_at", toUtc);
  if (f.classId) query = query.eq("session.class_section_id", f.classId);
  if (f.studentId) query = query.eq("student_id", f.studentId);
  if (f.status) query = query.eq("status", f.status);

  const { data, error } = await query
    .order("session(starts_at)", { ascending: false })
    .order("id")
    .range(range.offset, range.offset + range.limit - 1)
    .returns<RecordDetail[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type Totals = { present: number; late: number; absent: number; excused: number; sessions: number };
export type Bucket = { from: string; to: string; label: string };

export const EMPTY_TOTALS: Totals = { present: 0, late: 0, absent: 0, excused: 0, sessions: 0 };

export function sumClassTotals(rows: ClassSummary[]): Totals {
  return rows.reduce(
    (t, c) => ({
      present: t.present + Number(c.present),
      late: t.late + Number(c.late),
      absent: t.absent + Number(c.absent),
      excused: t.excused + Number(c.excused),
      sessions: t.sessions + Number(c.sessions),
    }),
    { ...EMPTY_TOTALS },
  );
}

/**
 * Status totals per date bucket (school-local days), e.g. one bucket per day
 * for a trend line. One aggregate RPC per bucket, run in parallel; callers
 * keep the number of buckets small (≤ 31).
 */
export async function fetchBucketTotals(
  supabase: Supabase,
  schoolId: string,
  buckets: Bucket[],
  classId: string | null = null,
): Promise<(Totals & Bucket)[]> {
  const results = await Promise.all(
    buckets.map((b) => supabase.rpc("attendance_summary_by_class", { p_school_id: schoolId, p_from: b.from, p_to: b.to })),
  );
  return results.map((r, i) => {
    if (r.error) throw new Error(r.error.message);
    let rows = (r.data ?? []) as ClassSummary[];
    if (classId) rows = rows.filter((c) => c.class_section_id === classId);
    return { ...buckets[i], ...sumClassTotals(rows) };
  });
}

/** Splits [from, to] into at most `max` consecutive buckets of whole days. */
export function splitRange(from: string, to: string, max = 31): { from: string; to: string }[] {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  const size = Math.max(1, Math.ceil(days / max));
  const out: { from: string; to: string }[] = [];
  for (let start = from; start <= to; start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    out.push({ from: start, to: end > to ? to : end });
  }
  return out;
}
