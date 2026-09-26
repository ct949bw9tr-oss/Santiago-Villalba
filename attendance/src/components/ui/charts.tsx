// Dependency-free SVG charts. Server-rendered; tooltips via <title>.

export const CHART_COLORS = {
  primary: "#2f5bea",
  soft: "#bccbff",
  green: "#16a34a",
  orange: "#f5a524",
  red: "#e5484d",
  violet: "#7a5af8",
  gray: "#c3cbdb",
};

type Segment = { value: number; color: string; label?: string };
export type BarDatum = { label: string; segments: Segment[]; title?: string };

/** Smallest "nice" top value divisible into 4 whole-number ticks. */
function niceMax(v: number): number {
  const raw = Math.max(1, v / 4);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = Math.max(1, Math.ceil((n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow));
  return step * 4;
}

/** Vertical (optionally stacked) bar chart. */
export function BarChart({ data, height = 220, max }: { data: BarDatum[]; height?: number; max?: number }) {
  const W = 640;
  const H = height;
  const padL = 34;
  const padB = 26;
  const padT = 8;
  const innerW = W - padL;
  const innerH = H - padB - padT;
  const top = max ?? niceMax(Math.max(1, ...data.map((d) => d.segments.reduce((s, x) => s + x.value, 0))));
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.min(34, slot * 0.56);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t) => {
        const y = padT + innerH * (1 - t);
        return (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W} y1={y} y2={y} strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={padL - 8} y={y + 4} textAnchor="end">
              {Math.round(top * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = padL + slot * i + (slot - barW) / 2;
        let acc = 0;
        const total = d.segments.reduce((s, x) => s + x.value, 0);
        return (
          <g key={d.label + i}>
            <title>{d.title ?? `${d.label}: ${total}`}</title>
            {total === 0 && <rect x={x} y={padT + innerH - 3} width={barW} height={3} rx={1.5} fill="#edf0f6" />}
            {d.segments.map((s, j) => {
              const h = (innerH * s.value) / top;
              const y = padT + innerH - ((acc + s.value) * innerH) / top;
              acc += s.value;
              if (h <= 0) return null;
              const isTop = j === d.segments.length - 1 || d.segments.slice(j + 1).every((n) => n.value === 0);
              return (
                <path
                  key={j}
                  className="bar"
                  fill={s.color}
                  d={roundedTopRect(x, y, barW, h, isTop ? Math.min(6, barW / 2, h) : 0)}
                />
              );
            })}
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={H - 6} textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function roundedTopRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export type LineSeries = { name: string; color: string; values: (number | null)[]; dashed?: boolean; area?: boolean };

/** Line chart for rates over time; null values leave gaps. */
export function LineChart({
  labels,
  series,
  height = 240,
  min = 0,
  max = 100,
  unit = "%",
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const W = 640;
  const H = height;
  const padL = 38;
  const padR = 10;
  const padB = 26;
  const padT = 10;
  const innerW = W - padL - padR;
  const innerH = H - padB - padT;
  const n = Math.max(1, labels.length - 1);
  const xAt = (i: number) => padL + (innerW * i) / n;
  const yAt = (v: number) => padT + innerH * (1 - (v - min) / (max - min || 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  const labelEvery = Math.ceil(labels.length / 10);
  const gid = `g${series.map((s) => s.name).join("").length}${labels.length}`;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={series[0]?.color ?? CHART_COLORS.primary} stopOpacity="0.18" />
          <stop offset="100%" stopColor={series[0]?.color ?? CHART_COLORS.primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid-line" x1={padL} x2={W - padR} y1={yAt(t)} y2={yAt(t)} strokeDasharray={t === min ? undefined : "3 4"} />
          <text x={padL - 8} y={yAt(t) + 4} textAnchor="end">
            {Math.round(t)}
            {unit}
          </text>
        </g>
      ))}
      {labels.map((l, i) =>
        i % labelEvery === 0 || (i === labels.length - 1 && (labels.length - 1) % labelEvery >= labelEvery / 2) ? (
          <text key={i} x={xAt(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}>
            {l}
          </text>
        ) : null,
      )}
      {series.map((s) => {
        const segments: { i: number; v: number }[][] = [];
        let cur: { i: number; v: number }[] = [];
        s.values.forEach((v, i) => {
          if (v === null) {
            if (cur.length) segments.push(cur);
            cur = [];
          } else cur.push({ i, v });
        });
        if (cur.length) segments.push(cur);
        return (
          <g key={s.name}>
            {segments.map((seg, k) => {
              const d = seg.map((p, j) => `${j ? "L" : "M"}${xAt(p.i)},${yAt(p.v)}`).join(" ");
              return (
                <g key={k}>
                  {s.area && seg.length > 1 && (
                    <path d={`${d} L${xAt(seg[seg.length - 1].i)},${yAt(min)} L${xAt(seg[0].i)},${yAt(min)} Z`} fill={`url(#${gid})`} />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={s.dashed ? "5 5" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
            {!s.dashed &&
              s.values.map((v, i) =>
                v === null ? null : (
                  <circle key={i} cx={xAt(i)} cy={yAt(v)} r={labels.length > 20 ? 0 : 3.2} fill="#fff" stroke={s.color} strokeWidth={2}>
                    <title>{`${labels[i]}: ${v}${unit}`}</title>
                  </circle>
                ),
              )}
          </g>
        );
      })}
    </svg>
  );
}

/** Donut with a big figure in the middle. */
export function Donut({
  segments,
  center,
  sub,
  size = 150,
}: {
  segments: Segment[];
  center: string;
  sub?: string;
  size?: number;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" className="chart" style={{ width: size, height: size, flex: "none" }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#edf0f6" strokeWidth="11" />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (c * s.value) / total;
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="11"
              strokeDasharray={`${Math.max(0, len - (segments.length > 1 && len > 2 ? 1.2 : 0))} ${c}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            >
              <title>{`${s.label ?? ""}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      <text x="50" y={sub ? 50 : 55} textAnchor="middle" className="donut-center" style={{ fontSize: 17 }}>
        {center}
      </text>
      {sub && (
        <text x="50" y="63" textAnchor="middle" className="donut-sub">
          {sub}
        </text>
      )}
    </svg>
  );
}

/** Ring showing a single percentage. */
export function Ring({ value, size = 120, color = CHART_COLORS.primary, label }: { value: number | null; size?: number; color?: string; label?: string }) {
  const v = value ?? 0;
  return (
    <Donut
      size={size}
      segments={[
        { value: v, color, label: label ?? "" },
        { value: 100 - v, color: "transparent" },
      ]}
      center={value === null ? "—" : `${Math.round(v)}%`}
      sub={label}
    />
  );
}

export type HBar = { label: React.ReactNode; value: number; display: string; color?: string; key: string };

/** Ranked horizontal bars (value 0-100 as width). */
export function HBars({ rows }: { rows: HBar[] }) {
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.key} className="hbar-row">
          <div className="truncate">{r.label}</div>
          <div className="progress">
            <span style={{ width: `${Math.max(0, Math.min(100, r.value))}%`, background: r.color ?? CHART_COLORS.primary }} />
          </div>
          <div className="val">{r.display}</div>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
