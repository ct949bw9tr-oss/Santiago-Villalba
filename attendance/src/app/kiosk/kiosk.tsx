"use client";

import { Clock, KeyRound, LogOut, Nfc, Settings, Smartphone, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeUid } from "@/lib/nfc/uid";
import { fmtLongDate, fmtTime } from "@/lib/ui/format";
import { describeScan, type ScanBody, type ScanView } from "@/lib/ui/scan";
import { BrandMark, BrandName } from "@/components/ui/brand";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { StatusBadge } from "@/components/ui/status-badge";

// Classroom reader screen. Works with:
//  - USB / Bluetooth readers in "keyboard emulation" mode (they type the card
//    UID followed by Enter), on any device with a browser: PC, Mac, iPad,
//    Android tablet;
//  - the phone's own NFC on Android Chrome (Web NFC).
// It authenticates with the reader's device token, stored only in this
// browser, and sends every tap to the same scan API as any other reader.

const TOKEN_KEY = "edutrack.kiosk.token";
const INFO_KEY = "edutrack.kiosk.info";
const QUEUE_KEY = "edutrack.kiosk.queue";
const RESULT_MS = 3500;
const RETRY_MS = 5000;

type Info = {
  device: { name: string; status: "active" | "disabled"; location: string | null; class_name: string | null };
  school: { name: string; timezone: string; status: string };
};
type Queued = { key: string; uid: string; scanned_at: string };
type Shown = { view: ScanView; body: ScanBody; offline?: boolean };

function load<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* storage unavailable: the kiosk still works for this page load */
  }
}

function loadToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let audio: AudioContext | null = null;
function beep(tone: ScanView["tone"]) {
  try {
    audio ??= new AudioContext();
    const notes = tone === "accept" ? [[880, 0.12]] : tone === "warn" ? [[660, 0.1], [660, 0.1]] : [[220, 0.35]];
    let t = audio.currentTime;
    for (const [freq, len] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + len);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + len);
      t += len + 0.06;
    }
  } catch {
    /* sound is optional */
  }
}

async function postScan(token: string, q: Queued) {
  return fetch("/api/v1/attendance/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": q.key },
    body: JSON.stringify({ uid: q.uid, scanned_at: q.scanned_at }),
  });
}

export function Kiosk() {
  const [phase, setPhase] = useState<"loading" | "setup" | "ready">("loading");
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [synced, setSynced] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [phoneNfc, setPhoneNfc] = useState<"unsupported" | "off" | "on" | "error">("unsupported");
  const inputRef = useRef<HTMLInputElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);

  const connect = useCallback(async (candidate: string) => {
    const t = candidate.trim();
    try {
      const res = await fetch("/api/v1/devices/me", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      if (res.status === 401) {
        save(TOKEN_KEY, null);
        setSetupError("Ese token no es válido o fue reemplazado. Crea uno nuevo en Configuración → Lectores NFC.");
        setPhase("setup");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Info;
      save(TOKEN_KEY, t);
      save(INFO_KEY, data);
      setToken(t);
      setInfo(data);
      setSetupError(null);
      setPhase("ready");
    } catch {
      // Offline start: keep working with what we knew; taps are queued.
      const cached = load<Info>(INFO_KEY);
      if (cached && loadToken() === t) {
        setToken(t);
        setInfo(cached);
        setPhase("ready");
      } else {
        setSetupError("No se pudo conectar con EduTrack. Revisa el internet e inténtalo de nuevo.");
        setPhase("setup");
      }
    }
  }, []);

  // Boot: token from a setup link (#token=…, never sent to the server) or storage.
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (fromHash) {
      // Store before clearing the URL so a re-run of this effect still finds it.
      save(TOKEN_KEY, fromHash);
      window.history.replaceState(null, "", window.location.pathname);
    }
    const stored = loadToken();
    const t = window.setTimeout(() => {
      if (stored) void connect(stored);
      else setPhase("setup");
      setPending(load<Queued[]>(QUEUE_KEY)?.length ?? 0);
      setOnline(navigator.onLine);
      if ("NDEFReader" in window) setPhoneNfc("off");
    }, 0);
    return () => window.clearTimeout(t);
  }, [connect]);

  // Clock, connectivity and screen wake lock.
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 15_000);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    let lock: { release: () => Promise<void> } | null = null;
    const wake = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        if (document.visibilityState === "visible" && nav.wakeLock) lock = await nav.wakeLock.request("screen");
      } catch {
        /* not supported */
      }
    };
    void wake();
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(clock);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      document.removeEventListener("visibilitychange", wake);
      void lock?.release().catch(() => {});
    };
  }, []);

  const show = useCallback((s: Shown) => {
    setShown(s);
    beep(s.view.tone);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setShown(null), RESULT_MS);
  }, []);

  const enqueue = useCallback((q: Queued) => {
    const queue = [...(load<Queued[]>(QUEUE_KEY) ?? []), q];
    save(QUEUE_KEY, queue);
    setPending(queue.length);
  }, []);

  // Sends queued taps (same idempotency keys, so a retry never double-counts).
  const flush = useCallback(async () => {
    if (!token || flushing.current) return;
    const queue = load<Queued[]>(QUEUE_KEY) ?? [];
    if (!queue.length) return;
    flushing.current = true;
    let sent = 0;
    try {
      while (queue.length) {
        let res: Response;
        try {
          res = await postScan(token, queue[0]);
        } catch {
          break; // still offline
        }
        if (res.status >= 500) break;
        queue.shift(); // delivered (or rejected for good: don't retry forever)
        sent++;
        save(QUEUE_KEY, queue);
        setPending(queue.length);
      }
    } finally {
      flushing.current = false;
    }
    if (sent) {
      setOnline(true);
      setSynced(true);
      window.setTimeout(() => setSynced(false), 3000);
    }
  }, [token]);

  useEffect(() => {
    if (phase !== "ready") return;
    const t = window.setInterval(() => void flush(), RETRY_MS);
    window.addEventListener("online", flush);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("online", flush);
    };
  }, [phase, flush]);

  const submit = useCallback(
    async (raw: string) => {
      if (!token || busy) return;
      const uid = normalizeUid(raw);
      if (!uid) {
        show({ view: { tone: "reject", title: "Tarjeta no reconocida", hint: "El lector envió un código con un formato que EduTrack no entiende." }, body: {} });
        return;
      }
      const q: Queued = { key: crypto.randomUUID(), uid, scanned_at: new Date().toISOString() };
      setBusy(true);
      try {
        const res = await postScan(token, q);
        if (res.status === 401) {
          save(TOKEN_KEY, null);
          setSetupError("Este lector fue desactivado o su token fue reemplazado. Configúralo de nuevo.");
          setPhase("setup");
          return;
        }
        if (res.status >= 500) throw new Error("server");
        const body = (await res.json().catch(() => ({ error: "invalid_response" }))) as ScanBody;
        setOnline(true);
        show({ view: describeScan(body), body });
        void flush();
      } catch {
        enqueue(q);
        setOnline(navigator.onLine);
        show({
          view: { tone: "warn", title: "Lectura guardada", hint: "Sin conexión: se enviará sola cuando vuelva el internet." },
          body: {},
          offline: true,
        });
      } finally {
        setBusy(false);
      }
    },
    [token, busy, show, enqueue, flush],
  );

  // Keep the hidden input focused so keyboard-emulation readers always land here.
  useEffect(() => {
    if (phase !== "ready" || menu || confirmReset) return;
    const focus = () => inputRef.current?.focus({ preventScroll: true });
    focus();
    const t = window.setInterval(() => {
      if (document.activeElement !== inputRef.current) focus();
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, menu, confirmReset]);

  async function startPhoneNfc() {
    try {
      const Reader = (window as unknown as { NDEFReader: new () => { scan: () => Promise<void>; onreading: ((e: { serialNumber: string }) => void) | null } }).NDEFReader;
      const reader = new Reader();
      await reader.scan();
      reader.onreading = (e) => void submit(e.serialNumber);
      setPhoneNfc("on");
    } catch {
      setPhoneNfc("error");
    }
  }

  const tz = info?.school.timezone ?? "America/Bogota";
  const connLabel = !online ? "Sin internet" : busy ? "Sincronizando…" : synced ? "Sincronizado" : "Conectado";
  const connClass = !online ? "bad" : busy || pending ? "warn" : "";

  if (phase === "loading") {
    return <main className="kiosk" aria-busy="true" />;
  }

  if (phase === "setup") {
    return (
      <main className="kiosk kiosk-setup">
        <form
          className="card stack"
          style={{ maxWidth: 440, width: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void connect(draft);
          }}
        >
          <div className="brand" style={{ padding: 0, color: "var(--text)" }}>
            <BrandMark />
            <BrandName />
          </div>
          <div>
            <h1 style={{ fontSize: "1.35rem" }}>Configurar lector</h1>
            <p className="text-2" style={{ margin: 0 }}>
              En EduTrack, ve a <strong>Configuración → Lectores NFC</strong>, crea un lector (o pide un token nuevo) y pega aquí el
              token. Solo se hace una vez en este aparato.
            </p>
          </div>
          {setupError && (
            <div className="callout danger">
              <p>{setupError}</p>
            </div>
          )}
          <label>
            Token del lector
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="sat_…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mono"
            />
          </label>
          <button type="submit" className="lg" disabled={!draft.trim()}>
            <KeyRound size={17} /> Conectar lector
          </button>
          <p className="hint">El token queda guardado solo en este navegador. Usa este aparato únicamente como lector del salón.</p>
        </form>
      </main>
    );
  }

  const recorded = shown?.body.outcome === "recorded" ? shown.body.attendance : null;

  return (
    <main
      className="kiosk"
      onPointerDown={() => {
        if (!menu && !confirmReset) inputRef.current?.focus({ preventScroll: true });
      }}
    >
      <input
        ref={inputRef}
        className="kiosk-capture"
        inputMode="none"
        autoComplete="off"
        aria-label="Entrada del lector NFC"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const value = e.currentTarget.value;
            e.currentTarget.value = "";
            if (value.trim()) void submit(value);
          }
        }}
      />

      <header className="kiosk-bar">
        <div className="row">
          <BrandMark size={16} />
          <div>
            <div className="kiosk-school">{info?.school.name}</div>
            <div className="kiosk-sub">
              {info?.device.name}
              {info?.device.class_name ? ` · ${info.device.class_name}` : ""}
            </div>
          </div>
        </div>
        <div className="row">
          <span className={`conn-pill ${connClass}`}>
            <i /> {connLabel}
            {pending > 0 && ` · ${pending} pendiente${pending === 1 ? "" : "s"}`}
          </span>
          <button type="button" className="icon-btn kiosk-icon" aria-label="Opciones del lector" onClick={() => setMenu(true)}>
            <Settings size={19} />
          </button>
        </div>
      </header>

      <section className={`kiosk-center ${busy ? "busy" : ""} ${!online ? "offline" : ""}`}>
        {shown ? (
          <div className={`scan-result kiosk-result ${shown.view.tone === "accept" ? "" : shown.view.tone}`} role="status" aria-live="assertive">
            <div className="res-head">
              <span className={`check-circle ${shown.view.tone === "accept" ? "" : shown.view.tone}`}>
                {shown.view.tone === "accept" ? (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 12.5 10 17.5 19 7.5" />
                  </svg>
                ) : shown.offline ? (
                  <WifiOff size={26} />
                ) : shown.view.tone === "warn" ? (
                  <Clock size={26} />
                ) : (
                  <X size={28} />
                )}
              </span>
              <div className="grow">
                <p className="res-title">{shown.view.title}</p>
                {shown.body.student && <div className="kiosk-name">{shown.body.student.display_name}</div>}
              </div>
            </div>
            {recorded ? (
              <dl className="res-grid">
                <div>
                  <dt>Clase</dt>
                  <dd>{recorded.class_name}</dd>
                </div>
                <div>
                  <dt>Hora</dt>
                  <dd>{fmtTime(recorded.checked_in_at ?? shown.body.effective_at ?? new Date(), tz)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <StatusBadge status={recorded.status} />
                  </dd>
                </div>
              </dl>
            ) : (
              shown.view.hint && <p className="hint">{shown.view.hint}</p>
            )}
          </div>
        ) : (
          <>
            <div className="nfc-rings kiosk-rings">
              <div className="nfc-core">{!online ? <WifiOff size={48} /> : <Nfc size={52} />}</div>
            </div>
            <h1 className="kiosk-title">{busy ? "Leyendo…" : "Acerca la tarjeta NFC"}</h1>
            <p className="kiosk-sub" style={{ fontSize: "1rem" }}>
              {!online ? "Sin internet: las lecturas se guardan y se envían solas al volver la conexión." : "Tu asistencia se confirma al instante."}
            </p>
            {info?.device.status === "disabled" && (
              <div className="callout warning" style={{ maxWidth: 420 }}>
                <p>Este lector está desactivado. Actívalo en Configuración → Lectores NFC.</p>
              </div>
            )}
          </>
        )}
      </section>

      <footer className="kiosk-foot">
        <span>{fmtLongDate(now, tz)}</span>
        <strong className="kiosk-clock">{fmtTime(now, tz)}</strong>
      </footer>

      {menu && (
        <div className="drawer-backdrop" onClick={() => setMenu(false)}>
          <div className="card stack kiosk-menu" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <h2 style={{ margin: 0 }}>Opciones del lector</h2>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setMenu(false)}>
                <X size={18} />
              </button>
            </div>
            <dl className="kv">
              <dt>Colegio</dt>
              <dd>{info?.school.name}</dd>
              <dt>Lector</dt>
              <dd>{info?.device.name}</dd>
              <dt>Clase</dt>
              <dd>{info?.device.class_name ?? "Cualquiera (general)"}</dd>
              <dt>Pendientes por enviar</dt>
              <dd>{pending}</dd>
            </dl>
            {phoneNfc !== "unsupported" && (
              <button type="button" className="secondary" disabled={phoneNfc === "on"} onClick={() => void startPhoneNfc()}>
                <Smartphone size={16} />
                {phoneNfc === "on" ? "NFC del teléfono activo" : phoneNfc === "error" ? "Reintentar NFC del teléfono" : "Usar el NFC de este teléfono"}
              </button>
            )}
            <form
              className="stack-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const v = String(f.get("uid") ?? "");
                e.currentTarget.reset();
                setMenu(false);
                if (v.trim()) void submit(v);
              }}
            >
              <label>
                Probar escribiendo un UID
                <input name="uid" className="mono" placeholder="04:A2:2B:1C" autoComplete="off" />
              </label>
              <button type="submit" className="secondary">
                Enviar lectura de prueba
              </button>
            </form>
            <button type="button" className="danger" onClick={() => setConfirmReset(true)}>
              <LogOut size={16} /> Desconectar este aparato
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmReset}
        title="¿Desconectar este lector?"
        message="Este aparato dejará de registrar asistencia hasta que pegues el token de nuevo."
        confirmLabel="Desconectar"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          save(TOKEN_KEY, null);
          save(INFO_KEY, null);
          setConfirmReset(false);
          setMenu(false);
          setToken(null);
          setInfo(null);
          setDraft("");
          setPhase("setup");
        }}
      />
    </main>
  );
}
