const COLORS: Record<string, string> = {
  // booking statuses
  draft: "#9aa2ae",
  requested: "#ffb020",
  pending_provider: "#ffb020",
  accepted: "#0b5fff",
  provider_en_route: "#0b5fff",
  in_progress: "#0b5fff",
  awaiting_completion_confirmation: "#ffb020",
  completed: "#00c48c",
  cancelled_customer: "#e5484d",
  cancelled_provider: "#e5484d",
  expired: "#9aa2ae",
  disputed: "#e5484d",
  refunded: "#9aa2ae",
  // verification / misc
  unverified: "#9aa2ae",
  phone_verified: "#ffb020",
  identity_pending: "#ffb020",
  identity_verified: "#00c48c",
  rejected: "#e5484d",
  suspended: "#e5484d",
  // payment statuses
  pending: "#ffb020",
  authorized: "#0b5fff",
  paid: "#00c48c",
  held: "#ffb020",
  failed: "#e5484d",
  partially_refunded: "#ffb020",
  // reports/disputes
  open: "#ffb020",
  investigating: "#0b5fff",
  resolved_refund: "#00c48c",
  resolved_no_refund: "#00c48c",
  closed: "#9aa2ae",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const color = COLORS[status] ?? "#9aa2ae";
  return (
    <span className="badge" style={{ backgroundColor: `${color}22`, color }}>
      <span className="badge-dot" style={{ backgroundColor: color }} />
      {label ?? status}
    </span>
  );
}
