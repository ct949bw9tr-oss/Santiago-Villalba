import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/server/db/supabase-server";

// Landing URL for invitation and password-recovery emails. The email links
// here with a one-time token_hash (see supabase/templates/); verifying it
// creates the session cookie server-side.

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "email"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const defaultNext = type === "invite" || type === "recovery" ? "/account/password" : "/";
  const next = safeRedirectPath(params.get("next"), defaultNext);

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  }

  redirect("/login?error=link");
}
