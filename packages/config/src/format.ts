import { CurrencyCode, LocaleTag } from "@taskswift/types";

/** Zero-decimal currencies where `amount` is already the full unit (e.g. COP). */
const ZERO_DECIMAL_CURRENCIES = new Set(["COP"]);

export function formatMoney(amount: number, currency: CurrencyCode, locale: LocaleTag = "es-CO"): string {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(amount);
}
