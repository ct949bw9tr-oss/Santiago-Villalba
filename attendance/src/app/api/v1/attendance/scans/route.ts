import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authenticateReader, authenticateSimulator, type AuthResult } from "@/server/attendance/scan-context";
import { processScan } from "@/server/attendance/process-scan";
import { effectiveScanTime, idempotencyKeySchema, scanRequestSchema } from "@/server/attendance/scan-request";
import { normalizeUid } from "@/lib/nfc/uid";

// POST /api/v1/attendance/scans — the one ingestion endpoint for card taps.
// Registered readers authenticate with `Authorization: Bearer <token>`; the
// web simulator with the admin's session + `X-School-Slug`. Both end up in the
// same engine call. Contract: docs/API.md.

function problem(status: number, error: string, requestId: string) {
  return NextResponse.json({ error, request_id: requestId }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const receivedAt = new Date();

  // --- Who is calling? ---
  const authHeader = request.headers.get("authorization");
  let auth: AuthResult;
  if (authHeader?.startsWith("Bearer ")) {
    auth = await authenticateReader(authHeader.slice("Bearer ".length).trim());
  } else {
    // Cookie-authenticated path: refuse cross-site requests (CSRF). A custom
    // header plus a JSON body already forces a CORS preflight we never allow.
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return problem(403, "cross_origin_request", requestId);
    const slug = request.headers.get("x-school-slug");
    if (!slug) return problem(401, "missing_credentials", requestId);
    auth = await authenticateSimulator(slug);
  }
  if (!auth.ok) return problem(auth.status, auth.error, requestId);

  // --- What are they sending? ---
  const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
  if (!key.success) return problem(400, "missing_or_invalid_idempotency_key", requestId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return problem(400, "invalid_json", requestId);
  }
  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) return problem(400, "invalid_body", requestId);

  const time = effectiveScanTime(auth.ctx.deviceKind, receivedAt, parsed.data.scanned_at);
  if (!time.ok) return problem(400, time.error, requestId);

  // --- The engine ---
  const result = await processScan(auth.ctx, {
    // Canonical hex (also converts decimal output of keyboard-emulation
    // readers); anything unparseable is passed through and logged as unknown.
    uid: normalizeUid(parsed.data.uid) ?? parsed.data.uid,
    idempotencyKey: key.data,
    effectiveAt: time.effectiveAt,
    deviceScannedAt: parsed.data.scanned_at,
    detail: time.detail,
    requestId,
  });
  if (!result.ok) return problem(result.status, result.error, requestId);

  // Business outcomes (including rejections) are 200 so readers can give feedback.
  return NextResponse.json(result.response, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}
