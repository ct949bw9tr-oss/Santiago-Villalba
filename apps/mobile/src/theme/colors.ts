export const colors = {
  brand: "#0B5FFF",
  brandDark: "#0844C0",
  brandSoft: "#EAF1FF",
  accent: "#00C48C",
  warning: "#FFB020",
  danger: "#E5484D",

  bg: "#FFFFFF",
  bgMuted: "#F6F7F9",
  card: "#FFFFFF",
  border: "#E7E9EC",

  textPrimary: "#12151A",
  textSecondary: "#5B6472",
  textMuted: "#9AA2AE",
  textInverse: "#FFFFFF",

  star: "#FFB020",
  online: "#00C48C",
  offline: "#9AA2AE",
};

export const statusColors: Record<string, string> = {
  draft: colors.textMuted,
  requested: colors.warning,
  pending_provider: colors.warning,
  accepted: colors.brand,
  provider_en_route: colors.brand,
  in_progress: colors.brand,
  awaiting_completion_confirmation: colors.warning,
  completed: colors.accent,
  cancelled_customer: colors.danger,
  cancelled_provider: colors.danger,
  expired: colors.textMuted,
  disputed: colors.danger,
  refunded: colors.textMuted,
};
