import "server-only";
import { createSupabaseAdminClient } from "@/server/db/supabase-admin";
import type { ScanContext } from "./scan-context";

export type ScanResponse = {
  scan_id: string;
  outcome:
    | "recorded"
    | "duplicate"
    | "unknown_credential"
    | "inactive_credential"
    | "inactive_student"
    | "no_active_session"
    | "not_enrolled"
    | "too_early"
    | "after_cutoff"
    | "device_disabled"
    | "school_suspended";
  feedback: "accept" | "warn" | "reject";
  message: string;
  effective_at: string;
  attendance: {
    record_id: string;
    status: "present" | "late" | "absent" | "excused";
    class_session_id: string;
    class_name: string;
    checked_in_at: string | null;
  } | null;
  student: { display_name: string } | null;
  replayed?: boolean;
};

export type ProcessScanResult =
  | { ok: true; response: ScanResponse }
  | { ok: false; status: 409 | 500; error: string };

/**
 * The single entry point into the attendance engine (public.process_scan).
 * Called by the scan API for readers and the simulator alike.
 */
export async function processScan(
  ctx: ScanContext,
  input: {
    uid: string;
    idempotencyKey: string;
    effectiveAt: Date;
    deviceScannedAt?: string;
    detail: string | null;
    requestId: string;
  },
): Promise<ProcessScanResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("process_scan", {
    p_device_id: ctx.deviceId,
    p_uid: input.uid,
    p_idempotency_key: input.idempotencyKey,
    p_effective_at: input.effectiveAt.toISOString(),
    p_device_scanned_at: input.deviceScannedAt ?? null,
    p_request_id: input.requestId,
    p_detail: input.detail,
  });

  if (error) {
    console.error("process_scan failed", { requestId: input.requestId, error });
    return { ok: false, status: 500, error: "internal_error" };
  }
  if (data?.error === "idempotency_conflict") {
    return { ok: false, status: 409, error: "idempotency_key_reused_with_different_card" };
  }
  return { ok: true, response: data as ScanResponse };
}
