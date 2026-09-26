"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { dbErrorMessage, requireAdminFromForm, type FormState } from "./common";
import { courseSchema, firstIssue, uuid } from "./schemas";

export async function createCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("courses").insert({ ...parsed.data, school_id: access.school.id });
  if (error) return { error: dbErrorMessage(error, { unique: "A course with that code already exists." }) };

  refresh();
  return { message: `${parsed.data.name} added.` };
}

export async function updateCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("courseId"));
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Unknown course." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error, { unique: "Another course already has that code." }) };
  if (!data?.length) return { error: "Unknown course." };

  refresh();
  return { message: "Saved." };
}
