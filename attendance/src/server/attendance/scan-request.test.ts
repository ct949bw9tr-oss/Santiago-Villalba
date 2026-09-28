import { describe, expect, it } from "vitest";
import { effectiveScanTime, idempotencyKeySchema, scanRequestSchema } from "./scan-request";

const now = new Date("2026-09-28T13:00:00Z");

describe("effectiveScanTime", () => {
  it("uses receipt time when the device sends none", () => {
    expect(effectiveScanTime("reader", now)).toEqual({ ok: true, effectiveAt: now, detail: null });
  });

  it("trusts a reader clock within 2 minutes", () => {
    const r = effectiveScanTime("reader", now, "2026-09-28T12:59:10Z");
    expect(r).toEqual({ ok: true, effectiveAt: new Date("2026-09-28T12:59:10Z"), detail: null });
  });

  it("accepts taps a reader stored while offline (same day), tagged", () => {
    const r = effectiveScanTime("reader", now, "2026-09-28T12:30:00Z");
    expect(r).toEqual({ ok: true, effectiveAt: new Date("2026-09-28T12:30:00Z"), detail: "stored offline" });
  });

  it("ignores a reader clock in the future", () => {
    const r = effectiveScanTime("reader", now, "2026-09-28T13:30:00Z");
    expect(r).toEqual({ ok: true, effectiveAt: now, detail: "reader clock ignored" });
  });

  it("ignores reader times older than 12 hours", () => {
    const r = effectiveScanTime("reader", now, "2026-09-27T23:00:00Z");
    expect(r).toEqual({ ok: true, effectiveAt: now, detail: "reader clock ignored" });
  });

  it("lets the simulator pick a time within a day, tagged", () => {
    const r = effectiveScanTime("simulator", now, "2026-09-28T20:00:00Z");
    expect(r).toEqual({ ok: true, effectiveAt: new Date("2026-09-28T20:00:00Z"), detail: "simulated time" });
  });

  it("rejects simulator times beyond a day", () => {
    expect(effectiveScanTime("simulator", now, "2026-09-30T13:00:00Z").ok).toBe(false);
  });
});

describe("scanRequestSchema", () => {
  it("accepts the documented body", () => {
    expect(
      scanRequestSchema.safeParse({ uid: "04:A2:2B:1C:9F:5E:80", scanned_at: "2026-09-28T13:00:00-05:00", reader: { fw: "1" } })
        .success,
    ).toBe(true);
  });
  it("ignores ids the client must not choose", () => {
    const r = scanRequestSchema.parse({ uid: "AABBCCDD", school_id: "x", device_id: "y", student_id: "z" });
    expect(r).toEqual({ uid: "AABBCCDD" });
  });
  it("rejects timestamps without an offset", () => {
    expect(scanRequestSchema.safeParse({ uid: "AABBCCDD", scanned_at: "2026-09-28 13:00" }).success).toBe(false);
  });
});

describe("idempotencyKeySchema", () => {
  it.each(["short", "has space in it", "x".repeat(129)])("rejects %s", (k) => {
    expect(idempotencyKeySchema.safeParse(k).success).toBe(false);
  });
  it("accepts a uuid", () => {
    expect(idempotencyKeySchema.safeParse("6f1c1f0e-2c1b-4b8e-9d51-3c4f1a2b3c4d").success).toBe(true);
  });
});
