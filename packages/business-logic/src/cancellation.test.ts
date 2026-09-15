import { describe, expect, it } from "vitest";
import { Booking } from "@taskswift/types";
import { calculateCancellationOutcome } from "./cancellation";

const priceBreakdown: Booking["priceBreakdown"] = {
  servicePrice: 40000,
  customerFee: 3200,
  total: 43200,
  currency: "COP",
  providerCommission: 0,
  providerPayout: 40000,
};

describe("calculateCancellationOutcome", () => {
  it("gives a full refund when a provider cancels, regardless of timing", () => {
    const outcome = calculateCancellationOutcome(
      { timing: "scheduled", scheduledFor: "2026-01-01T17:00:00Z", status: "accepted", priceBreakdown },
      "provider",
      new Date("2026-01-01T16:59:00Z")
    );
    expect(outcome.refundAmount).toBe(43200);
    expect(outcome.cancellationFee).toBe(0);
  });

  it("gives a full refund for a customer cancelling well before the scheduled time", () => {
    const outcome = calculateCancellationOutcome(
      { timing: "scheduled", scheduledFor: "2026-01-01T17:00:00Z", status: "accepted", priceBreakdown },
      "customer",
      new Date("2026-01-01T10:00:00Z")
    );
    expect(outcome.isLate).toBe(false);
    expect(outcome.refundAmount).toBe(43200);
  });

  it("charges a late cancellation fee inside the free window", () => {
    const outcome = calculateCancellationOutcome(
      { timing: "scheduled", scheduledFor: "2026-01-01T17:00:00Z", status: "accepted", priceBreakdown },
      "customer",
      new Date("2026-01-01T16:30:00Z") // 30 min before, inside default 60-min window
    );
    expect(outcome.isLate).toBe(true);
    expect(outcome.cancellationFee).toBe(8000); // 20% of 40000
    expect(outcome.refundAmount).toBe(35200);
  });

  it("treats an already-accepted 'now' booking cancellation by the customer as late", () => {
    const outcome = calculateCancellationOutcome(
      { timing: "now", status: "in_progress", priceBreakdown },
      "customer",
      new Date()
    );
    expect(outcome.isLate).toBe(true);
    expect(outcome.cancellationFee).toBe(8000);
  });

  it("allows a free cancellation of a 'now' booking that has not yet been accepted", () => {
    const outcome = calculateCancellationOutcome(
      { timing: "now", status: "requested", priceBreakdown },
      "customer",
      new Date()
    );
    expect(outcome.isLate).toBe(false);
    expect(outcome.cancellationFee).toBe(0);
  });
});
