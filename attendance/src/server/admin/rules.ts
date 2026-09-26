"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { dbErrorMessage, requireAdminFromForm, type FormState } from "./common";
import { firstIssue, ruleSchema } from "./schemas";

export async function updateDefaultRule(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance_rules")
    .update(parsed.data)
    .eq("school_id", access.school.id)
    .eq("is_default", true)
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "This school has no default rule." };

  refresh();
  return { message: "Attendance rules saved. They apply to sessions that haven't started yet." };
}
