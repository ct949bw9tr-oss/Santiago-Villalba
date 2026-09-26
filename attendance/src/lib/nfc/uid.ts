// NFC card UIDs arrive in many shapes ("04:a2:2b:1c:9f:5e:80", "04 A2 2B …",
// "04A22B1C9F5E80"). Everything is stored and compared in one canonical form:
// uppercase hex, no separators, 4 / 7 / 10 bytes (ISO 14443 UID sizes).

const VALID_BYTE_LENGTHS = [4, 7, 10];

/** Canonical UID, or null if the input isn't a valid 4/7/10-byte hex UID. */
export function normalizeUid(input: string): string | null {
  const hex = input.replace(/[\s:.-]/g, "").toUpperCase();
  if (!/^[0-9A-F]+$/.test(hex)) return null;
  if (!VALID_BYTE_LENGTHS.includes(hex.length / 2)) return null;
  return hex;
}

/** Human-friendly display: "04:A2:2B:1C:9F:5E:80". */
export function formatUid(normalized: string): string {
  return normalized.match(/.{2}/g)?.join(":") ?? normalized;
}
