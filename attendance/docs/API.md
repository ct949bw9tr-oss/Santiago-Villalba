# Attendance API

One endpoint receives every card tap: registered NFC readers and the web
simulator use it identically. Only how the caller authenticates differs.

## `POST /api/v1/attendance/scans`

### Authentication

| Caller | How |
|---|---|
| NFC reader | `Authorization: Bearer <reader token>` — created in **Admin → Devices**, shown once, stored only as a SHA-256 hash. |
| Web simulator | The signed-in admin's session cookie + `X-School-Slug: <school>`; the simulator must be enabled for the school. Cross-origin requests are refused. |

The school, device and student are **never** taken from the request body.

### Headers

| Header | Required | Notes |
|---|---|---|
| `Idempotency-Key` | yes | 8–128 chars `[A-Za-z0-9._:-]`. One per physical tap; reuse it when retrying. |
| `Content-Type: application/json` | yes | |

### Body

```json
{ "uid": "04:A2:2B:1C:9F:5E:80", "scanned_at": "2026-09-28T08:02:11-05:00", "reader": { "firmware": "1.0.0" } }
```

- `uid` (required): 4, 7 or 10-byte hex; separators and case don't matter.
- `scanned_at` (optional, ISO-8601 with offset): used only if within ±2 minutes
  of the server's clock (the simulator may use any time within ±24 h, tagged
  as simulated). Otherwise the server's receipt time counts.
- `reader` (optional): free-form diagnostics.

### Response `200 OK`

Every business outcome, including rejections, is a 200 so the reader can give
feedback:

```json
{
  "scan_id": "…",
  "outcome": "recorded",
  "feedback": "accept",
  "message": "Present — Math 7A",
  "effective_at": "2026-09-28T13:02:11+00:00",
  "attendance": {
    "record_id": "…", "status": "present", "class_session_id": "…",
    "class_name": "Math 7A", "checked_in_at": "2026-09-28T13:02:11+00:00"
  },
  "student": { "display_name": "Diego D." }
}
```

| `outcome` | Meaning | `feedback` |
|---|---|---|
| `recorded` | Attendance written (present/late, or an automatic absence replaced) | `accept` (present) / `warn` (late) |
| `duplicate` | Already recorded for this class (or a teacher set it manually) | `warn` |
| `after_cutoff` | Past the absence cutoff: recorded absent or rejected, per school rule | `warn` / `reject` |
| `too_early` | Their next class today hasn't opened check-in yet | `reject` |
| `no_active_session` | No class for this student right now | `reject` |
| `not_enrolled` | Classroom reader, but the student isn't in that class | `reject` |
| `unknown_credential` | Card not registered in this school (no student data returned) | `reject` |
| `inactive_credential` | Card marked lost or revoked | `reject` |
| `inactive_student` | Student is not active | `reject` |
| `device_disabled` | Reader disabled by an admin | `reject` |
| `school_suspended` | School account suspended | `reject` |

Retrying with the same `Idempotency-Key` returns the original response with
`"replayed": true` and records nothing new.

### Errors

| Status | `error` |
|---|---|
| 400 | `missing_or_invalid_idempotency_key`, `invalid_json`, `invalid_body`, simulator time out of range |
| 401 | `invalid_token`, `not_signed_in`, `missing_credentials` |
| 403 | `not_an_admin`, `simulator_disabled`, `cross_origin_request`, `school_suspended` |
| 409 | `idempotency_key_reused_with_different_card` |
| 500 | `internal_error` (with `request_id` for support) |

### Example (reader)

```bash
curl -X POST https://<your-app>/api/v1/attendance/scans \
  -H "Authorization: Bearer sat_…" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"uid":"04A22B1C9F5E80"}'
```

## How a tap is decided

All in one database transaction (`public.process_scan`):

1. Replay if this `(device, Idempotency-Key)` was seen before.
2. Reject if the reader is disabled or the school suspended.
3. Find the **active** card in the **reader's school** → student (must be active).
4. Same card on the same reader within the debounce window → `duplicate`.
5. Pick the session: the student's enrolled classes (on that date) whose
   check-in window contains the tap — from *early check-in* before start to
   the later of the class end and the absence cutoff. A classroom reader only
   considers its class. Preference: classes not yet attended, then classes
   still running, then the nearest start.
6. Classify: ≤ *on time until* → present; ≤ *absent after* → late; later →
   the school's cutoff rule (late / absent / reject). The rule is frozen on
   the session at its first tap.
7. One record per student per session. An automatic absence is replaced by
   a real tap; a teacher's manual decision is never overwritten.
8. The tap is logged in `scan_events` (append-only) and every record change in
   `audit_logs`, attributed to the device.

Every 5 minutes `finalize_due_sessions()` closes sessions past their absence
cutoff, marking enrolled students without a record as absent.

## `GET /api/v1/devices/me`

Lets a reader check its token and learn what to display (used by the `/kiosk`
screen). `Authorization: Bearer <reader token>`.

- `200` → `{ "device": { "name", "status", "location", "class_name" }, "school": { "name", "timezone", "status" } }`
- `401` → `{ "error": "invalid_token" }` (unknown, rotated or malformed token)

## Card UID formats

`uid` may be hex with or without separators (`04:A2:2B:1C`, `04A22B1C`) or the
**decimal** number many keyboard-emulation USB readers type (`0012345678`,
9+ digits). Decimal values are converted to 4/7/10-byte hex. Enroll and scan a
card with the same kind of reader so both produce the same UID.

## Classroom reader screen (`/kiosk`)

A browser page for a tablet, iPad, PC or Android phone next to the classroom
door. It stores the reader token in that browser only (set up by pasting it or
opening `/kiosk#token=…`; the fragment is never sent to the server), accepts
keyboard-emulation readers (UID + Enter) and Web NFC on Android Chrome, and
queues taps while offline (same idempotency key on retry). A queued tap sent
more than 2 minutes late counts at its arrival time, per the reader clock rule.
