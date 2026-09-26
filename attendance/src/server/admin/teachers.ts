"use server";

import { refresh } from "next/cache";
import { createSupabaseAdminClient } from "@/server/db/supabase-admin";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { appOrigin, dbErrorMessage, requireAdminFromForm, type FormState } from "./common";
import { firstIssue, teacherInviteSchema, teacherUpdateSchema, uuid } from "./schemas";

// Account provisioning needs the Auth admin API (service role). Every use of
// the admin client below is preceded by a server-side check that the caller
// administers the school, and only ever touches that school.
//
// Invitations return a sign-in LINK for the admin to share (WhatsApp, email…)
// rather than relying on Supabase's built-in mailer, which only delivers to
// project team members unless custom SMTP is configured.

function confirmLink(origin: string, tokenHash: string, type: "invite" | "recovery" | "magiclink") {
  const params = new URLSearchParams({ token_hash: tokenHash, type, next: "/account/password" });
  return `${origin}/auth/confirm?${params}`;
}

export async function inviteTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const parsed = teacherInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { email, first_name, last_name, employee_number } = parsed.data;

  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  // 1. Find or create the account.
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) return { error: dbErrorMessage(lookupError) };

  let userId = existing?.id as string | undefined;
  let link: string | undefined;

  if (!userId) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: `${first_name} ${last_name}` } },
    });
    if (error || !data.user) return { error: `Couldn't create the account: ${error?.message ?? "unknown error"}` };
    userId = data.user.id;
    link = confirmLink(await appOrigin(), data.properties.hashed_token, "invite");
  } else {
    const { data: already } = await supabase
      .from("teachers")
      .select("id")
      .eq("school_id", access.school.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (already) return { error: "That person is already a teacher in this school." };
  }

  // 2. Membership (server-only write) — reactivates a previously disabled one.
  const { error: membershipError } = await admin
    .from("school_memberships")
    .upsert(
      { school_id: access.school.id, user_id: userId, role: "teacher", status: "active", invited_by: access.user.id },
      { onConflict: "school_id,user_id,role" },
    );
  if (membershipError) return { error: dbErrorMessage(membershipError) };

  // 3. Teacher record, as the admin (RLS applies).
  const { error: teacherError } = await supabase.from("teachers").insert({
    school_id: access.school.id,
    user_id: userId,
    first_name,
    last_name,
    employee_number,
  });
  if (teacherError) return { error: dbErrorMessage(teacherError, { unique: "That employee number is already in use." }) };

  refresh();
  return link
    ? { message: `${first_name} ${last_name} added.`, link }
    : { message: `${first_name} ${last_name} already had an account and was added. They can sign in with their existing password.` };
}

export async function updateTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("teacherId"));
  const parsed = teacherUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Unknown teacher." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("user_id");
  if (error) return { error: dbErrorMessage(error, { unique: "That employee number is already in use." }) };
  if (!data?.length) return { error: "Unknown teacher." };

  // Deactivating a teacher also blocks their sign-in to this school.
  const { error: membershipError } = await supabase
    .from("school_memberships")
    .update({ status: parsed.data.status === "active" ? "active" : "disabled" })
    .eq("school_id", access.school.id)
    .eq("user_id", data[0].user_id)
    .eq("role", "teacher");
  if (membershipError) return { error: dbErrorMessage(membershipError) };

  refresh();
  return { message: "Saved." };
}

/**
 * New sign-in link for a teacher who lost theirs or forgot their password.
 * Refused for accounts that belong to any other school (or are platform
 * admins): an admin must never be able to take over an account whose access
 * extends beyond their own school.
 */
export async function teacherSignInLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("teacherId"));
  if (!id.success) return { error: "Unknown teacher." };

  const supabase = await createSupabaseServerClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .maybeSingle();
  if (!teacher) return { error: "Unknown teacher." };

  const admin = createSupabaseAdminClient();
  const [{ data: memberships }, { data: profile }, { data: authUser }] = await Promise.all([
    admin.from("school_memberships").select("school_id").eq("user_id", teacher.user_id),
    admin.from("profiles").select("email, is_platform_admin").eq("id", teacher.user_id).maybeSingle(),
    admin.auth.admin.getUserById(teacher.user_id),
  ]);

  const otherSchool = (memberships ?? []).some((m) => m.school_id !== access.school.id);
  if (otherSchool || profile?.is_platform_admin) {
    return {
      error:
        "This account also belongs to another school, so a link can't be generated here. Ask them to reset their password from the sign-in page.",
    };
  }
  const email = authUser?.user?.email ?? profile?.email;
  if (!email) return { error: "This account has no email address." };

  // Unconfirmed (never accepted) accounts get a magic link; others a recovery link.
  const type = authUser?.user?.email_confirmed_at ? "recovery" : "magiclink";
  const { data, error } = await admin.auth.admin.generateLink({ type, email });
  if (error) return { error: `Couldn't create a link: ${error.message}` };

  return {
    message: "Link created. It works once and expires in about an hour.",
    link: confirmLink(await appOrigin(), data.properties.hashed_token, type),
  };
}
