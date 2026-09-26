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
  if (error) return { error: dbErrorMessage(error, { unique: "Ya existe un estudiante con ese código." }) };

  refresh();
  return { message: `${parsed.data.first_name} ${parsed.data.last_name} fue agregado.` };
}

export async function updateStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("studentId"));
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Estudiante desconocido." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error, { unique: "Otro estudiante ya tiene ese código." }) };
  if (!data?.length) return { error: "Estudiante desconocido." };

  refresh();
  return { message: "Cambios guardados." };
}

export async function assignCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const studentId = uuid.safeParse(formData.get("studentId"));
  const parsed = cardSchema.safeParse(Object.fromEntries(formData));
  if (!studentId.success) return { error: "Estudiante desconocido." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const uid = normalizeUid(parsed.data.uid);
  if (!uid) return { error: "Ese no es un UID de tarjeta válido (4, 7 o 10 bytes en hexadecimal, p. ej. 04:A2:2B:1C:9F:5E:80)." };

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
    return { error: `Esa tarjeta ya está asignada a ${who}. Revócala allí primero.` };
  }
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Estudiante desconocido." }) };

  refresh();
  return { message: "Tarjeta asignada." };
}

export async function revokeCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const cardId = uuid.safeParse(formData.get("cardId"));
  const status = formData.get("status") === "lost" ? "lost" : "revoked";
  if (!cardId.success) return { error: "Tarjeta desconocida." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("nfc_credentials")
    .update({ status, revoked_at: new Date().toISOString() })
    .eq("id", cardId.data)
    .eq("school_id", access.school.id)
    .eq("status", "active")
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "La tarjeta no existe o ya estaba inactiva." };

  refresh();
  return { message: status === "lost" ? "Tarjeta marcada como perdida." : "Tarjeta revocada." };
}
