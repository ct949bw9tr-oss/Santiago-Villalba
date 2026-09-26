import { describe, expect, it } from "vitest";
import { ruleSchema, scheduleSchema, studentSchema, teacherInviteSchema } from "./schemas";

describe("studentSchema", () => {
  it("trims and turns empty optionals into null", () => {
    const r = studentSchema.parse({ student_number: " S-1 ", first_name: "Ana", last_name: "Gómez", grade_level: "" });
    expect(r).toEqual({ student_number: "S-1", first_name: "Ana", last_name: "Gómez", grade_level: null, status: "active" });
  });

  it("requires names", () => {
    expect(studentSchema.safeParse({ student_number: "S-1", first_name: " ", last_name: "X" }).success).toBe(false);
  });

  it("ignores unknown fields such as school_id", () => {
    const r = studentSchema.parse({ student_number: "S-1", first_name: "A", last_name: "B", school_id: "evil" });
    expect(r).not.toHaveProperty("school_id");
  });
});

describe("teacherInviteSchema", () => {
  it("normalizes email", () => {
    expect(teacherInviteSchema.parse({ email: "Ana@Colegio.EDU.co", first_name: "Ana", last_name: "G" }).email).toBe(
      "ana@colegio.edu.co",
    );
  });
});

describe("scheduleSchema", () => {
  it("rejects end before start", () => {
    expect(scheduleSchema.safeParse({ weekday: "1", start_time: "09:00", end_time: "08:00" }).success).toBe(false);
  });
  it("accepts a valid slot", () => {
    expect(scheduleSchema.parse({ weekday: "5", start_time: "07:30", end_time: "08:30", room: "" })).toEqual({
      weekday: 5,
      start_time: "07:30",
      end_time: "08:30",
      room: null,
    });
  });
});

describe("ruleSchema", () => {
  const base = {
    early_checkin_minutes: "10",
    late_after_minutes: "5",
    absent_after_minutes: "20",
    scan_after_cutoff: "late",
    duplicate_window_seconds: "60",
  };
  it("parses checkbox and numbers", () => {
    expect(ruleSchema.parse({ ...base, auto_finalize: "on" }).auto_finalize).toBe(true);
    expect(ruleSchema.parse(base).auto_finalize).toBe(false);
  });
  it("requires absent >= late", () => {
    expect(ruleSchema.safeParse({ ...base, late_after_minutes: "30" }).success).toBe(false);
  });
});
