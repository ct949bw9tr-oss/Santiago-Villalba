"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { generateDeviceToken, hashDeviceToken } from "@/server/attendance/tokens";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { appOrigin, dbErrorMessage, requireAdminFromForm, type FormState } from "./common";
import { firstIssue, uuid } from "./schemas";

const readerSchema = z.object({
  name: z.string().trim().min(1, "Obligatorio").max(100),
  location: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  class_section_id: z
    .string()
    .transform((v) => v || null)
    .pipe(uuid.nullable()),
});

const TOKEN_LABEL = "Token del lector: cópialo ahora, no se volverá a mostrar:";

async function issueToken(deviceId: string): Promise<FormState> {
  const token = generateDeviceToken();
  const supabase = await createSupabaseServerClient();
  // The RPC re-checks that the caller administers the reader's school.
  const { error } = await supabase.rpc("admin_set_device_token", {
    p_device_id: deviceId,
    p_token_hash: hashDeviceToken(token),
    p_token_last4: token.slice(-4),
  });
  if (error) return { error: dbErrorMessage(error) };
  // The token travels in the URL fragment, which browsers never send to a server.
  return {
    message: "Token creado.",
    secret: { label: TOKEN_LABEL, value: token },
    link: `${await appOrigin()}/kiosk#token=${token}`,
    linkLabel: "O abre este enlace en el aparato del salón (configura la pantalla de lector de una vez):",
  };
}

export async function createReader(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const parsed = readerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devices")
    .insert({ ...parsed.data, school_id: access.school.id })
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Elige una clase de este colegio." }) };

  const result = await issueToken(data.id);
  refresh();
  return result?.error ? result : { ...result, message: `Lector “${parsed.data.name}” creado.` };
}

export async function rotateReaderToken(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("deviceId"));
  if (!id.success) return { error: "Lector desconocido." };
  const result = await issueToken(id.data);
  refresh();
  return result?.error ? result : { ...result, message: "Token nuevo creado; el anterior dejó de funcionar." };
}

export async function setDeviceStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("deviceId"));
  if (!id.success) return { error: "Dispositivo desconocido." };
  const status = formData.get("status") === "disabled" ? "disabled" : "active";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devices")
    .update({ status })
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Dispositivo desconocido." };

  refresh();
  return { message: status === "disabled" ? "Dispositivo desactivado." : "Dispositivo activado." };
}

export async function setSimulatorEnabled(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const enabled = formData.get("enabled") === "true";

  const supabase = await createSupabaseServerClient();
  const { data: school, error: readError } = await supabase
    .from("schools")
    .select("settings")
    .eq("id", access.school.id)
    .single();
  if (readError) return { error: dbErrorMessage(readError) };

  const { error } = await supabase
    .from("schools")
    .update({ settings: { ...(school.settings ?? {}), simulator_enabled: enabled } })
    .eq("id", access.school.id);
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return { message: enabled ? "Simulador activado." : "Simulador desactivado." };
}

export async function runAbsenceCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_finalize_due_sessions", { p_school_id: access.school.id });
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return {
    message: data
      ? `${data} session${data === 1 ? "" : "s"} closed; students without a scan were marked absent.`
      : "Ninguna clase ha pasado su hora límite en este momento.",
  };
}
