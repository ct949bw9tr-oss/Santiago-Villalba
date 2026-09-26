"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { wallTimeInZone, zonedWallTimeToUtc } from "@/lib/time";

type Student = { id: string; name: string; uid: string };

type ScanResult = {
  httpStatus: number;
  key: string;
  body: {
    outcome?: string;
    feedback?: "accept" | "warn" | "reject";
    message?: string;
    replayed?: boolean;
    error?: string;
    [k: string]: unknown;
  };
};

const FEEDBACK_STYLE: Record<string, { bg: string; label: string }> = {
  accept: { bg: "#2e7d32", label: "✓" },
  warn: { bg: "#b26a00", label: "!" },
  reject: { bg: "#b3261e", label: "✕" },
};

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

  async function send(key: string) {
    setPending(true);
    try {
      const body: Record<string, string> = { uid };
      // The typed time is the SCHOOL's wall-clock time, whatever the viewer's timezone.
      if (useCustomTime && customTime) body.scanned_at = zonedWallTimeToUtc(customTime, timeZone).toISOString();
      const res = await fetch("/api/v1/attendance/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key, "X-School-Slug": schoolSlug },
        body: JSON.stringify(body),
      });
      setResult({ httpStatus: res.status, key, body: await res.json().catch(() => ({ error: "invalid response" })) });
      router.refresh();
    } catch {
      setResult({ httpStatus: 0, key, body: { error: "network error" } });
    } finally {
      setPending(false);
    }
  }

  const style = result?.body.feedback ? FEEDBACK_STYLE[result.body.feedback] : FEEDBACK_STYLE.reject;

  return (
    <div className="stack">
      <div className="form-grid">
        <label>
          Student
          <select
            value={students.find((s) => s.uid === uid)?.id ?? ""}
            onChange={(e) => setUid(students.find((s) => s.id === e.target.value)?.uid ?? "")}
          >
            <option value="">— type a UID instead —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Card UID
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            placeholder="04:A2:2B:1C:9F:5E:80"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            style={{ fontFamily: "monospace" }}
          />
        </label>
      </div>

      <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox"
          checked={useCustomTime}
          onChange={(e) => {
            setUseCustomTime(e.target.checked);
            if (e.target.checked && !customTime) setCustomTime(wallTimeInZone(new Date(), timeZone));
          }}
        />
        Pretend the tap happens at another time (to test late / absent)
      </label>
      {useCustomTime && (
        <label>
          Tap time (school time, {timeZone})
          <input type="datetime-local" value={customTime} onChange={(e) => setCustomTime(e.target.value)} />
        </label>
      )}

      <div className="inline">
        <button type="button" disabled={pending || !uid.trim()} onClick={() => send(crypto.randomUUID())}>
          {pending ? "Scanning…" : "Simulate NFC Scan"}
        </button>
        {result && (
          <button type="button" className="secondary" disabled={pending} onClick={() => send(result.key)}>
            Resend same tap (network retry)
          </button>
        )}
      </div>

      {result && (
        <div className="card stack" style={{ borderLeft: `6px solid ${style.bg}` }} aria-live="polite">
          <div className="inline">
            <span
              style={{
                background: style.bg,
                color: "#fff",
                borderRadius: "999px",
                width: "2rem",
                height: "2rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {style.label}
            </span>
            <strong style={{ fontSize: "1.2rem" }}>{result.body.message ?? result.body.error ?? "Error"}</strong>
            {result.body.replayed && <span className="badge">replayed — nothing new recorded</span>}
          </div>
          <details>
            <summary className="muted">API response (HTTP {result.httpStatus})</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", margin: 0 }}>
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
