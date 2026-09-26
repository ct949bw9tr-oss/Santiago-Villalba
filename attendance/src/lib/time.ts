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

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock time in `timeZone` ("YYYY-MM-DDTHH:mm", as produced by
 * <input type="datetime-local">) to the UTC instant it denotes. Independent of
 * the viewer's own timezone.
 */
export function zonedWallTimeToUtc(local: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error(`Invalid local time: ${local}`);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset correctly around DST changes.
  let utc = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  utc = guess - timeZoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/** "YYYY-MM-DDTHH:mm" wall-clock time of `instant` in `timeZone`. */
export function wallTimeInZone(instant: Date, timeZone: string): string {
  const offset = timeZoneOffsetMs(instant, timeZone);
  return new Date(instant.getTime() + offset).toISOString().slice(0, 16);
}
