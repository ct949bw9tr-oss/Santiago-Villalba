import { z } from "zod";

// Contract of POST /api/v1/attendance/scans (see docs/API.md).
// Deliberately contains NO school, device or student id: those come only from
// the caller's verified credentials.

export const scanRequestSchema = z.object({
  uid: z.string().trim().min(1).max(64),
  scanned_at: z.iso.datetime({ offset: true }).optional(),
  reader: z.record(z.string(), z.unknown()).optional(),
});

export type ScanRequest = z.infer<typeof scanRequestSchema>;

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export type DeviceKind = "reader" | "simulator";

/** A reader's clock is trusted when it's close to ours. */
export const READER_CLOCK_TOLERANCE_MS = 2 * 60 * 1000;
/**
 * Readers that were offline upload stored taps later with their original
 * time. Accepted up to this far in the past (a school day), never in the future.
 */
export const READER_OFFLINE_MAX_MS = 12 * 60 * 60 * 1000;
/** The simulator may pretend to scan at another time, within a day. */
export const SIMULATOR_TIME_RANGE_MS = 24 * 60 * 60 * 1000;

/**
 * Which instant a scan counts for.
 * - Readers: their own timestamp if within ±2 min of receipt; a past
 *   timestamp up to 12 h old is a tap stored while offline (tagged); anything
 *   else (future, or older) falls back to the receipt time.
 * - Simulator: any time within ±24 h (to test late/absent rules); tagged.
 */
export function effectiveScanTime(
  kind: DeviceKind,
  receivedAt: Date,
  scannedAt?: string,
): { ok: true; effectiveAt: Date; detail: string | null } | { ok: false; error: string } {
  if (!scannedAt) return { ok: true, effectiveAt: receivedAt, detail: null };
  const claimed = new Date(scannedAt);
  const offset = claimed.getTime() - receivedAt.getTime(); // < 0: in the past
  const drift = Math.abs(offset);

  if (kind === "simulator") {
    if (drift > SIMULATOR_TIME_RANGE_MS) return { ok: false, error: "scanned_at must be within 24 hours of now" };
    return { ok: true, effectiveAt: claimed, detail: drift > READER_CLOCK_TOLERANCE_MS ? "simulated time" : null };
  }
  if (drift <= READER_CLOCK_TOLERANCE_MS) return { ok: true, effectiveAt: claimed, detail: null };
  if (offset < 0 && -offset <= READER_OFFLINE_MAX_MS) return { ok: true, effectiveAt: claimed, detail: "stored offline" };
  return { ok: true, effectiveAt: receivedAt, detail: "reader clock ignored" };
}
