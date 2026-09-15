import { Address, CurrencyCode, GeoPoint, ISODateTime, UUID } from "./common";
import { PricingModel } from "./catalog";

/**
 * Booking lifecycle. Transitions are enforced server-side by
 * `packages/business-logic` — never mutate this field directly from a client.
 */
export type BookingStatus =
  | "draft"
  | "requested"
  | "pending_provider"
  | "accepted"
  | "provider_en_route"
  | "in_progress"
  | "awaiting_completion_confirmation"
  | "completed"
  | "cancelled_customer"
  | "cancelled_provider"
  | "expired"
  | "disputed"
  | "refunded";

export type ServiceTiming = "scheduled" | "now";

export interface BookingStatusHistoryEntry {
  id: UUID;
  bookingId: UUID;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  changedBy: UUID | "system";
  reason?: string;
  createdAt: ISODateTime;
}

export interface PriceBreakdown {
  servicePrice: number;
  customerFee: number;
  total: number;
  currency: CurrencyCode;
  providerCommission: number;
  providerPayout: number;
}

export interface ServiceRequest {
  id: UUID;
  customerId: UUID;
  providerId: UUID;
  providerServiceId: UUID;
  timing: ServiceTiming;
  scheduledFor?: ISODateTime; // required when timing === "scheduled"
  address: Address;
  locationSnapshot: GeoPoint;
  notes?: string;
  photoUrls: string[];
  estimatedDurationMinutes?: number;
  pricingModel: PricingModel;
  priceBreakdown: PriceBreakdown;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

export interface Booking {
  id: UUID;
  requestId: UUID;
  customerId: UUID;
  providerId: UUID;
  providerServiceId: UUID;
  categoryId: UUID;
  status: BookingStatus;
  timing: ServiceTiming;
  scheduledFor?: ISODateTime;
  address: Address;
  locationSnapshot: GeoPoint;
  notes?: string;
  photoUrls: string[];
  priceBreakdown: PriceBreakdown;
  quoteAmount?: number; // set when pricingModel === "custom_quote" and provider counters
  countryCode: string;
  acceptedAt?: ISODateTime;
  enRouteAt?: ISODateTime;
  startedAt?: ISODateTime;
  completedByProviderAt?: ISODateTime;
  completedByCustomerAt?: ISODateTime;
  cancelledAt?: ISODateTime;
  cancelledBy?: UUID;
  cancellationReason?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const TERMINAL_BOOKING_STATUSES: readonly BookingStatus[] = [
  "completed",
  "cancelled_customer",
  "cancelled_provider",
  "expired",
  "refunded",
];

/** Allowed forward transitions. Enforced by business-logic/bookingStateMachine.ts */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["requested"],
  requested: ["pending_provider", "expired", "cancelled_customer"],
  pending_provider: ["accepted", "cancelled_provider", "expired", "cancelled_customer"],
  accepted: ["provider_en_route", "in_progress", "cancelled_customer", "cancelled_provider"],
  provider_en_route: ["in_progress", "cancelled_customer", "cancelled_provider"],
  in_progress: ["awaiting_completion_confirmation", "disputed"],
  awaiting_completion_confirmation: ["completed", "disputed"],
  completed: ["disputed", "refunded"],
  cancelled_customer: [],
  cancelled_provider: [],
  expired: [],
  disputed: ["refunded", "completed"],
  refunded: [],
};
