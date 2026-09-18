// Receives Wompi's async transaction events (configure this function's URL as the
// "URL de Eventos" in the Wompi dashboard under Desarrollo -> Programadores) and marks
// the matching `payments` row as paid/failed. This is the source of truth for whether a
// booking actually got paid — the browser redirect back from checkout is only a hint,
// since the customer could close the tab before it fires.
// Requires the WOMPI_EVENTS_SECRET Edge Function secret.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const eventsSecret = Deno.env.get("WOMPI_EVENTS_SECRET");
    if (!eventsSecret) throw new Error("Wompi events secret is not configured on the server yet");

    const ok = await verifySignature(body, eventsSecret);
    if (!ok) return new Response("invalid signature", { status: 401 });

    const transaction = body?.data?.transaction;
    if (!transaction?.reference || !transaction?.status) {
      return new Response("ignored: no transaction in payload", { status: 200 });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const status = mapStatus(transaction.status as string);
    const now = new Date().toISOString();
    await admin
      .from("payments")
      .update({
        status,
        provider_reference: transaction.id,
        ...(status === "paid" ? { authorized_at: now, captured_at: now } : {}),
        ...(status === "failed" ? { failure_reason: transaction.status_message ?? transaction.status } : {}),
      })
      .eq("id", transaction.reference);

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
  }
});

function mapStatus(wompiStatus: string): "paid" | "failed" | "pending" {
  if (wompiStatus === "APPROVED") return "paid";
  if (wompiStatus === "DECLINED" || wompiStatus === "ERROR" || wompiStatus === "VOIDED") return "failed";
  return "pending";
}

// Wompi's event signature: SHA256 of the concatenated *values* of body.signature.properties
// (read off body.data in that order) + body.timestamp + the events secret, hex-encoded,
// compared against body.signature.checksum. Verify against Wompi's current docs before
// relying on this in production — this was implemented from memory, without live access
// to fetch their reference docs while building it.
async function verifySignature(body: any, secret: string): Promise<boolean> {
  const props: string[] = body?.signature?.properties ?? [];
  const checksum: string = body?.signature?.checksum ?? "";
  const timestamp = body?.timestamp;
  if (!props.length || !checksum || timestamp === undefined) return false;

  const values = props.map((path) => path.split(".").reduce((obj: any, key: string) => obj?.[key], body.data));
  const payload = `${values.join("")}${timestamp}${secret}`;
  const computed = await sha256Hex(payload);
  return computed.toUpperCase() === String(checksum).toUpperCase();
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
