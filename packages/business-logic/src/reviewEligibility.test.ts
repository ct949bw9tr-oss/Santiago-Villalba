import { describe, expect, it } from "vitest";
import { Booking } from "@taskswift/types";
import { checkReviewEligibility } from "./reviewEligibility";

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    requestId: "req-1",
    customerId: "customer-1",
    providerId: "provider-1",
    providerServiceId: "ps-1",
    categoryId: "cat-1",
    status: "completed",
    timing: "scheduled",
    address: {} as Booking["address"],
    locationSnapshot: { lat: 0, lng: 0 },
    photoUrls: [],
    priceBreakdown: { servicePrice: 35000, customerFee: 2800, total: 37800, currency: "COP", providerCommission: 0, providerPayout: 35000 },
    countryCode: "CO",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("checkReviewEligibility", () => {
  it("allows a customer to review the provider after completion", () => {
    const result = checkReviewEligibility({ booking: makeBooking(), authorId: "customer-1", existingReviews: [] });
    expect(result).toEqual({ eligible: true, direction: "customer_to_provider", subjectId: "provider-1" });
  });

  it("allows a provider to review the customer after completion", () => {
    const result = checkReviewEligibility({ booking: makeBooking(), authorId: "provider-1", existingReviews: [] });
    expect(result).toEqual({ eligible: true, direction: "provider_to_customer", subjectId: "customer-1" });
  });

  it("rejects a review before the booking is completed", () => {
    const result = checkReviewEligibility({ booking: makeBooking({ status: "in_progress" }), authorId: "customer-1", existingReviews: [] });
    expect(result.eligible).toBe(false);
  });

  it("rejects a non-participant reviewing the booking", () => {
    const result = checkReviewEligibility({ booking: makeBooking(), authorId: "stranger", existingReviews: [] });
    expect(result.eligible).toBe(false);
  });

  it("rejects a duplicate review from the same author/direction", () => {
    const result = checkReviewEligibility({
      booking: makeBooking(),
      authorId: "customer-1",
      existingReviews: [{ bookingId: "booking-1", authorId: "customer-1", direction: "customer_to_provider" }],
    });
    expect(result.eligible).toBe(false);
  });

  it("allows the provider to still review even if the customer already reviewed", () => {
    const result = checkReviewEligibility({
      booking: makeBooking(),
      authorId: "provider-1",
      existingReviews: [{ bookingId: "booking-1", authorId: "customer-1", direction: "customer_to_provider" }],
    });
    expect(result.eligible).toBe(true);
  });
});
