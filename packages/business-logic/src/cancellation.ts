import { Booking, PriceBreakdown } from "@taskswift/types";

export type CancellationInitiator = "customer" | "provider";

export interface CancellationPolicyConfig {
  /** Cancellations at least this many minutes before `scheduledFor` are free. */
  freeWindowMinutes: number;
  /** Percentage of servicePrice charged for a late customer cancellation. */
  lateCancellationFeePercent: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyConfig = {
  freeWindowMinutes: 60,
  lateCancellationFeePercent: 20,
};

export interface CancellationOutcome {
  refundAmount: number;
  cancellationFee: number;
  currency: string;
  isLate: boolean;
}

/**
 * Determines the refund/fee split for a cancellation.
 * - A provider cancellation is always a full refund (no-fault to the customer).
 * - A customer cancellation is free inside the policy window, otherwise a late fee applies.
 * - "now" (immediate) bookings have no scheduled buffer, so they are always evaluated as late
 *   once the booking has been accepted.
 */
export function calculateCancellationOutcome(
  booking: Pick<Booking, "timing" | "scheduledFor" | "status" | "priceBreakdown">,
  initiator: CancellationInitiator,
  now: Date,
  policy: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY
): CancellationOutcome {
  const { priceBreakdown } = booking;

  if (initiator === "provider") {
    return fullRefund(priceBreakdown, false);
  }

  if (booking.timing === "now") {
    const isLate = booking.status !== "requested" && booking.status !== "pending_provider";
    return isLate ? lateFeeOutcome(priceBreakdown, policy) : fullRefund(priceBreakdown, false);
  }

  if (!booking.scheduledFor) {
    return fullRefund(priceBreakdown, false);
  }

  const minutesUntilService = (new Date(booking.scheduledFor).getTime() - now.getTime()) / 60000;
  const isLate = minutesUntilService < policy.freeWindowMinutes;
  return isLate ? lateFeeOutcome(priceBreakdown, policy) : fullRefund(priceBreakdown, false);
}

function fullRefund(priceBreakdown: PriceBreakdown, isLate: boolean): CancellationOutcome {
  return {
    refundAmount: priceBreakdown.total,
    cancellationFee: 0,
    currency: priceBreakdown.currency,
    isLate,
  };
}

function lateFeeOutcome(priceBreakdown: PriceBreakdown, policy: CancellationPolicyConfig): CancellationOutcome {
  const cancellationFee = Math.round(priceBreakdown.servicePrice * (policy.lateCancellationFeePercent / 100));
  return {
    refundAmount: priceBreakdown.total - cancellationFee,
    cancellationFee,
    currency: priceBreakdown.currency,
    isLate: true,
  };
}
