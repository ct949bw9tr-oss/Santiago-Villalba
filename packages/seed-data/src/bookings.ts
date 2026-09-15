export type SeedBookingStatus =
  | "requested"
  | "pending_provider"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled_customer";

export interface BookingSeed {
  key: string;
  customer: string; // "firstName lastName", matches customerKey()
  provider: string; // "firstName lastName", matches providerKey()
  status: SeedBookingStatus;
  timing: "scheduled" | "now";
  daysFromNow: number; // negative = past
  withReview: boolean;
  withChat: boolean;
}

/** Spans the full P0 booking lifecycle end to end — see docs/DEMO_SCRIPT.md. */
export const SEED_BOOKINGS: BookingSeed[] = [
  { key: "b1", customer: "Santiago Villalba", provider: "Andrés Ramírez", status: "completed", timing: "scheduled", daysFromNow: -3, withReview: true, withChat: true },
  { key: "b2", customer: "Juan Pablo Duarte", provider: "Valentina Morales", status: "completed", timing: "scheduled", daysFromNow: -7, withReview: true, withChat: false },
  { key: "b3", customer: "María José Cárdenas", provider: "Laura Pérez", status: "accepted", timing: "scheduled", daysFromNow: 2, withReview: false, withChat: true },
  { key: "b4", customer: "Camilo Andrade", provider: "Carlos Jiménez", status: "in_progress", timing: "now", daysFromNow: 0, withReview: false, withChat: true },
  { key: "b5", customer: "Lucía Fernández", provider: "Daniel Suárez", status: "pending_provider", timing: "scheduled", daysFromNow: 1, withReview: false, withChat: false },
  { key: "b6", customer: "Sofía Restrepo", provider: "Camila Torres", status: "cancelled_customer", timing: "scheduled", daysFromNow: -1, withReview: false, withChat: false },
  { key: "b7", customer: "Nicolás Peña", provider: "Mariana Castro", status: "requested", timing: "now", daysFromNow: 0, withReview: false, withChat: false },
];
