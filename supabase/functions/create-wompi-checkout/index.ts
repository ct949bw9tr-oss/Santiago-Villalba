// Creates a pending `payments` row for a booking and returns a Wompi Web Checkout URL
// (https://wompi.co) for it. The customer is redirected there to pay by card, PSE or
// Nequi; Wompi handles the actual payment UI, so no card data ever touches our servers.
// Requires these Edge Function secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { bookingId, redirectUrl } = await req.json();
    if (!bookingId) throw new Error("bookingId is required");

    const authHeader = req.headers.get("Authorization") ?? "";
    // RLS-scoped client: only returns the booking if the caller is a participant.
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: booking, error: bookingError } = await callerClient
      .from("bookings")
      .select("id, customer_id, total_amount, currency")
      .eq("id", bookingId)
      .single();
    if (bookingError || !booking) throw new Error("Booking not found or not accessible");

    const publicKey = Deno.env.get("WOMPI_PUBLIC_KEY");
    const integritySecret = Deno.env.get("WOMPI_INTEGRITY_SECRET");
    if (!publicKey || !integritySecret) throw new Error("Wompi is not configured on the server yet");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        booking_id: booking.id,
        customer_id: booking.customer_id,
        status: "pending",
        amount: booking.total_amount,
        currency: booking.currency,
      })
      .select()
      .single();
    if (paymentError) throw paymentError;

    // COP has no minor unit in our schema (amounts are whole pesos); Wompi always wants
    // amount-in-cents, so whole-peso amounts get *100. Adjust here first if a
    // decimal-minor-unit currency (USD, etc.) is ever added.
    const amountInCents = Math.round(Number(booking.total_amount) * 100);
    const reference = payment.id as string;

    const signaturePayload = `${reference}${amountInCents}${booking.currency}${integritySecret}`;
    const signature = await sha256Hex(signaturePayload);

    const params = new URLSearchParams({
      "public-key": publicKey,
      currency: booking.currency,
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": signature,
      "redirect-url": redirectUrl ?? "https://ct949bw9tr-oss.github.io/Santiago-Villalba/",
    });

    return new Response(JSON.stringify({ checkoutUrl: `https://checkout.wompi.co/p/?${params.toString()}`, paymentId: payment.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
