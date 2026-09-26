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
