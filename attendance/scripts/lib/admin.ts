// Shared helpers for operator scripts. These run on a trusted machine with the
// Supabase secret key (never in the browser).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Throws with a readable message if a Supabase call failed. */
export function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

/**
 * Returns the auth user id for `email`, creating the account if needed:
 *   - with `password`: created confirmed, ready to sign in (dev/demo).
 *   - without: an invitation email is sent (production).
 */
export async function findOrCreateUser(
  supabase: SupabaseClient,
  opts: { email: string; fullName: string; password?: string },
): Promise<{ id: string; created: boolean; invited: boolean }> {
  const email = opts.email.trim().toLowerCase();

  const existing = check(
    await supabase.from("profiles").select("id").eq("email", email).maybeSingle(),
    "Looking up profile",
  );
  if (existing) return { id: existing.id as string, created: false, invited: false };

  if (opts.password) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: opts.password,
      email_confirm: true,
      user_metadata: { full_name: opts.fullName },
    });
    if (error || !data.user) throw new Error(`Creating user ${email}: ${error?.message}`);
    return { id: data.user.id, created: true, invited: false };
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: opts.fullName },
  });
  if (error || !data.user) throw new Error(`Inviting ${email}: ${error?.message}`);
  return { id: data.user.id, created: true, invited: true };
}
