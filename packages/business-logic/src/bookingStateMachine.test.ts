import { describe, expect, it } from "vitest";
import { applyBookingTransition, canTransition, InvalidBookingTransitionError, isTerminalStatus } from "./bookingStateMachine";

describe("booking state machine", () => {
  it("allows the full happy-path lifecycle", () => {
    expect(canTransition("draft", "requested", "customer")).toBe(true);
    expect(canTransition("requested", "pending_provider", "provider")).toBe(true);
    expect(canTransition("pending_provider", "accepted", "provider")).toBe(true);
    expect(canTransition("accepted", "provider_en_route", "provider")).toBe(true);
    expect(canTransition("provider_en_route", "in_progress", "provider")).toBe(true);
    expect(canTransition("in_progress", "awaiting_completion_confirmation", "provider")).toBe(true);
    expect(canTransition("awaiting_completion_confirmation", "completed", "customer")).toBe(true);
  });

  it("rejects a customer marking their own booking completed without confirmation step", () => {
    expect(canTransition("in_progress", "completed", "customer")).toBe(false);
  });

  it("rejects a customer accepting their own request", () => {
    expect(canTransition("pending_provider", "accepted", "customer")).toBe(false);
  });

  it("rejects skipping states", () => {
    expect(canTransition("requested", "accepted", "provider")).toBe(false);
    expect(canTransition("draft", "completed", "system")).toBe(false);
  });

  it("allows either party to cancel before completion", () => {
    expect(canTransition("accepted", "cancelled_customer", "customer")).toBe(true);
    expect(canTransition("accepted", "cancelled_provider", "provider")).toBe(true);
  });

  it("allows the system to expire unanswered requests", () => {
    expect(canTransition("requested", "expired", "system")).toBe(true);
    expect(canTransition("requested", "expired", "customer")).toBe(false);
  });

  it("allows admin to resolve disputes", () => {
    expect(canTransition("disputed", "refunded", "admin")).toBe(true);
    expect(canTransition("disputed", "refunded", "customer")).toBe(false);
  });

  it("applyBookingTransition throws InvalidBookingTransitionError on an illegal move", () => {
    expect(() => applyBookingTransition("draft", "completed", "customer")).toThrow(InvalidBookingTransitionError);
  });

  it("applyBookingTransition returns the new status on a legal move", () => {
    expect(applyBookingTransition("draft", "requested", "customer")).toBe("requested");
  });

  it("identifies terminal statuses", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("cancelled_customer")).toBe(true);
    expect(isTerminalStatus("in_progress")).toBe(false);
  });

  it("never allows a transition out of a terminal status except admin dispute paths", () => {
    expect(canTransition("cancelled_customer", "requested", "customer")).toBe(false);
    expect(canTransition("expired", "requested", "system")).toBe(false);
  });
});
