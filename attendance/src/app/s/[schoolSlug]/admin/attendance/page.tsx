import Link from "next/link";
import { filtersToQuery, parseReportFilters, STATUSES } from "@/lib/reports/filters";
import { formatLocalDate, formatLocalTime, localDateKey } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { fetchRecords, fetchSummaries } from "@/server/reports/queries";

const DETAIL_ROWS = 200;
const STATUS_COLOR = { present: "#2e7d32", late: "#b26a00", absent: "#b3261e", excused: "#1565c0" } as const;
const SOURCE = { nfc: "card", manual: "staff", system: "automatic" } as const;

function rateColor(rate: number | null) {
  if (rate === null) return "var(--muted)";
  if (rate >= 90) return STATUS_COLOR.present;
  if (rate >= 75) return STATUS_COLOR.late;
  return STATUS_COLOR.absent;
}

function Rate({ value }: { value: number | null }) {
  return <strong style={{ color: rateColor(value) }}>{value === null ? "—" : `${value}%`}</strong>;
}

export default async function AttendanceReportPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/admin/attendance">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;
  const today = localDateKey(new Date(), tz);
  const { filters, error: filterError } = parseReportFilters(await searchParams, today);

  const [{ byStudent, byClass }, records, { data: classes }, { data: students }] = await Promise.all([
    fetchSummaries(supabase, schoolId, filters),
    fetchRecords(supabase, schoolId, tz, filters, { offset: 0, limit: DETAIL_ROWS }),
    supabase.from("class_sections").select("id, name").eq("school_id", schoolId).order("name"),
    supabase.from("students").select("id, first_name, last_name, student_number").eq("school_id", schoolId).order("last_name"),
  ]);

  // Totals follow the class filter (the class summary itself always lists every class).
  const scopedClasses = filters.classId ? byClass.filter((c) => c.class_section_id === filters.classId) : byClass;
  const totals = scopedClasses.reduce(
    (t, c) => ({
      present: t.present + Number(c.present),
      late: t.late + Number(c.late),
      absent: t.absent + Number(c.absent),
      excused: t.excused + Number(c.excused),
    }),
    { present: 0, late: 0, absent: 0, excused: 0 },
  );
  const attended = totals.present + totals.late;
  const overallRate = attended + totals.absent ? Math.round((1000 * attended) / (attended + totals.absent)) / 10 : null;
  const base = `/s/${schoolSlug}/admin`;
  const exportHref = `${base}/attendance/export?${filtersToQuery(filters)}`;
  const studentRows = filters.studentId ? byStudent.filter((s) => s.student_id === filters.studentId) : byStudent;

  return (
    <div className="stack">
      <h1>Attendance</h1>

      <form className="card form-grid" action={`${base}/attendance`}>
        <label>
          From
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Class
          <select name="class" defaultValue={filters.classId ?? ""}>
            <option value="">All classes</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Student
          <select name="student" defaultValue={filters.studentId ?? ""}>
            <option value="">All students</option>
            {(students ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.last_name}, {s.first_name} ({s.student_number})
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="inline">
          <button type="submit">Apply</button>
          <a className="button" href={exportHref} style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)" }}>
            Download CSV
          </a>
        </div>
      </form>
      {filterError && <p className="error">{filterError}</p>}

      <section className="grid">
        <div className="card">
          <div className="muted">Attendance rate</div>
          <div className="stat">
            <Rate value={overallRate} />
          </div>
        </div>
        {(["present", "late", "absent", "excused"] as const).map((s) => (
          <div key={s} className="card">
            <div className="muted">{s[0].toUpperCase() + s.slice(1)}</div>
            <div className="stat" style={{ color: STATUS_COLOR[s] }}>
              {totals[s]}
            </div>
          </div>
        ))}
      </section>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Rate = (present + late) ÷ (present + late + absent). Excused absences don&apos;t count against it.
      </p>

      <section className="card stack">
        <h2>By class</h2>
        {byClass.length === 0 ? (
          <p className="muted">No attendance in this period.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Sessions</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Excused</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {byClass.map((c) => (
                  <tr key={c.class_section_id}>
                    <td>
                      <Link href={`${base}/attendance?${filtersToQuery({ ...filters, classId: c.class_section_id })}`}>
                        {c.class_name}
                      </Link>
                    </td>
                    <td>{c.sessions}</td>
                    <td>{c.present}</td>
                    <td>{c.late}</td>
                    <td>{c.absent}</td>
                    <td>{c.excused}</td>
                    <td>
                      <Rate value={c.attendance_rate === null ? null : Number(c.attendance_rate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>By student{filters.classId ? " (this class)" : ""}</h2>
        {studentRows.length === 0 ? (
          <p className="muted">No attendance in this period.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Excused</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((s) => (
                  <tr key={s.student_id}>
                    <td>
                      <Link href={`${base}/attendance?${filtersToQuery({ ...filters, studentId: s.student_id })}`}>
                        {s.last_name}, {s.first_name}
                      </Link>{" "}
                      <span className="muted">{s.student_number}</span>
                    </td>
                    <td>{s.present}</td>
                    <td>{s.late}</td>
                    <td>{s.absent}</td>
                    <td>{s.excused}</td>
                    <td>
                      <Rate value={s.attendance_rate === null ? null : Number(s.attendance_rate)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="section-head">
          <h2>Records</h2>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {records.length === DETAIL_ROWS ? `Latest ${DETAIL_ROWS} — download the CSV for all` : `${records.length} records`}
          </span>
        </div>
        {records.length === 0 ? (
          <p className="muted">No records match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Class</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Checked in</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/s/${schoolSlug}/sessions/${r.session.id}`}>
                        {formatLocalDate(r.session.starts_at, tz)} {formatLocalTime(r.session.starts_at, tz)}
                      </Link>
                    </td>
                    <td>{r.session.class.name}</td>
                    <td>
                      {r.student.last_name}, {r.student.first_name}
                    </td>
                    <td>
                      <strong style={{ color: STATUS_COLOR[r.status] }}>{r.status}</strong>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {SOURCE[r.source]}
                        {r.source === "manual" && r.note ? `: ${r.note}` : ""}
                      </div>
                    </td>
                    <td>{r.checked_in_at ? formatLocalTime(r.checked_in_at, tz) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
