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

/** A reader's clock is trusted only when it's close to ours. */
export const READER_CLOCK_TOLERANCE_MS = 2 * 60 * 1000;
/** The simulator may pretend to scan at another time, within a day. */
export const SIMULATOR_TIME_RANGE_MS = 24 * 60 * 60 * 1000;

/**
 * Which instant a scan counts for.
 * - Readers: their own timestamp if within ±2 min of receipt, else receipt time
 *   (protects against drifting clocks and forged timestamps).
 * - Simulator: any time within ±24 h (to test late/absent rules); tagged.
 */
export function effectiveScanTime(
  kind: DeviceKind,
  receivedAt: Date,
  scannedAt?: string,
): { ok: true; effectiveAt: Date; detail: string | null } | { ok: false; error: string } {
  if (!scannedAt) return { ok: true, effectiveAt: receivedAt, detail: null };
  const claimed = new Date(scannedAt);
  const drift = Math.abs(claimed.getTime() - receivedAt.getTime());

  if (kind === "simulator") {
    if (drift > SIMULATOR_TIME_RANGE_MS) return { ok: false, error: "scanned_at must be within 24 hours of now" };
    return { ok: true, effectiveAt: claimed, detail: drift > READER_CLOCK_TOLERANCE_MS ? "simulated time" : null };
  }
  if (drift <= READER_CLOCK_TOLERANCE_MS) return { ok: true, effectiveAt: claimed, detail: null };
  return { ok: true, effectiveAt: receivedAt, detail: "reader clock ignored" };
}
