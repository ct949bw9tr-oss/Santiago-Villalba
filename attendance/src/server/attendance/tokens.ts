import { createHash, randomBytes } from "node:crypto";

// Reader tokens: 256 random bits, shown to the admin once, stored only as a
// SHA-256 hash. A fast hash is fine here because the token is high-entropy.

const PREFIX = "sat_"; // "school attendance token"

export function generateDeviceToken(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function looksLikeDeviceToken(token: string): boolean {
  return /^sat_[A-Za-z0-9_-]{43}$/.test(token);
}
