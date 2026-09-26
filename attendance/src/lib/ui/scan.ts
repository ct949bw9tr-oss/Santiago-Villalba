// Spanish labels for scan-engine outcomes (the engine's own messages stay in
// the API response for readers and debugging).

export type ScanOutcome =
  | "recorded"
  | "duplicate"
  | "unknown_credential"
  | "inactive_credential"
  | "inactive_student"
  | "no_active_session"
  | "not_enrolled"
  | "too_early"
  | "after_cutoff"
  | "device_disabled"
  | "school_suspended";

export const OUTCOME_LABEL: Record<ScanOutcome, string> = {
  recorded: "Registrado",
  duplicate: "Toque repetido",
  unknown_credential: "Tarjeta no registrada",
  inactive_credential: "Tarjeta desactivada",
  inactive_student: "Estudiante inactivo",
  no_active_session: "Sin clase en curso",
  not_enrolled: "No inscrito en la clase",
  too_early: "Demasiado temprano",
  after_cutoff: "Fuera de horario",
  device_disabled: "Lector desactivado",
  school_suspended: "Colegio suspendido",
};

export const OUTCOME_HINT: Partial<Record<ScanOutcome, string>> = {
  duplicate: "Esta tarjeta ya se registró hace un momento.",
  unknown_credential: "Asigna esta tarjeta a un estudiante desde su perfil.",
  inactive_credential: "La tarjeta fue marcada como perdida o revocada.",
  inactive_student: "El estudiante no está activo en el colegio.",
  no_active_session: "El estudiante no tiene una clase abierta para registro en este momento.",
  not_enrolled: "El lector está asignado a una clase en la que este estudiante no está inscrito.",
  too_early: "El registro abre unos minutos antes del inicio de la clase.",
  after_cutoff: "La clase ya cerró el registro de llegada.",
  device_disabled: "Este lector está desactivado. Actívalo en Configuración → Dispositivos.",
  school_suspended: "La cuenta del colegio está suspendida.",
};

export function outcomeTone(outcome: string): "success" | "warning" | "danger" | "neutral" {
  if (outcome === "recorded") return "success";
  if (outcome === "duplicate" || outcome === "too_early") return "warning";
  return "danger";
}

export type ScanBody = {
  outcome?: ScanOutcome;
  feedback?: "accept" | "warn" | "reject";
  message?: string;
  replayed?: boolean;
  error?: string;
  effective_at?: string;
  attendance?: { status: "present" | "late" | "absent" | "excused"; class_name: string; checked_in_at: string | null } | null;
  student?: { display_name: string } | null;
};

export type ScanView = { tone: "accept" | "warn" | "reject"; title: string; hint?: string };

const ERROR_LABEL: Record<string, string> = {
  simulator_disabled: "El simulador está desactivado",
  simulator_missing: "El colegio no tiene dispositivo simulador",
  not_an_admin: "Solo un administrador puede usar el simulador",
  not_signed_in: "Tu sesión expiró; vuelve a iniciar sesión",
  invalid_token: "Este lector no está autorizado",
  school_suspended: "Colegio suspendido",
  missing_credentials: "Sesión no válida",
  invalid_body: "UID de tarjeta no válido",
  invalid_response: "Respuesta inválida del servidor",
  "scanned_at must be within 24 hours of now": "La hora simulada debe estar dentro de las últimas/próximas 24 horas",
};

/** What to show for a scan API response (simulator and kiosk). */
export function describeScan(body: ScanBody): ScanView {
  if (!body.outcome) {
    return { tone: "reject", title: ERROR_LABEL[body.error ?? ""] ?? "No se pudo registrar", hint: body.error ? `Código: ${body.error}` : undefined };
  }
  if (body.outcome === "recorded") {
    const st = body.attendance?.status;
    const title =
      st === "late" ? "Llegada tarde registrada" : st === "absent" ? "Registrado como ausente" : st === "excused" ? "Excusa registrada" : "Asistencia registrada";
    return { tone: st === "present" || st === "excused" ? "accept" : "warn", title };
  }
  return {
    tone: body.feedback === "warn" ? "warn" : "reject",
    title: OUTCOME_LABEL[body.outcome] ?? body.message ?? "No se pudo registrar",
    hint: OUTCOME_HINT[body.outcome],
  };
}
