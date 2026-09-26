"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { dbErrorMessage, requireAdminFromForm, schoolToday, type FormState } from "./common";
import { classSchema, firstIssue, scheduleSchema, uuid } from "./schemas";

const SESSION_HORIZON_DAYS = 28;

export async function createClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sections")
    .insert({ ...parsed.data, school_id: access.school.id })
    .select("id")
    .single();
  // A course_id from another school fails the composite foreign key.
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Pick a course from this school." }) };

  redirect(`/s/${access.school.slug}/admin/classes/${data.id}`);
}

export async function updateClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("classId"));
  const parsed = classSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { error: "Unknown class." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sections")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .select("id");
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Pick a course from this school." }) };
  if (!data?.length) return { error: "Unknown class." };

  refresh();
  return { message: "Saved." };
}

export async function addClassTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const classId = uuid.safeParse(formData.get("classId"));
  const teacherId = uuid.safeParse(formData.get("teacherId"));
  if (!classId.success || !teacherId.success) return { error: "Pick a teacher." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_teachers").insert({
    school_id: access.school.id,
    class_section_id: classId.data,
    teacher_id: teacherId.data,
    role: formData.get("role") === "assistant" ? "assistant" : "primary",
  });
  if (error) return { error: dbErrorMessage(error, { unique: "That teacher is already assigned." }) };

  refresh();
  return { message: "Teacher assigned." };
}

export async function removeClassTeacher(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("assignmentId"));
  if (!id.success) return { error: "Unknown assignment." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_teachers").delete().eq("id", id.data).eq("school_id", access.school.id);
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return { message: "Removed." };
}

export async function addSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const classId = uuid.safeParse(formData.get("classId"));
  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData));
  if (!classId.success) return { error: "Unknown class." };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_schedules").insert({
    ...parsed.data,
    school_id: access.school.id,
    class_section_id: classId.data,
    valid_from: schoolToday(access.school.timezone),
  });
  if (error) return { error: dbErrorMessage(error) };

  // Materialize the upcoming sessions right away (the daily job keeps extending them).
  const { data: created, error: genError } = await supabase.rpc("admin_generate_class_sessions", {
    p_school_id: access.school.id,
    p_days: SESSION_HORIZON_DAYS,
  });
  if (genError) return { error: dbErrorMessage(genError) };

  refresh();
  return { message: `Time slot added; ${created ?? 0} upcoming sessions created.` };
}

export async function removeSchedule(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("scheduleId"));
  if (!id.success) return { error: "Unknown time slot." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("remove_class_schedule", { p_schedule_id: id.data });
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return { message: `Time slot removed (${data ?? 0} future sessions deleted).` };
}

export async function generateSessions(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_generate_class_sessions", {
    p_school_id: access.school.id,
    p_days: SESSION_HORIZON_DAYS,
  });
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return { message: `${data ?? 0} new sessions created for the next ${SESSION_HORIZON_DAYS} days.` };
}

export async function enrollStudents(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const classId = uuid.safeParse(formData.get("classId"));
  if (!classId.success) return { error: "Unknown class." };
  const studentIds = formData
    .getAll("studentIds")
    .map((v) => uuid.safeParse(v))
    .flatMap((r) => (r.success ? [r.data] : []));
  if (studentIds.length === 0) return { error: "Select at least one student." };

  const supabase = await createSupabaseServerClient();
  const { data: open } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("school_id", access.school.id)
    .eq("class_section_id", classId.data)
    .is("withdrawn_on", null);
  const already = new Set((open ?? []).map((e) => e.student_id as string));
  const toAdd = studentIds.filter((id) => !already.has(id));
  if (toAdd.length === 0) return { message: "Those students are already enrolled." };

  const today = schoolToday(access.school.timezone);
  const { error } = await supabase.from("enrollments").insert(
    toAdd.map((student_id) => ({
      school_id: access.school.id,
      class_section_id: classId.data,
      student_id,
      enrolled_on: today,
    })),
  );
  if (error) return { error: dbErrorMessage(error, { foreignKey: "Pick students from this school." }) };

  refresh();
  return { message: `${toAdd.length} student${toAdd.length === 1 ? "" : "s"} enrolled.` };
}

/**
 * Withdraws a student from today on, keeping history. An enrollment that
 * started today (most likely a mistake) is simply deleted.
 */
export async function unenrollStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("enrollmentId"));
  if (!id.success) return { error: "Unknown enrollment." };

  const supabase = await createSupabaseServerClient();
  const today = schoolToday(access.school.timezone);
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, enrolled_on")
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .is("withdrawn_on", null)
    .maybeSingle();
  if (!enrollment) return { error: "Unknown enrollment." };

  const { error } =
    enrollment.enrolled_on >= today
      ? await supabase.from("enrollments").delete().eq("id", enrollment.id)
      : await supabase.from("enrollments").update({ withdrawn_on: today }).eq("id", enrollment.id);
  if (error) return { error: dbErrorMessage(error) };

  refresh();
  return { message: "Student removed from the class." };
}

export async function setSessionStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireAdminFromForm(formData);
  const id = uuid.safeParse(formData.get("sessionId"));
  if (!id.success) return { error: "Unknown session." };
  const cancel = formData.get("status") === "cancelled";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .update({ status: cancel ? "cancelled" : "scheduled", cancelled_reason: cancel ? "Cancelled by admin" : null })
    .eq("id", id.data)
    .eq("school_id", access.school.id)
    .neq("status", "completed")
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data?.length) return { error: "Session not found or already completed." };

  refresh();
  return { message: cancel ? "Session cancelled." : "Session restored." };
}
