import type { AttendanceStatus } from "@/lib/reports/filters";
import { STATUS_LABEL } from "@/lib/ui/format";

export type BadgeTone = "success" | "warning" | "danger" | "violet" | "info" | "neutral";

export function Badge({ tone = "neutral", dot, children }: { tone?: BadgeTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="bdot" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: "success",
  late: "warning",
  absent: "danger",
  excused: "violet",
};

/** Attendance status pill: present / late / absent / excused, or "pending". */
export function StatusBadge({ status }: { status: AttendanceStatus | null | undefined }) {
  if (!status) return <Badge tone="neutral">Pendiente</Badge>;
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
