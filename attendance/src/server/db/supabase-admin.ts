import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";

/**
 * Privileged client that BYPASSES Row Level Security.
 *
 * Only for code paths where the tenant is derived from a verified credential
 * (device token, verified admin membership) — never from request input:
 *   - attendance scan ingestion (Phase 3)
 *   - invitations / account provisioning
 *   - scheduled jobs
 * Composite foreign keys still prevent cross-school references.
 */
export function createSupabaseAdminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
