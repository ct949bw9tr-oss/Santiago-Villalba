import { describe, expect, it } from "vitest";
import { attendanceRate, riskLevel, initials, avatarTone } from "@/lib/ui/format";

describe("ui format helpers", () => {
  it("computes the attendance rate like the reports", () => {
    expect(attendanceRate({ present: 8, late: 1, absent: 1 })).toBe(90);
    expect(attendanceRate({ present: 0, late: 0, absent: 0 })).toBeNull();
    expect(attendanceRate({ present: 1, late: 0, absent: 2 })).toBe(33.3);
  });

  it("classifies risk", () => {
    expect(riskLevel(null, 0)).toBe("none");
    expect(riskLevel(70, 0)).toBe("risk");
    expect(riskLevel(85, 0)).toBe("watch");
    expect(riskLevel(95, 3)).toBe("watch");
    expect(riskLevel(95, 1)).toBe("ok");
  });

  it("builds initials and stable avatar tones", () => {
    expect(initials("Enrique", "Torres")).toBe("ET");
    expect(initials("Ana María")).toBe("AM");
    expect(avatarTone("x")).toBe(avatarTone("x"));
    expect(avatarTone("abc")).toBeGreaterThanOrEqual(0);
  });
});
