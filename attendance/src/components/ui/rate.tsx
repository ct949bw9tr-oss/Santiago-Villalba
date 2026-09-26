import { fmtRate, rateTone } from "@/lib/ui/format";

const TONE_COLOR = { green: "var(--success)", orange: "#f5a524", red: "var(--danger)", gray: "#c3cbdb" } as const;

/** Attendance-rate figure with a colored progress bar. */
export function RateCell({ rate }: { rate: number | null }) {
  const tone = rateTone(rate) as keyof typeof TONE_COLOR;
  return (
    <div className="rate-cell">
      <strong style={{ color: rate === null ? "var(--muted)" : undefined }}>{fmtRate(rate)}</strong>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${rate ?? 0}%`, background: TONE_COLOR[tone] ?? TONE_COLOR.gray }} />
      </div>
    </div>
  );
}

/** Horizontal stacked bar of status counts. */
export function StatusBar({ present, late, absent, excused }: { present: number; late: number; absent: number; excused: number }) {
  const total = present + late + absent + excused;
  if (!total) return <div className="progress" aria-hidden="true" />;
  const pct = (n: number) => `${(100 * n) / total}%`;
  return (
    <div className="progress stacked" aria-hidden="true">
      <span className="p-present" style={{ width: pct(present) }} />
      <span className="p-late" style={{ width: pct(late) }} />
      <span className="p-absent" style={{ width: pct(absent) }} />
      <span className="p-excused" style={{ width: pct(excused) }} />
    </div>
  );
}
