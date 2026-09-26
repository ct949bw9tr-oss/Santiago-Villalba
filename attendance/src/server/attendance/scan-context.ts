import "server-only";
import { findSchoolAccess, hasRole } from "@/lib/auth/roles";
import { getCurrentUser, getMyMemberships } from "@/server/auth/session";
import { createSupabaseAdminClient } from "@/server/db/supabase-admin";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { DeviceKind } from "./scan-request";
import { hashDeviceToken, looksLikeDeviceToken } from "./tokens";

// The ONLY two ways to obtain a ScanContext. Everything downstream trusts the
// context and nothing from the request body.

export type ScanContext = {
  deviceId: string;
  deviceKind: DeviceKind;
  schoolId: string;
};

export type AuthResult = { ok: true; ctx: ScanContext } | { ok: false; status: 401 | 403; error: string };

/** A registered reader presenting `Authorization: Bearer <token>`. */
export async function authenticateReader(token: string): Promise<AuthResult> {
  if (!looksLikeDeviceToken(token)) return { ok: false, status: 401, error: "invalid_token" };

  const admin = createSupabaseAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("id, school_id, kind")
    .eq("token_hash", hashDeviceToken(token))
    .eq("kind", "reader")
    .maybeSingle();
  if (!device) return { ok: false, status: 401, error: "invalid_token" };

  // Disabled readers still reach the engine so the tap is logged as device_disabled.
  return { ok: true, ctx: { deviceId: device.id, deviceKind: "reader", schoolId: device.school_id } };
}

/**
 * The web simulator: a signed-in ADMIN of the school named by the
 * X-School-Slug header, with the simulator switched on for that school. Scans
 * are attributed to that school's simulator device.
 */
export async function authenticateSimulator(schoolSlug: string): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401, error: "not_signed_in" };

  const access = findSchoolAccess(await getMyMemberships(), schoolSlug);
  if (!access || !hasRole(access, "school_admin")) return { ok: false, status: 403, error: "not_an_admin" };
  if (access.school.status !== "active") return { ok: false, status: 403, error: "school_suspended" };

  const supabase = await createSupabaseServerClient();
  const [{ data: school }, { data: device }] = await Promise.all([
    supabase.from("schools").select("settings").eq("id", access.school.id).single(),
    supabase.from("devices").select("id").eq("school_id", access.school.id).eq("kind", "simulator").maybeSingle(),
  ]);
  if (!school?.settings?.simulator_enabled) return { ok: false, status: 403, error: "simulator_disabled" };
  if (!device) return { ok: false, status: 403, error: "simulator_missing" };

  return { ok: true, ctx: { deviceId: device.id, deviceKind: "simulator", schoolId: access.school.id } };
}
