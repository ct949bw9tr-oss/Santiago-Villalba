"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, Nfc, RefreshCw, RotateCcw, WifiOff, X } from "lucide-react";
import { wallTimeInZone, zonedWallTimeToUtc } from "@/lib/time";
import { fmtTime, STATUS_LABEL } from "@/lib/ui/format";
import { describeScan, type ScanBody, type ScanView } from "@/lib/ui/scan";
import { StatusBadge } from "@/components/ui/status-badge";

type Student = { id: string; name: string; uid: string };
type ScanResult = { httpStatus: number; key: string; body: ScanBody & Record<string, unknown>; network?: boolean };

type Conn = "online" | "offline" | "syncing" | "synced";

const CONN_LABEL: Record<Conn, string> = {
  online: "Conectado",
  offline: "Sin internet",
  syncing: "Sincronizando…",
  synced: "Sincronizado",
};

function resultView(r: ScanResult): ScanView {
  if (r.network) return { tone: "reject", title: "Sin conexión", hint: "No se pudo contactar al servidor. Revisa tu conexión a internet e inténtalo de nuevo." };
  return describeScan(r.body);
}

/**
 * Sends taps to the SAME endpoint real readers use
 * (POST /api/v1/attendance/scans); only the authentication differs.
 */
export function Simulator({
  schoolSlug,
  timeZone,
  students,
}: {
  schoolSlug: string;
  timeZone: string;
  students: Student[];
}) {
  const router = useRouter();
  const [uid, setUid] = useState(students[0]?.uid ?? "");
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [conn, setConn] = useState<Conn>("online");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const update = () => setConn(navigator.onLine ? "online" : "offline");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const pending = timers.current;
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      pending.forEach(clearTimeout);
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  async function send(key: string) {
    setPending(true);
    setConn("syncing");
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      const body: Record<string, string> = { uid };
      // The typed time is the SCHOOL's wall-clock time, whatever the viewer's timezone.
      if (useCustomTime && customTime) body.scanned_at = zonedWallTimeToUtc(customTime, timeZone).toISOString();
      const res = await fetch("/api/v1/attendance/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key, "X-School-Slug": schoolSlug },
        body: JSON.stringify(body),
      });
      setResult({ httpStatus: res.status, key, body: await res.json().catch(() => ({ error: "invalid_response" })) });
      setConn("synced");
      later(() => setConn(navigator.onLine ? "online" : "offline"), 2500);
      router.refresh();
    } catch {
      setResult({ httpStatus: 0, key, body: { error: "network_error" }, network: true });
      setConn(navigator.onLine ? "online" : "offline");
    } finally {
      setPending(false);
      setShowResult(true);
      later(() => setShowResult(false), 9000);
    }
  }

  const view = result ? resultView(result) : null;
  const stageClass = pending ? "busy" : conn === "offline" ? "offline" : "";
  const recorded = result?.body.outcome === "recorded" ? result.body.attendance : null;

  return (
    <div className="stack">
      <div className={`nfc-stage ${stageClass}`} aria-live="polite">
        <span className={`conn-pill ${conn === "offline" ? "bad" : conn === "syncing" ? "warn" : ""}`} style={{ position: "absolute", top: 16, right: 16 }}>
          <i /> {CONN_LABEL[conn]}
        </span>

        {showResult && result && view ? (
          <div className={`scan-result ${view.tone === "accept" ? "" : view.tone}`}>
            <div className="res-head">
              <span className={`check-circle ${view.tone === "accept" ? "" : view.tone}`}>
                {view.tone === "accept" ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 12.5 10 17.5 19 7.5" />
                  </svg>
                ) : view.tone === "warn" ? (
                  <Clock size={22} />
                ) : (
                  <X size={22} />
                )}
              </span>
              <div className="grow">
                <p className="res-title">{view.title}</p>
                <div className="res-sub">{result.body.student?.display_name ?? (recorded ? "" : view.hint)}</div>
              </div>
            </div>
            {recorded ? (
              <dl className="res-grid">
                <div>
                  <dt>Estudiante</dt>
                  <dd>{result.body.student?.display_name ?? "—"}</dd>
                </div>
                <div>
                  <dt>Clase</dt>
                  <dd>{recorded.class_name}</dd>
                </div>
                <div>
                  <dt>Hora</dt>
                  <dd>{fmtTime(recorded.checked_in_at ?? result.body.effective_at ?? new Date(), timeZone)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <StatusBadge status={recorded.status} />
                  </dd>
                </div>
              </dl>
            ) : (
              result.body.student && view.hint && <p className="hint">{view.hint}</p>
            )}
            {result.body.replayed && (
              <p className="hint" style={{ marginTop: "0.75rem" }}>
                Reenvío detectado: no se registró nada nuevo.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="nfc-rings">
              <div className="nfc-core">{conn === "offline" ? <WifiOff size={36} /> : <Nfc size={38} />}</div>
            </div>
            <h2>{pending ? "Leyendo tarjeta…" : conn === "offline" ? "Sin conexión a internet" : "Acerca la tarjeta NFC"}</h2>
            <p>
              {pending
                ? "Registrando asistencia"
                : conn === "offline"
                  ? "Las lecturas se reanudarán cuando vuelva la conexión."
                  : "El registro se confirma al instante en esta pantalla."}
            </p>
            {result && view && !pending && (
              <button type="button" className="ghost small" style={{ color: "#c9d3f5" }} onClick={() => setShowResult(true)}>
                Último: {view.title}
                {recorded ? ` · ${STATUS_LABEL[recorded.status]}` : ""}
              </button>
            )}
          </>
        )}
      </div>

      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <h2>Simular lectura</h2>
            <div className="sub">Usa el mismo API que los lectores físicos.</div>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Estudiante
            <select
              value={students.find((s) => s.uid === uid)?.id ?? ""}
              onChange={(e) => setUid(students.find((s) => s.id === e.target.value)?.uid ?? "")}
            >
              <option value="">— escribir un UID —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            UID de la tarjeta
            <input
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="04:A2:2B:1C:9F:5E:80"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="mono"
            />
          </label>
        </div>

        <label className="check-label">
          <input
            type="checkbox"
            checked={useCustomTime}
            onChange={(e) => {
              setUseCustomTime(e.target.checked);
              if (e.target.checked && !customTime) setCustomTime(wallTimeInZone(new Date(), timeZone));
            }}
          />
          Simular otra hora (para probar tarde / ausente)
        </label>
        {useCustomTime && (
          <label>
            Hora del toque (hora del colegio, {timeZone})
            <input type="datetime-local" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
          </label>
        )}

        <div className="inline">
          <button type="button" className="lg" disabled={pending || !uid.trim()} onClick={() => send(crypto.randomUUID())}>
            {pending ? <RefreshCw size={17} className="spin" /> : <Check size={18} />}
            {pending ? "Registrando…" : "Registrar lectura NFC"}
          </button>
          {result && (
            <button type="button" className="secondary" disabled={pending} onClick={() => send(result.key)}>
              <RotateCcw size={15} /> Reenviar el mismo toque
            </button>
          )}
        </div>

        {result && (
          <details className="disclosure">
            <summary>
              Respuesta del API (HTTP {result.httpStatus})
            </summary>
            <div className="disclosure-body">
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "0.78rem" }}>
                {JSON.stringify(result.body, null, 2)}
              </pre>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
