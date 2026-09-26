"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { hasRole } from "@/lib/auth/roles";
import { requireSchoolAccess } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { dbErrorMessage, type FormState } from "@/server/admin/common";
import { firstIssue } from "@/server/admin/schemas";

const correctionSchema = z.object({
  sessionId: z.uuid(),
  studentId: z.uuid(),
  status: z.enum(["present", "late", "absent", "excused"]),
  reason: z.string().trim().min(3, "Escribe un motivo breve (mínimo 3 caracteres)").max(500),
  expectedVersion: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().positive().optional()),
});

/**
 * Manual correction by a teacher of the class or a school admin. The database
 * function re-checks who may do it, requires the reason, marks the record as a
 * manual override (card taps can't change it afterwards) and audits it.
 */
export async function correctAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  const access = await requireSchoolAccess(String(formData.get("schoolSlug") ?? ""));
  if (!hasRole(access, "teacher") && !hasRole(access, "school_admin")) {
    return { error: "No tienes permiso para cambiar la asistencia." };
  }

  const parsed = correctionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { sessionId, studentId, status, reason, expectedVersion } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("correct_attendance", {
    p_session_id: sessionId,
    p_student_id: studentId,
    p_status: status,
    p_reason: reason,
    p_expected_version: expectedVersion ?? null,
  });
  if (error?.code === "PT409") return { error: "Alguien acaba de cambiar la asistencia de este estudiante. Recarga e inténtalo de nuevo." };
  if (error) {
    return {
      error: dbErrorMessage(error, { foreignKey: "Este estudiante no está inscrito en esta clase en esa fecha." }),
    };
  }

  refresh();
  return { message: "Cambios guardados." };
}
