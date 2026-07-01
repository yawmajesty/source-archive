import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";

// Stripe requires the raw body for signature verification. Next disables body
// parsing when we read req.text() directly.
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (e: any) {
    console.error("[stripe webhook] signature failed:", e?.message);
    return NextResponse.json({ error: `Webhook signature verification failed: ${e?.message}` }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      // We don't currently track failures beyond leaving the invoice unpaid,
      // but this is where you'd send a "payment failed" notification.
    }
    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("[stripe webhook] handler error:", e);
    // Return 500 so Stripe retries. Idempotency below prevents double-application.
    return NextResponse.json({ error: e?.message ?? "handler error" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;

  const invoiceId = session.metadata?.invoice_id;
  const clientId = session.metadata?.client_id;
  if (!invoiceId || !clientId) {
    console.warn("[stripe webhook] session missing invoice_id metadata:", session.id);
    return;
  }

  // Idempotency: if we've already marked this invoice paid we're done.
  const { data: existing } = await supabase
    .from("sampling_invoices")
    .select("id, status, paid_at, client_id")
    .eq("id", invoiceId)
    .single();
  if (!existing) return;
  if (existing.status === "paid" && existing.paid_at) {
    // Already processed. Refresh cached views and exit.
    revalidatePath(`/portal/${existing.client_id}`);
    return;
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const amountUsd = (session.amount_total ?? 0) / 100;
  const paidAt = new Date().toISOString();

  await supabase
    .from("sampling_invoices")
    .update({
      status: "paid",
      paid_at: paidAt,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", invoiceId);

  // Record the payment as a cost entry (direction=in) so it hits the P&L.
  // Idempotent via source_ref — we don't insert a duplicate if this session
  // was already reconciled.
  const sourceRef = `stripe_session:${session.id}`;
  const { data: existingCost } = await supabase
    .from("costs")
    .select("id")
    .eq("source_ref", sourceRef)
    .maybeSingle();

  if (!existingCost) {
    const fxRate = 0.79; // USD → GBP fallback; agency can adjust the entry later
    await supabase.from("costs").insert({
      id: "cost-" + Date.now(),
      client_id: clientId,
      project_id: null,
      product_id: null,
      source_ref: sourceRef,
      category: session.metadata?.invoice_kind === "production" ? "production" : "sampling",
      description: `Stripe payment · invoice ${invoiceId}`,
      amount: amountUsd,
      currency: "USD",
      fx_rate: fxRate,
      amount_gbp: Math.round(amountUsd * fxRate * 100) / 100,
      direction: "in",
      cost_type: "operating",
      billable_to_client: false,
      paid_by: "Client (Stripe)",
      date_paid: paidAt.slice(0, 10),
    });
  }

  revalidatePath(`/portal/${clientId}`);
  revalidatePath("/costs");
  revalidatePath(`/clients/${clientId}`);
}
