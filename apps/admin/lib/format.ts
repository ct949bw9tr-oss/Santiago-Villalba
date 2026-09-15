import { formatMoney } from "@taskswift/config";

export { formatMoney };

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(value)
  );
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
