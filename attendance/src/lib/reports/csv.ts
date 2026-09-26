// CSV for spreadsheets (Excel, Google Sheets, Numbers).

/** Excel opens UTF-8 CSV correctly (accents, ñ) only with a byte-order mark. */
export const UTF8_BOM = "﻿";

/**
 * One cell. Values a spreadsheet would run as a formula (=, +, -, @, tab, CR)
 * are prefixed with an apostrophe (CSV/formula injection), then the cell is
 * quoted if it contains separators, quotes or line breaks.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return UTF8_BOM + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
