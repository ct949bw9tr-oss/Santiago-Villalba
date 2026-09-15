import { Booking, Review, ReviewDirection, UUID } from "@taskswift/types";

export interface ReviewEligibilityInput {
  booking: Booking;
  authorId: UUID;
  existingReviews: Pick<Review, "bookingId" | "authorId" | "direction">[];
}

export type ReviewEligibilityResult =
  | { eligible: true; direction: ReviewDirection; subjectId: UUID }
  | { eligible: false; reason: string };

/** A user may review a booking's counterparty only once, and only after completion. */
export function checkReviewEligibility(input: ReviewEligibilityInput): ReviewEligibilityResult {
  const { booking, authorId, existingReviews } = input;

  if (booking.status !== "completed") {
    return { eligible: false, reason: "Booking must be completed before it can be reviewed" };
  }

  let direction: ReviewDirection;
  let subjectId: UUID;
  if (authorId === booking.customerId) {
    direction = "customer_to_provider";
    subjectId = booking.providerId;
  } else if (authorId === booking.providerId) {
    direction = "provider_to_customer";
    subjectId = booking.customerId;
  } else {
    return { eligible: false, reason: "Only booking participants may leave a review" };
  }

  const alreadyReviewed = existingReviews.some(
    (r) => r.bookingId === booking.id && r.authorId === authorId && r.direction === direction
  );
  if (alreadyReviewed) {
    return { eligible: false, reason: "This booking has already been reviewed by this user" };
  }

  return { eligible: true, direction, subjectId };
}
