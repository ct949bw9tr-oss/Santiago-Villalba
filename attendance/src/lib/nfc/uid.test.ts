import { describe, expect, it } from "vitest";
import { formatUid, normalizeUid } from "./uid";

describe("normalizeUid", () => {
  it.each([
    ["04:a2:2b:1c:9f:5e:80", "04A22B1C9F5E80"],
    ["04 A2 2B 1C 9F 5E 80", "04A22B1C9F5E80"],
    ["04-a2-2b-1c", "04A22B1C"],
    ["  deadbeef  ", "DEADBEEF"],
    ["0102030405060708090A", "0102030405060708090A"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeUid(input)).toBe(expected);
  });

  it.each(["", "04A2", "04A22B1C9F", "ZZZZZZZZ", "04A22B1C9F5E8", "04A22B1C9F5E80FF"])("rejects %s", (input) => {
    expect(normalizeUid(input)).toBeNull();
  });
});

describe("formatUid", () => {
  it("groups bytes with colons", () => {
    expect(formatUid("04A22B1C9F5E80")).toBe("04:A2:2B:1C:9F:5E:80");
  });
});
