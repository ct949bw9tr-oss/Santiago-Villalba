"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { generateDeviceToken, hashDeviceToken } from "@/server/attendance/tokens";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { dbErrorMessage, requireAdminFromForm, type FormState } from "./common";
import { firstIssue, uuid } from "./schemas";

const readerSchema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
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

const TOKEN_LABEL = "Reader token — copy it now, it won't be shown again:";

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
  return { message: "Token created.", secret: { label: TOKEN_LABEL, value: token } };
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
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Pick a class from this school." }) };

  const result = await issueToken(data.id);
  refresh();
  return result?.error ? result : { ...result, message: `Reader “${parsed.data.name}” created.` };
}

export async function rotateReaderToken(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("deviceId"));
  if (!id.success) return { error: "Unknown reader." };
  const result = await issueToken(id.data);
  refresh();
  return result?.error ? result : { ...result, message: "New token created; the old one stopped working." };
}

export async function setDeviceStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("deviceId"));
  if (!id.success) return { error: "Unknown device." };
  const status = formData.get("status") === "disabled" ? "disabled" : "active";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("devices")
    .update({ status })
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Unknown device." };

  refresh();
  return { message: status === "disabled" ? "Device disabled." : "Device enabled." };
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
  return { message: enabled ? "Simulator enabled." : "Simulator disabled." };
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
      : "No sessions are past their absence cutoff right now.",
  };
}
