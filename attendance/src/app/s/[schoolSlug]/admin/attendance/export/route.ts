import type { NextRequest } from "next/server";
import { findSchoolAccess, hasRole } from "@/lib/auth/roles";
import { toCsv } from "@/lib/reports/csv";
import { parseReportFilters } from "@/lib/reports/filters";
import { formatLocalTime, localDateKey } from "@/lib/time";
import { getCurrentUser, getMyMemberships } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { fetchRecords } from "@/server/reports/queries";

// GET /s/[school]/admin/attendance/export?from=…&to=…&class=…&student=…&status=…
// Same filters as the report page; admins only.

const PAGE = 1000; // PostgREST's default max rows per request on Supabase
const MAX_ROWS = 50_000;
const SOURCE = { nfc: "card", manual: "staff", system: "automatic" } as const;

export async function GET(request: NextRequest, { params }: RouteContext<"/s/[schoolSlug]/admin/attendance/export">) {
  const { schoolSlug } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const access = findSchoolAccess(await getMyMemberships(), schoolSlug);
  if (!access || !hasRole(access, "school_admin") || access.school.status !== "active") {
    return new Response("Not found", { status: 404 });
  }

  const tz = access.school.timezone;
  const today = localDateKey(new Date(), tz);
  const { filters } = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams), today);
  const supabase = await createSupabaseServerClient();

  const rows: (string | number | null)[][] = [
    ["Date", "Time", "Class", "Student number", "Last name", "First name", "Status", "Source", "Checked in", "Note"],
  ];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await fetchRecords(supabase, access.school.id, tz, filters, { offset, limit: PAGE });
    for (const r of page) {
      rows.push([
        localDateKey(new Date(r.session.starts_at), tz),
        formatLocalTime(r.session.starts_at, tz, "en-GB"),
        r.session.class.name,
        r.student.student_number,
        r.student.last_name,
        r.student.first_name,
        r.status,
        SOURCE[r.source],
        r.checked_in_at ? formatLocalTime(r.checked_in_at, tz, "en-GB") : null,
        r.note,
      ]);
    }
    if (page.length < PAGE) break;
  }

  const filename = `attendance_${access.school.slug}_${filters.from}_${filters.to}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
