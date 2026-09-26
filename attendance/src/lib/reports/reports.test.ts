import { describe, expect, it } from "vitest";
import { csvCell, toCsv, UTF8_BOM } from "./csv";
import { filtersToQuery, parseReportFilters } from "./filters";

const TODAY = "2026-09-26";
const CLASS = "0000000a-0000-0000-0004-000000000001";

describe("parseReportFilters", () => {
  it("defaults to the last 30 days", () => {
    expect(parseReportFilters({}, TODAY)).toEqual({
      filters: { from: "2026-08-28", to: TODAY, classId: null, studentId: null, status: null },
      error: null,
    });
  });

  it("keeps valid filters", () => {
    const { filters, error } = parseReportFilters(
      { from: "2026-09-01", to: "2026-09-15", class: CLASS, status: "late" },
      TODAY,
    );
    expect(error).toBeNull();
    expect(filters).toEqual({ from: "2026-09-01", to: "2026-09-15", classId: CLASS, studentId: null, status: "late" });
  });

  it("drops invalid ids and statuses silently", () => {
    const { filters } = parseReportFilters({ class: "x' or 1=1", student: "abc", status: "hacked" }, TODAY);
    expect(filters.classId).toBeNull();
    expect(filters.studentId).toBeNull();
    expect(filters.status).toBeNull();
  });

  it("rejects impossible dates", () => {
    const r = parseReportFilters({ from: "2026-02-30", to: TODAY }, TODAY);
    expect(r.error).toMatch(/formato/);
    expect(r.filters.to).toBe(TODAY);
  });

  it("swaps a reversed range", () => {
    const r = parseReportFilters({ from: "2026-09-20", to: "2026-09-10" }, TODAY);
    expect(r.filters).toMatchObject({ from: "2026-09-10", to: "2026-09-20" });
    expect(r.error).toMatch(/posterior/);
  });

  it("caps the range at 366 days", () => {
    const r = parseReportFilters({ from: "2020-01-01", to: "2026-09-26" }, TODAY);
    expect(r.filters.from).toBe("2025-09-26");
    expect(r.error).toMatch(/366/);
  });

  it("round-trips through the query string", () => {
    const { filters } = parseReportFilters({ from: "2026-09-01", to: "2026-09-15", class: CLASS }, TODAY);
    expect(filtersToQuery(filters)).toBe(`from=2026-09-01&to=2026-09-15&class=${CLASS}`);
  });
});

describe("csv", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('Díaz, "Lucía"')).toBe('"Díaz, ""Lucía"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-5)).toBe("-5"); // real numbers stay numbers
  });

  it("starts with a BOM and uses CRLF", () => {
    expect(toCsv([["a", "b"], ["1", "2"]])).toBe(`${UTF8_BOM}a,b\r\n1,2\r\n`);
  });
});
