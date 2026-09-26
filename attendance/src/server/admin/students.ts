"use server";

import { refresh } from "next/cache";
import { normalizeUid } from "@/lib/nfc/uid";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { dbErrorMessage, requireAdminFromForm, type FormState } from "./common";
import { cardSchema, firstIssue, studentSchema, uuid } from "./schemas";

export async function createStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("students").insert({ ...parsed.data, school_id: access.school.id });
  if (error) return { error: dbErrorMessage(error, { unique: "A student with that number already exists." }) };

  refresh();
  return { message: `${parsed.data.first_name} ${parsed.data.last_name} added.` };
}

export async function updateStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("studentId"));
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Unknown student." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error, { unique: "Another student already has that number." }) };
  if (!data?.length) return { error: "Unknown student." };

  refresh();
  return { message: "Saved." };
}

export async function assignCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const studentId = uuid.safeParse(formData.get("studentId"));
  const parsed = cardSchema.safeParse(Object.fromEntries(formData));
  if (!studentId.success) return { error: "Unknown student." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const uid = normalizeUid(parsed.data.uid);
  if (!uid) return { error: "That isn't a valid card UID (expected 4, 7 or 10 bytes in hex, e.g. 04:A2:2B:1C:9F:5E:80)." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("nfc_credentials").insert({
    school_id: access.school.id,
    student_id: studentId.data,
    uid_normalized: uid,
    label: parsed.data.label,
  });

  if (error?.code === "23505") {
    const { data: owner } = await supabase
      .from("nfc_credentials")
      .select("student:students!inner(first_name, last_name)")
      .eq("school_id", access.school.id)
      .eq("uid_normalized", uid)
      .eq("status", "active")
      .returns<{ student: { first_name: string; last_name: string } }[]>()
      .maybeSingle();
    const who = owner ? `${owner.student.first_name} ${owner.student.last_name}` : "another student";
    return { error: `That card is already assigned to ${who}. Revoke it there first.` };
  }
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Unknown student." }) };

  refresh();
  return { message: "Card assigned." };
}

export async function revokeCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const cardId = uuid.safeParse(formData.get("cardId"));
  const status = formData.get("status") === "lost" ? "lost" : "revoked";
  if (!cardId.success) return { error: "Unknown card." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nfc_credentials")
    .update({ status, revoked_at: new Date().toISOString() })
    .eq("id", cardId.data)
    .eq("school_id", access.school.id)
    .eq("status", "active")
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Card not found or already inactive." };

  refresh();
  return { message: status === "lost" ? "Card marked as lost." : "Card revoked." };
}
