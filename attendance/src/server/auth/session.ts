import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import {
  findSchoolAccess,
  hasRole,
  type Membership,
  type Role,
  type SchoolAccess,
  type SchoolSummary,
} from "@/lib/auth/roles";

// Data-access layer for identity and authorization. Every page and Server
// Action calls one of the require* functions below — close to the data, not
// only in layouts (layouts don't re-run on client-side navigation).
//
// Nothing here trusts the browser: the user id comes from the verified JWT,
// and schools/roles come from school_memberships in the database. The school
// slug in the URL is only a lookup key into the caller's own memberships.

export type CurrentUser = { id: string; email: string | null };

/** Verified identity for this request, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  // getClaims() verifies the JWT signature; never trust getSession() on the server.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

type MembershipRow = {
  role: Role;
  school: SchoolSummary | null;
};

/** The caller's active memberships (RLS returns only their own rows). */
export const getMyMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_memberships")
    .select("role, school:schools!inner(id, slug, name, timezone, status)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .returns<MembershipRow[]>();

  if (error) throw new Error(`Failed to load memberships: ${error.message}`);
  return (data ?? []).flatMap((row) => (row.school ? [{ role: row.role, school: row.school }] : []));
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolves the caller's access to the school in the URL. Non-members get a
 * 404 so the existence of other schools isn't revealed.
 */
export async function requireSchoolAccess(schoolSlug: string): Promise<SchoolAccess & { user: CurrentUser }> {
  const user = await requireUser();
  const access = findSchoolAccess(await getMyMemberships(), schoolSlug);
  if (!access) notFound();
  if (access.school.status !== "active") redirect("/no-access?reason=suspended");
  return { ...access, user };
}

export async function requireRole(
  schoolSlug: string,
  role: Role,
): Promise<SchoolAccess & { user: CurrentUser }> {
  const access = await requireSchoolAccess(schoolSlug);
  if (!hasRole(access, role)) notFound();
  return access;
}
