// NFC card UIDs arrive in many shapes ("04:a2:2b:1c:9f:5e:80", "04 A2 2B …",
// "04A22B1C9F5E80"). Everything is stored and compared in one canonical form:
// uppercase hex, no separators, 4 / 7 / 10 bytes (ISO 14443 UID sizes).
//
// Many cheap USB readers ("keyboard emulation") type the UID as a decimal
// number instead, e.g. "0012345678". A digits-only value that can't be hex
// of a valid length (9+ digits, not 14 or 20 long) is read as decimal and
// converted, so the same card always maps to the same canonical UID as long
// as it is enrolled and scanned with the same kind of reader.

const VALID_BYTE_LENGTHS = [4, 7, 10];

function decimalToHex(digits: string): string | null {
  const value = BigInt(digits);
  for (const bytes of VALID_BYTE_LENGTHS) {
    if (value < BigInt(2) ** BigInt(bytes * 8)) return value.toString(16).toUpperCase().padStart(bytes * 2, "0");
  }
  return null;
}

/** Canonical UID, or null if the input isn't a valid 4/7/10-byte UID. */
export function normalizeUid(input: string): string | null {
  const raw = input.replace(/[\s:.-]/g, "").toUpperCase();
  if (/^[0-9]{9,25}$/.test(raw) && !VALID_BYTE_LENGTHS.includes(raw.length / 2)) return decimalToHex(raw);
  if (!/^[0-9A-F]+$/.test(raw)) return null;
  if (!VALID_BYTE_LENGTHS.includes(raw.length / 2)) return null;
  return raw;
}

/** Human-friendly display: "04:A2:2B:1C:9F:5E:80". */
export function formatUid(normalized: string): string {
  return normalized.match(/.{2}/g)?.join(":") ?? normalized;
}
