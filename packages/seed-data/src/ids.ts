/**
 * Deterministic ID / jitter helpers built on pure JS (no `node:crypto`), so this
 * package can be imported from Node scripts (the SQL seed generator), the Expo/React
 * Native mobile app, and the Next.js admin app alike. Not cryptographically strong —
 * just stable and collision-resistant enough for fixture data.
 */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Stable UUID-shaped string derived from `seed` — same input always yields the same id. */
export function uuidFrom(seed: string): string {
  const hex = [0, 1, 2, 3].map((i) => fnv1a(`${seed}:${i}`).toString(16).padStart(8, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "5" + hex.slice(13, 16),
    ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function hashInt(str: string): number {
  return fnv1a(str) | 0; // signed 32-bit, mirrors Buffer.readInt32BE's range
}

export function slugify(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

export interface Coord {
  lat: number;
  lng: number;
}

export function jitter(coord: Coord, seedKey: string): Coord {
  const h = fnv1a(seedKey);
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.06;
  const dLng = (((h >>> 8) % 1000) / 1000 - 0.5) * 0.06;
  return { lat: coord.lat + dLat, lng: coord.lng + dLng };
}
