import { supabase } from "./supabase";

/** Ensures there is a live Supabase Auth session, signing in anonymously if needed.
 * Requires "Allow anonymous sign-ins" to be enabled in the Supabase project's
 * Authentication settings. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signedIn.session;
}

/** Attaches the current session to a seeded demo user row (see quick-login buttons on
 * the login screen). */
export async function claimDemoUser(userId: string) {
  await ensureSession();
  const { error } = await supabase.rpc("claim_demo_user", { target_user_id: userId });
  if (error) throw error;
}

/** Self-registration for the phone/OTP flow: creates a fresh `users` row owned by the
 * current (anonymous) session. */
export async function registerByPhone(input: { phone: string; firstName: string; lastName: string; countryCode: string }) {
  const session = await ensureSession();
  const { data, error } = await supabase
    .from("users")
    .insert({
      auth_user_id: session!.user.id,
      phone: input.phone,
      first_name: input.firstName,
      last_name: input.lastName,
      locale: "es-CO",
      country_code: input.countryCode,
      auth_providers: ["phone"],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
