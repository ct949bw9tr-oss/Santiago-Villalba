import { describe, expect, it } from "vitest";
import { localDateKey, utcWindowAroundLocalDay } from "./time";

describe("localDateKey", () => {
  it("uses the school's timezone, not UTC", () => {
    // 03:30 UTC on Sept 27 is still Sept 26 in Bogotá (UTC-5).
    const instant = new Date("2026-09-27T03:30:00Z");
    expect(localDateKey(instant, "America/Bogota")).toBe("2026-09-26");
    expect(localDateKey(instant, "Europe/Madrid")).toBe("2026-09-27");
  });

  it("handles DST transitions", () => {
    // New York springs forward on 2026-03-08; 06:30 UTC is 01:30 EST (still Mar 8).
    expect(localDateKey(new Date("2026-03-08T06:30:00Z"), "America/New_York")).toBe("2026-03-08");
  });
});

describe("utcWindowAroundLocalDay", () => {
  it("covers the full local day for extreme offsets", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    const { from, to } = utcWindowAroundLocalDay(now);
    // Local midnight at UTC+14 and end of day at UTC-12 must both fall inside.
    expect(from.getTime()).toBeLessThanOrEqual(new Date("2026-09-25T10:00:00Z").getTime());
    expect(to.getTime()).toBeGreaterThanOrEqual(new Date("2026-09-27T12:00:00Z").getTime());
  });
});
