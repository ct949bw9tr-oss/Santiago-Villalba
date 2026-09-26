import "server-only";
import { headers } from "next/headers";
import { requireRole } from "@/server/auth/session";

export type FormState =
  | {
      error?: string;
      message?: string;
      /** A one-time sign-in link to hand to someone (shown selectable). */
      link?: string;
    }
  | undefined;

type PgError = { code?: string; message: string } | null;

/**
 * Turns a PostgREST/Postgres error into a message for an admin. Raw database
 * messages are not shown (they can leak schema details).
 */
export function dbErrorMessage(error: PgError, messages: { unique?: string; foreignKey?: string } = {}): string {
  switch (error?.code) {
    case "23505":
      return messages.unique ?? "That already exists.";
    case "23503":
      return messages.foreignKey ?? "A referenced record doesn't exist in this school.";
    case "23514":
      return "Some values are out of range.";
    case "42501":
      return "You don't have permission to do that.";
    default:
      console.error("admin action failed", error);
      return "Something went wrong. Please try again.";
  }
}

/** Verifies the caller is an admin of the school named in the form. */
export async function requireAdminFromForm(formData: FormData) {
  return requireRole(String(formData.get("schoolSlug") ?? ""), "school_admin");
}

/** Today's date (YYYY-MM-DD) in the school's timezone. */
export function schoolToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Public origin of this app, for links sent to people. */
export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
