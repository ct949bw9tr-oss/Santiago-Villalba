import { describe, expect, it } from "vitest";
import { ProviderAvailabilityException, ProviderAvailabilitySlot } from "@taskswift/types";
import { isProviderAvailableAt } from "./availability";

const slots: ProviderAvailabilitySlot[] = [
  { id: "s1", providerId: "p1", dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true }, // Tuesday
];

describe("isProviderAvailableAt", () => {
  it("returns true within a recurring weekly slot", () => {
    // 2026-01-06 is a Tuesday
    expect(isProviderAvailableAt({ slots, exceptions: [], when: new Date("2026-01-06T14:00:00Z") })).toBe(true);
  });

  it("returns false outside the recurring slot's hours", () => {
    expect(isProviderAvailableAt({ slots, exceptions: [], when: new Date("2026-01-06T20:00:00Z") })).toBe(false);
  });

  it("returns false on a day with no matching slot", () => {
    // 2026-01-07 is a Wednesday
    expect(isProviderAvailableAt({ slots, exceptions: [], when: new Date("2026-01-07T14:00:00Z") })).toBe(false);
  });

  it("respects a blocking exception (vacation day) over the recurring slot", () => {
    const exceptions: ProviderAvailabilityException[] = [{ id: "e1", providerId: "p1", date: "2026-01-06", isAvailable: false }];
    expect(isProviderAvailableAt({ slots, exceptions, when: new Date("2026-01-06T14:00:00Z") })).toBe(false);
  });

  it("respects an extra-availability exception on an otherwise unavailable day", () => {
    const exceptions: ProviderAvailabilityException[] = [
      { id: "e2", providerId: "p1", date: "2026-01-07", isAvailable: true, startTime: "10:00", endTime: "12:00" },
    ];
    expect(isProviderAvailableAt({ slots, exceptions, when: new Date("2026-01-07T11:00:00Z") })).toBe(true);
  });
});
