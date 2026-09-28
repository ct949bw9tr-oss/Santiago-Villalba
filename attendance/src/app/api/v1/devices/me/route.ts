import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/server/db/supabase-admin";
import { hashDeviceToken, looksLikeDeviceToken } from "@/server/attendance/tokens";

// GET /api/v1/devices/me — lets a reader (the /kiosk screen, the Wi-Fi reader)
// check its token and learn what to display, and records a heartbeat.
// Returns only this device's own labels.

function problem(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!looksLikeDeviceToken(token)) return problem(401, "invalid_token");

  const admin = createSupabaseAdminClient();
  const { data: device } = await admin
    .from("devices")
    .select("id, name, status, location, class:class_sections(name), school:schools!inner(name, timezone, status)")
    .eq("token_hash", hashDeviceToken(token))
    .eq("kind", "reader")
    .returns<
      {
        id: string;
        name: string;
        status: "active" | "disabled";
        location: string | null;
        class: { name: string } | null;
        school: { name: string; timezone: string; status: string };
      }[]
    >()
    .maybeSingle();
  if (!device) return problem(401, "invalid_token");

  // Doubles as the reader's heartbeat, so "En línea" works before any tap.
  await admin.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

  return NextResponse.json(
    {
      device: { name: device.name, status: device.status, location: device.location, class_name: device.class?.name ?? null },
      school: { name: device.school.name, timezone: device.school.timezone, status: device.school.status },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
