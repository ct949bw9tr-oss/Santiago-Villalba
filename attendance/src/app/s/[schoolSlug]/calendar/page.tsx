import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { hasRole } from "@/lib/auth/roles";
import { addDays } from "@/lib/reports/filters";
import { localDateKey, zonedWallTimeToUtc } from "@/lib/time";
import { fmtDayKey, fmtTime, LOCALE } from "@/lib/ui/format";
import { requireSchoolAccess } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

type SessionRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  room: string | null;
  class: { name: string; room: string | null };
};

export const metadata = { title: "Calendario" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Monday (YYYY-MM-DD) of the week containing `day`. */
function mondayOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/calendar">) {
  const { schoolSlug } = await params;
  const { week } = await searchParams;
  // RLS decides which sessions each person sees: admins all, teachers their
  // classes, students the classes they are enrolled in.
  const access = await requireSchoolAccess(schoolSlug);
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;
  const today = localDateKey(new Date(), tz);
  const start = mondayOf(typeof week === "string" && DATE.test(week) && !Number.isNaN(Date.parse(week)) ? week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, status, room, class:class_sections!inner(name, room)")
    .eq("school_id", access.school.id)
    .gte("starts_at", zonedWallTimeToUtc(`${start}T00:00`, tz).toISOString())
    .lt("starts_at", zonedWallTimeToUtc(`${addDays(start, 7)}T00:00`, tz).toISOString())
    .order("starts_at")
    .limit(1000)
    .returns<SessionRow[]>();
  if (error) throw new Error(error.message);

  const byDay = new Map<string, SessionRow[]>(days.map((d) => [d, []]));
  for (const s of data ?? []) byDay.get(localDateKey(new Date(s.starts_at), tz))?.push(s);
  const visibleDays = days.filter((d, i) => i < 5 || (byDay.get(d)?.length ?? 0) > 0);
  const canOpen = hasRole(access, "school_admin") || hasRole(access, "teacher");
  const base = `/s/${schoolSlug}/calendar`;
  const weekday = (d: string) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", weekday: "short" }).format(new Date(`${d}T12:00:00Z`)).replace(".", "");
  const total = (data ?? []).filter((s) => s.status !== "cancelled").length;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Calendario"
        subtitle={`Semana del ${fmtDayKey(start)} al ${fmtDayKey(addDays(start, 6))} · ${total} ${total === 1 ? "clase" : "clases"}`}
        actions={
          <div className="inline">
            <Link className="button secondary small" href={`${base}?week=${addDays(start, -7)}`} aria-label="Semana anterior">
              <ChevronLeft size={16} />
            </Link>
            <Link className="button secondary small" href={base}>
              Hoy
            </Link>
            <Link className="button secondary small" href={`${base}?week=${addDays(start, 7)}`} aria-label="Semana siguiente">
              <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      {(data ?? []).length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarDays} title="No hay clases esta semana">
            Las clases aparecen aquí según el horario semanal de cada una.
          </EmptyState>
        </div>
      ) : (
        <section className="week-grid" style={{ ["--days" as string]: visibleDays.length }}>
          {visibleDays.map((d) => (
            <div key={d} className={`week-day card${d === today ? " today" : ""}`}>
              <div className="week-day-head">
                <span className="wd">{weekday(d)}</span>
                <span className="dn">{Number(d.slice(8))}</span>
              </div>
              <div className="stack-sm">
                {(byDay.get(d) ?? []).length === 0 && <p className="hint">Sin clases</p>}
                {(byDay.get(d) ?? []).map((s) => {
                  const body = (
                    <>
                      <span className="ev-time">{fmtTime(s.starts_at, tz)}</span>
                      <span className="ev-title">{s.class.name}</span>
                      <span className="ev-sub">
                        hasta {fmtTime(s.ends_at, tz)}
                        {(s.room ?? s.class.room) && ` · ${s.room ?? s.class.room}`}
                      </span>
                      {s.status === "cancelled" && <span className="ev-sub">Cancelada</span>}
                    </>
                  );
                  const cls = `event${s.status === "cancelled" ? " cancelled" : ""}`;
                  return canOpen ? (
                    <Link key={s.id} href={`/s/${schoolSlug}/sessions/${s.id}`} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <div key={s.id} className={cls}>
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
