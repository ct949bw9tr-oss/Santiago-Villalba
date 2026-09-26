import { describe, expect, it } from "vitest";
import {
  findSchoolAccess,
  groupBySchool,
  postLoginPath,
  safeRedirectPath,
  schoolHomePath,
  type Membership,
  type SchoolSummary,
} from "./roles";

const alpha: SchoolSummary = { id: "a", slug: "alpha", name: "Alpha", timezone: "America/Bogota", status: "active" };
const bravo: SchoolSummary = { id: "b", slug: "bravo", name: "Bravo", timezone: "America/Bogota", status: "active" };

describe("groupBySchool", () => {
  it("merges roles per school in canonical order", () => {
    const memberships: Membership[] = [
      { role: "teacher", school: alpha },
      { role: "school_admin", school: alpha },
      { role: "student", school: bravo },
    ];
    expect(groupBySchool(memberships)).toEqual([
      { school: alpha, roles: ["school_admin", "teacher"] },
      { school: bravo, roles: ["student"] },
    ]);
  });
});

describe("findSchoolAccess", () => {
  it("returns null for a school the user is not a member of", () => {
    expect(findSchoolAccess([{ role: "school_admin", school: alpha }], "bravo")).toBeNull();
  });
});

describe("schoolHomePath", () => {
  it("prefers admin, then teacher, then student", () => {
    expect(schoolHomePath({ school: alpha, roles: ["school_admin", "teacher"] })).toBe("/s/alpha/admin");
    expect(schoolHomePath({ school: alpha, roles: ["teacher"] })).toBe("/s/alpha/teacher");
    expect(schoolHomePath({ school: alpha, roles: ["student"] })).toBe("/s/alpha/student");
  });
});

describe("postLoginPath", () => {
  it("routes by number of schools", () => {
    expect(postLoginPath([])).toBe("/no-access");
    expect(postLoginPath([{ role: "teacher", school: alpha }])).toBe("/s/alpha");
    expect(
      postLoginPath([
        { role: "teacher", school: alpha },
        { role: "teacher", school: bravo },
      ]),
    ).toBe("/select-school");
  });
});

describe("safeRedirectPath", () => {
  it.each([
    [undefined, "/"],
    ["", "/"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/account/password", "/account/password"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
