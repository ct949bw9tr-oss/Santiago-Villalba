import { describe, expect, it } from "vitest";
import { localDateKey, utcWindowAroundLocalDay, wallTimeInZone, zonedWallTimeToUtc } from "./time";

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

describe("zonedWallTimeToUtc / wallTimeInZone", () => {
  it("interprets the wall time in the school's zone, not the viewer's", () => {
    expect(zonedWallTimeToUtc("2026-09-26T03:42", "America/Bogota").toISOString()).toBe("2026-09-26T08:42:00.000Z");
    expect(zonedWallTimeToUtc("2026-09-26T03:42", "America/New_York").toISOString()).toBe("2026-09-26T07:42:00.000Z");
  });

  it("handles DST in the school's zone", () => {
    expect(zonedWallTimeToUtc("2026-03-09T08:00", "America/New_York").toISOString()).toBe("2026-03-09T12:00:00.000Z");
    expect(zonedWallTimeToUtc("2026-03-07T08:00", "America/New_York").toISOString()).toBe("2026-03-07T13:00:00.000Z");
  });

  it("round-trips", () => {
    const instant = new Date("2026-09-26T07:39:00Z");
    expect(wallTimeInZone(instant, "America/Bogota")).toBe("2026-09-26T02:39");
    expect(zonedWallTimeToUtc(wallTimeInZone(instant, "America/Bogota"), "America/Bogota").toISOString()).toBe(
      instant.toISOString(),
    );
  });
});
