import { formatMoney } from "@taskswift/config";
import { BookingStatus } from "@taskswift/types";

export { formatMoney };

export const BOOKING_STATUS_LABEL_ES: Record<BookingStatus, string> = {
  draft: "Borrador",
  requested: "Solicitado",
  pending_provider: "Esperando al proveedor",
  accepted: "Aceptado",
  provider_en_route: "Proveedor en camino",
  in_progress: "En curso",
  awaiting_completion_confirmation: "Esperando confirmación",
  completed: "Completado",
  cancelled_customer: "Cancelado por el cliente",
  cancelled_provider: "Cancelado por el proveedor",
  expired: "Expirado",
  disputed: "En disputa",
  refunded: "Reembolsado",
};

export function formatDistance(km: number | null): string {
  if (km === null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatDateTime(iso: string | undefined, locale = "es-CO"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function formatRelativeDay(iso: string | undefined, locale = "es-CO"): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays === -1) return "Ayer";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
}

export function pricingLabel(model: string, price: number | null, currency: string): string {
  if (model === "custom_quote" || price === null) return "Cotización personalizada";
  const amount = formatMoney(price, currency);
  switch (model) {
    case "starting_at":
      return `Desde ${amount}`;
    case "hourly":
      return `${amount} / hora`;
    default:
      return amount;
  }
}
