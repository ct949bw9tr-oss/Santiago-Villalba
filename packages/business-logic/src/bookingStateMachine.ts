import { BOOKING_TRANSITIONS, BookingStatus, TERMINAL_BOOKING_STATUSES } from "@taskswift/types";

export type BookingActor = "customer" | "provider" | "system" | "admin";

const ACTOR_ALLOWED_TRANSITIONS: Record<BookingActor, Partial<Record<BookingStatus, BookingStatus[]>>> = {
  customer: {
    draft: ["requested"],
    requested: ["cancelled_customer"],
    pending_provider: ["cancelled_customer"],
    accepted: ["cancelled_customer"],
    provider_en_route: ["cancelled_customer"],
    awaiting_completion_confirmation: ["completed"],
    completed: ["disputed"],
  },
  provider: {
    requested: ["pending_provider"],
    pending_provider: ["accepted", "cancelled_provider"],
    accepted: ["provider_en_route", "in_progress", "cancelled_provider"],
    provider_en_route: ["in_progress", "cancelled_provider"],
    in_progress: ["awaiting_completion_confirmation"],
    completed: ["disputed"],
  },
  system: {
    requested: ["expired"],
    pending_provider: ["expired"],
  },
  admin: {
    disputed: ["refunded", "completed"],
    completed: ["refunded"],
  },
};

export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

export function canTransition(from: BookingStatus, to: BookingStatus, actor: BookingActor): boolean {
  if (!BOOKING_TRANSITIONS[from]?.includes(to)) return false;
  const actorAllowed = ACTOR_ALLOWED_TRANSITIONS[actor]?.[from];
  return !!actorAllowed?.includes(to);
}

export class InvalidBookingTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus, actor: BookingActor) {
    super(`Actor "${actor}" cannot transition booking from "${from}" to "${to}"`);
    this.name = "InvalidBookingTransitionError";
  }
}

/** Throws if the transition is not allowed; otherwise returns the new status. */
export function applyBookingTransition(from: BookingStatus, to: BookingStatus, actor: BookingActor): BookingStatus {
  if (!canTransition(from, to, actor)) {
    throw new InvalidBookingTransitionError(from, to, actor);
  }
  return to;
}
