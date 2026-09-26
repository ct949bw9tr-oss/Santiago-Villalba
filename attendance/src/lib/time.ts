// Timezone helpers. Instants are stored in UTC; anything a person sees or any
// "which day is it" question is answered in the school's IANA timezone.

/** Calendar date (YYYY-MM-DD) of `instant` in `timeZone`. */
export function localDateKey(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * A UTC window guaranteed to contain the whole local calendar day of `instant`
 * in any timezone (UTC offsets range from -12h to +14h). Callers narrow the
 * results with `localDateKey`.
 */
export function utcWindowAroundLocalDay(instant: Date): { from: Date; to: Date } {
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    from: new Date(instant.getTime() - 1.5 * dayMs),
    to: new Date(instant.getTime() + 1.5 * dayMs),
  };
}

export function formatLocalTime(instant: Date | string, timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}

export function formatLocalDate(instant: Date | string, timeZone: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(instant));
}
