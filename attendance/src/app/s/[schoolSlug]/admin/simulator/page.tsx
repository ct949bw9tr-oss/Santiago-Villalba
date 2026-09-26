import Link from "next/link";
import { CircleCheck, Clock, CloudCheck, Nfc, RadioTower, RefreshCw, UserCheck, UserX, WifiOff } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { formatUid } from "@/lib/nfc/uid";
import { localDateKey, utcWindowAroundLocalDay } from "@/lib/time";
import { fmtLongDate, fmtTime } from "@/lib/ui/format";
import { OUTCOME_LABEL, outcomeTone, type ScanOutcome } from "@/lib/ui/scan";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { runAbsenceCheck, setSimulatorEnabled } from "@/server/admin/devices";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBar } from "@/components/ui/rate";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { Simulator } from "./simulator";

type CardRow = { uid_normalized: string; student: { id: string; first_name: string; last_name: string; status: string } };
type ScanRow = {
  id: string;
  received_at: string;
  effective_at: string;
  uid_normalized: string;
  outcome: ScanOutcome;
  outcome_detail: string | null;
  device: { name: string; kind: string };
  student: { id: string; first_name: string; last_name: string } | null;
  record: { status: "present" | "late" | "absent" | "excused" } | null;
};
type SessionRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  finalized_at: string | null;
  class: { name: string };
  records: { status: "present" | "late" | "absent" | "excused" }[];
};

export const metadata = { title: "Asistencia" };

const STATES = [
  { icon: UserCheck, tone: "tone-green", label: "Presente" },
  { icon: Clock, tone: "tone-orange", label: "Tarde" },
  { icon: UserX, tone: "tone-red", label: "Ausente" },
  { icon: CircleCheck, tone: "tone-violet", label: "Excusado" },
  { icon: RadioTower, tone: "tone-gray", label: "Lector desconectado" },
  { icon: WifiOff, tone: "tone-red", label: "Sin internet" },
  { icon: RefreshCw, tone: "tone-blue", label: "Sincronizando" },
  { icon: CloudCheck, tone: "tone-green", label: "Sincronizado" },
];

export default async function SimulatorPage({ params }: PageProps<"/s/[schoolSlug]/admin/simulator">) {
  const { schoolSlug } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const tz = access.school.timezone;

  const now = new Date();
  const { from, to } = utcWindowAroundLocalDay(now);
  const [{ data: school }, { data: cards }, { data: scans }, { data: sessions }] = await Promise.all([
    supabase.from("schools").select("settings").eq("id", schoolId).single(),
    supabase
      .from("nfc_credentials")
      .select("uid_normalized, student:students!inner(id, first_name, last_name, status)")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .returns<CardRow[]>(),
    supabase
      .from("scan_events")
      .select(
        "id, received_at, effective_at, uid_normalized, outcome, outcome_detail, device:devices!inner(name, kind), student:students(id, first_name, last_name), record:attendance_records!scan_events_school_id_attendance_record_id_fkey(status)",
      )
      .eq("school_id", schoolId)
      .order("received_at", { ascending: false })
      .limit(15)
      .returns<ScanRow[]>(),
    supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, status, finalized_at, class:class_sections!inner(name), records:attendance_records(status)")
      .eq("school_id", schoolId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .returns<SessionRow[]>(),
  ]);
  const enabled = Boolean(school?.settings?.simulator_enabled);

  const students = (cards ?? [])
    .filter((c) => c.student.status === "active")
    .map((c) => ({
      id: c.student.id,
      name: `${c.student.last_name}, ${c.student.first_name} — ${formatUid(c.uid_normalized)}`,
      uid: formatUid(c.uid_normalized),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = localDateKey(now, tz);
  const todaysSessions = (sessions ?? []).filter((s) => localDateKey(new Date(s.starts_at), tz) === today);
  const base = `/s/${schoolSlug}`;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Asistencia NFC"
        subtitle={
          <>
            {fmtLongDate(now, tz)} · Hora del colegio: <strong>{fmtTime(now, tz)}</strong> ({tz})
          </>
        }
        actions={
          <Link className="button secondary" href={`${base}/admin/devices`}>
            <RadioTower size={16} /> Lectores
          </Link>
        }
      />

      <div className="grid-main">
        <div className="stack">
          {enabled ? (
            <>
              {students.length === 0 && (
                <div className="callout info">
                  <Nfc size={18} />
                  <p>Ningún estudiante tiene tarjeta NFC todavía: asígnala desde su perfil, o escribe cualquier UID abajo.</p>
                </div>
              )}
              <Simulator schoolSlug={schoolSlug} timeZone={tz} students={students} />
            </>
          ) : (
            <div className="nfc-stage offline">
              <div className="nfc-rings">
                <div className="nfc-core">
                  <Nfc size={38} />
                </div>
              </div>
              <h2>Simulador NFC desactivado</h2>
              <p style={{ maxWidth: 440 }}>
                El simulador permite registrar lecturas desde esta pantalla antes de instalar lectores físicos. Las lecturas pasan
                por el mismo API de asistencia que usan los lectores reales y quedan registradas como del simulador.
              </p>
              <ActionForm action={setSimulatorEnabled} submitLabel="Activar simulador" className="inline">
                <SchoolSlugInput slug={schoolSlug} />
                <input type="hidden" name="enabled" value="true" />
              </ActionForm>
            </div>
          )}
        </div>

        <div className="stack">
          <Card
            title="Clases de hoy"
            subtitle={`${todaysSessions.length} programadas`}
            action={
              <ActionForm action={runAbsenceCheck} submitLabel="Cerrar clases vencidas" pendingLabel="Revisando…" variant="secondary" className="inline small" quiet>
                <SchoolSlugInput slug={schoolSlug} />
              </ActionForm>
            }
          >
            {todaysSessions.length === 0 ? (
              <EmptyState title="No hay clases hoy" compact />
            ) : (
              <div className="stack-sm">
                {todaysSessions.map((s) => {
                  const c = { present: 0, late: 0, absent: 0, excused: 0 };
                  for (const r of s.records) c[r.status]++;
                  const isLive = s.status !== "cancelled" && new Date(s.starts_at) <= now && now < new Date(s.ends_at);
                  return (
                    <Link key={s.id} href={`${base}/sessions/${s.id}`} className={`session-card${isLive ? " live" : ""}`} style={{ padding: "0.8rem" }}>
                      <div className="row-between">
                        <span className="cell-title truncate">{s.class.name}</span>
                        {s.status === "cancelled" ? (
                          <Badge>Cancelada</Badge>
                        ) : isLive ? (
                          <Badge tone="success">
                            <span className="live-dot" /> En vivo
                          </Badge>
                        ) : s.finalized_at ? (
                          <Badge tone="neutral">Cerrada</Badge>
                        ) : (
                          <span className="time-pill">
                            {fmtTime(s.starts_at, tz)} – {fmtTime(s.ends_at, tz)}
                          </span>
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
                        {c.excused > 0 && (
                          <span>
                            <b>{c.excused}</b> excusados
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <p className="hint" style={{ marginTop: "0.9rem" }}>
              El cierre automático corre cada 5 minutos: cuando una clase pasa su hora límite, los inscritos sin lectura se marcan
              ausentes.
            </p>
          </Card>

          <Card title="Estados del sistema" subtitle="Cómo se ve cada estado en EduTrack">
            <div className="state-grid">
              {STATES.map((s) => (
                <div key={s.label} className="state-chip">
                  <span className={`feed-icon ${s.tone}`} style={{ width: 26, height: 26, borderRadius: 8 }}>
                    <s.icon size={14} />
                  </span>
                  {s.label}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Últimas lecturas" subtitle="Lectores físicos y simulador" flush>
        {(scans ?? []).length === 0 ? (
          <EmptyState icon={Nfc} title="Aún no hay lecturas" compact />
        ) : (
          <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "1.35rem" }}>Estudiante</th>
                  <th>Hora</th>
                  <th>Resultado</th>
                  <th className="hide-sm">Tarjeta</th>
                  <th className="hide-sm">Origen</th>
                </tr>
              </thead>
              <tbody>
                {(scans ?? []).map((s) => (
                  <tr key={s.id}>
                    <td style={{ paddingLeft: "1.35rem" }}>
                      {s.student ? (
                        <Person first={s.student.first_name} last={s.student.last_name} id={s.student.id} size="sm" href={`${base}/admin/students/${s.student.id}`} />
                      ) : (
                        <span className="muted">Tarjeta desconocida</span>
                      )}
                    </td>
                    <td data-label="Hora" className="nowrap">
                      {fmtTime(s.effective_at, tz)}
                      {s.outcome_detail === "simulated time" && <div className="cell-sub">hora simulada</div>}
                    </td>
                    <td data-label="Resultado">
                      <span className="inline">
                        {s.record && s.outcome === "recorded" ? (
                          <StatusBadge status={s.record.status} />
                        ) : (
                          <Badge tone={outcomeTone(s.outcome)}>{OUTCOME_LABEL[s.outcome] ?? s.outcome}</Badge>
                        )}
                      </span>
                    </td>
                    <td data-label="Tarjeta" className="mono hide-sm">
                      {formatUid(s.uid_normalized)}
                    </td>
                    <td data-label="Origen" className="hide-sm">{s.device.kind === "simulator" ? "Simulador" : s.device.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {enabled && (
        <div className="row-between card" style={{ flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Simulador NFC activo</h3>
            <p className="hint">Desactívalo cuando los lectores físicos estén en uso.</p>
          </div>
          <ActionForm
            action={setSimulatorEnabled}
            submitLabel="Desactivar simulador"
            variant="secondary"
            className="inline small"
            confirmText="¿Desactivar el simulador para este colegio?"
            confirmLabel="Desactivar"
            quiet
          >
            <SchoolSlugInput slug={schoolSlug} />
            <input type="hidden" name="enabled" value="false" />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
