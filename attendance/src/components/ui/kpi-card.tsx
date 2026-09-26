import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Tone } from "@/lib/ui/format";

export type Trend = { delta: number; unit?: string; goodWhen: "up" | "down"; label?: string };

function TrendPill({ trend }: { trend: Trend }) {
  const { delta, unit = "", goodWhen } = trend;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="trend flat">
        <Minus size={12} /> 0{unit}
      </span>
    );
  }
  const good = goodWhen === "up" ? rounded > 0 : rounded < 0;
  const Icon = rounded > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`trend ${good ? "up" : "down"}`}>
      <Icon size={12} /> {rounded > 0 ? "+" : ""}
      {rounded}
      {unit}
    </span>
  );
}

export function KpiCard({
  icon: Icon,
  tone,
  value,
  suffix,
  label,
  trend,
  foot,
}: {
  icon: LucideIcon;
  tone: Tone;
  value: React.ReactNode;
  suffix?: string;
  label: string;
  trend?: Trend | null;
  foot?: React.ReactNode;
}) {
  return (
    <div className="card kpi fade-up">
      <div className="kpi-top">
        <div className={`kpi-icon tone-${tone}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        {trend && <TrendPill trend={trend} />}
      </div>
      <div>
        <div className="kpi-value">
          {value}
          {suffix && <small>{suffix}</small>}
        </div>
        <div className="kpi-label">{label}</div>
      </div>
      {(foot || trend?.label) && <div className="kpi-foot">{foot ?? trend?.label}</div>}
    </div>
  );
}
