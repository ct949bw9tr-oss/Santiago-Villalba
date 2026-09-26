import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, Clock, UserX } from "lucide-react";
import { localDateKey, utcWindowAroundLocalDay } from "@/lib/time";
import { attendanceRate, firstName, fmtLongDate, fmtRate, fmtTime, greeting, hourInZone } from "@/lib/ui/format";
import { getMyProfile, requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBar } from "@/components/ui/rate";
import { Badge } from "@/components/ui/status-badge";

type Status = "present" | "late" | "absent" | "excused";
type SessionRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "cancelled" | "completed";
  room: string | null;
  class: { name: string; room: string | null } | null;
  records: { status: Status }[];
};

export const metadata = { title: "Mis clases" };

export default async function TeacherToday({ params }: PageProps<"/s/[schoolSlug]/teacher">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "teacher");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;

  // Only classes this teacher is assigned to. RLS would also return every
  // class if the same person is an admin here, so filter explicitly.
  const [{ data: assignments, error: assignmentError }, profile] = await Promise.all([
    supabase
      .from("class_teachers")
      .select("class_section_id, teacher:teachers!inner(user_id)")
      .eq("school_id", access.school.id)
      .eq("teacher.user_id", access.user.id),
    getMyProfile(),
  ]);
  if (assignmentError) throw new Error(assignmentError.message);
  const classIds = (assignments ?? []).map((a) => a.class_section_id as string);

  const now = new Date();
  const today = localDateKey(now, tz);
  let sessions: SessionRow[] = [];

  if (classIds.length > 0) {
    const { from, to } = utcWindowAroundLocalDay(now);
    const { data, error } = await supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, status, room, class:class_sections!inner(name, room), records:attendance_records(status)")
      .eq("school_id", access.school.id)
      .in("class_section_id", classIds)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .returns<SessionRow[]>();
    if (error) throw new Error(error.message);
    sessions = (data ?? []).filter((s) => localDateKey(new Date(s.starts_at), tz) === today);
  }

  const totals = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const s of sessions) for (const r of s.records) totals[r.status]++;
  const isLive = (s: SessionRow) => s.status !== "cancelled" && new Date(s.starts_at) <= now && now < new Date(s.ends_at);
  const live = sessions.find(isLive);
  const name = firstName(profile?.full_name, access.user.email);

  return (
    <div className="stack-lg">
      <header className="page-header">
        <div>
          <h1>Hola{name ? `, ${name}` : ""} 👋</h1>
          <p>
            {greeting(hourInZone(now, tz))} · {fmtLongDate(now, tz)}
          </p>
        </div>
      </header>

      {live && (
        <Link href={`/s/${schoolSlug}/sessions/${live.id}`} className="card card-hover row" style={{ background: "linear-gradient(135deg, #2f5bea, #1d3aa6)", color: "#fff", border: 0 }}>
          <span className="kpi-icon" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
            <BookOpen size={20} />
          </span>
          <div className="grow">
            <div style={{ fontSize: "0.8rem", opacity: 0.85 }} className="inline">
              <span className="live-dot" /> Clase en curso
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{live.class?.name}</div>
            <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>
              {live.records.filter((r) => r.status === "present" || r.status === "late").length} registrados · hasta {fmtTime(live.ends_at, tz)}
            </div>
          </div>
          <span className="button secondary small" style={{ color: "var(--primary)" }}>
            Ver asistencia <ChevronRight size={15} />
          </span>
        </Link>
      )}

      <section className="grid-kpi">
        <KpiCard icon={CheckCircle2} tone="green" value={fmtRate(attendanceRate(totals))} label="Asistencia hoy" />
        <KpiCard icon={Clock} tone="orange" value={totals.late} label="Llegadas tarde" />
        <KpiCard icon={UserX} tone="red" value={totals.absent} label="Ausencias" />
        <KpiCard icon={BookOpen} tone="blue" value={sessions.filter((s) => s.status !== "cancelled").length} label="Clases hoy" />
      </section>

      <Card title="Mis clases de hoy" subtitle="Abre una clase para ver quién llegó y corregir la asistencia.">
        {sessions.length === 0 ? (
          <EmptyState icon={BookOpen} title={classIds.length === 0 ? "Aún no tienes clases asignadas" : "No tienes clases hoy"} compact />
        ) : (
          <div className="stack-sm">
            {sessions.map((s) => {
              const c = { present: 0, late: 0, absent: 0, excused: 0 };
              for (const r of s.records) c[r.status]++;
              const on = isLive(s);
              const done = new Date(s.ends_at) <= now;
              const room = s.room ?? s.class?.room;
              return (
                <Link key={s.id} href={`/s/${schoolSlug}/sessions/${s.id}`} className={`session-card${on ? " live" : ""}`}>
                  <div className="row-between">
                    <div className="row" style={{ minWidth: 0 }}>
                      <span className="time-pill">{fmtTime(s.starts_at, tz)}</span>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-title truncate">{s.class?.name}</div>
                        <div className="cell-sub truncate">
                          {room ? `Salón ${room} · ` : ""}hasta {fmtTime(s.ends_at, tz)}
                        </div>
                      </div>
                    </div>
                    {s.status === "cancelled" ? (
                      <Badge tone="danger">Cancelada</Badge>
                    ) : on ? (
                      <Badge tone="success">
                        <span className="live-dot" /> En vivo
                      </Badge>
                    ) : done ? (
                      <Badge tone="neutral">Finalizada</Badge>
                    ) : (
                      <Badge tone="info">Próxima</Badge>
                    )}
                  </div>
                  <StatusBar {...c} />
                  <div className="stat-row">
                    <span>
                      <b>{c.present}</b> presentes
                    </span>
                    <span>
                      <b>{c.late}</b> tarde
                    </span>
                    <span>
                      <b>{c.absent}</b> ausentes
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
