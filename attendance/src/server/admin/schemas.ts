import { z } from "zod";

// Spanish validation messages for every form (EduTrack's UI language).
z.config(z.locales.es());

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

const requiredText = (max: number) => z.string().trim().min(1, "Obligatorio").max(max);

export const uuid = z.uuid();

export const studentSchema = z.object({
  student_number: requiredText(64),
  first_name: requiredText(100),
  last_name: requiredText(100),
  grade_level: optionalText(32),
  status: z.enum(["active", "inactive", "graduated", "withdrawn"]).default("active"),
});

export const teacherInviteSchema = z.object({
  email: z.email("Escribe un correo válido").max(320).transform((v) => v.trim().toLowerCase()),
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

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa el formato HH:MM");

export const scheduleSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    start_time: timeOfDay,
    end_time: timeOfDay,
    room: optionalText(64),
  })
  .refine((v) => v.end_time > v.start_time, { message: "La hora de fin debe ser posterior a la de inicio", path: ["end_time"] });

export const cardSchema = z.object({
  uid: z.string().trim().min(1, "Escribe el UID de la tarjeta").max(64),
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
    message: "“Ausente a los” debe ser mayor o igual que “A tiempo hasta”",
    path: ["absent_after_minutes"],
  });

const FIELD_LABEL: Record<string, string> = {
  student_number: "Código",
  first_name: "Nombres",
  last_name: "Apellidos",
  grade_level: "Grado",
  status: "Estado",
  email: "Correo",
  employee_number: "N.º de empleado",
  code: "Código",
  name: "Nombre",
  description: "Descripción",
  room: "Salón",
  course_id: "Curso",
  weekday: "Día",
  start_time: "Inicio",
  end_time: "Fin",
  uid: "UID",
  label: "Etiqueta",
  reason: "Motivo",
  early_checkin_minutes: "Apertura del registro",
  late_after_minutes: "A tiempo hasta",
  absent_after_minutes: "Ausente a los",
  duplicate_window_seconds: "Toques repetidos",
};

/** First validation message, for display next to the form. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${FIELD_LABEL[field] ?? field.replaceAll("_", " ")}: ${issue.message}` : (issue?.message ?? "Dato no válido");
}
