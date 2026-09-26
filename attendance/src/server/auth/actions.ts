"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { requireUser } from "@/server/auth/session";

export type FormState = { error?: string } | undefined;

const signInSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(200),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Escribe un correo y una contraseña válidos." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Same message for unknown email and wrong password (no account enumeration).
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const MIN_PASSWORD_LENGTH = 10;

const setPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden." });

/** Used after accepting an invitation (or a recovery link) to choose a password. */
export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.message === "Las contraseñas no coinciden.");
    return {
      error: mismatch
        ? "Las contraseñas no coinciden."
        : `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect("/");
}
