import { z } from "zod";

// Input contracts for admin Server Actions. Everything from FormData is a
// string; these schemas trim, coerce and bound it. school_id is never part of
// an input: it always comes from the caller's verified membership.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const requiredText = (max: number) => z.string().trim().min(1, "Required").max(max);

export const uuid = z.uuid();

export const studentSchema = z.object({
  student_number: requiredText(64),
  first_name: requiredText(100),
  last_name: requiredText(100),
  grade_level: optionalText(32),
  status: z.enum(["active", "inactive", "graduated", "withdrawn"]).default("active"),
});

export const teacherInviteSchema = z.object({
  email: z.email("Enter a valid email").max(320).transform((v) => v.trim().toLowerCase()),
  first_name: requiredText(100),
  last_name: requiredText(100),
  employee_number: optionalText(64),
});

export const teacherUpdateSchema = z.object({
  first_name: requiredText(100),
  last_name: requiredText(100),
  employee_number: optionalText(64),
  status: z.enum(["active", "inactive"]),
});

export const courseSchema = z.object({
  code: requiredText(32),
  name: requiredText(200),
  description: optionalText(1000),
});

export const classSchema = z.object({
  course_id: uuid,
  name: requiredText(200),
  room: optionalText(64),
  status: z.enum(["active", "archived"]).default("active"),
});

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const scheduleSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    start_time: timeOfDay,
    end_time: timeOfDay,
    room: optionalText(64),
  })
  .refine((v) => v.end_time > v.start_time, { message: "End time must be after start time", path: ["end_time"] });

export const cardSchema = z.object({
  uid: z.string().trim().min(1, "Enter the card UID").max(64),
  label: optionalText(64),
});

export const ruleSchema = z
  .object({
    early_checkin_minutes: z.coerce.number().int().min(0).max(240),
    late_after_minutes: z.coerce.number().int().min(0).max(240),
    absent_after_minutes: z.coerce.number().int().min(0).max(480),
    scan_after_cutoff: z.enum(["late", "absent", "reject"]),
    duplicate_window_seconds: z.coerce.number().int().min(0).max(3600),
    auto_finalize: z
      .union([z.literal("on"), z.literal("")])
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((v) => v.absent_after_minutes >= v.late_after_minutes, {
    message: "“Absent after” must be at least “late after”",
    path: ["absent_after_minutes"],
  });

/** First validation message, for display next to the form. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field.replaceAll("_", " ")}: ${issue.message}` : (issue?.message ?? "Invalid input");
}
