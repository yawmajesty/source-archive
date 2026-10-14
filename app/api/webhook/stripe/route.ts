import { NextRequest, NextResponse } from "next/server";
import { buildPublicUrl } from "@/lib/url";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { randomBytes } from "crypto";
import { notifyPortalUpdate } from "@/lib/email/portal-notify";
import { revalidatePath } from "next/cache";

// The webhook is called by Stripe with no Clerk auth, so RLS would block
// every write. Service role bypasses RLS; the invoice + client lookups
// give us the agency_id we need to stamp on the new cost entry.
const supabase = getAgencyServiceSupabase();

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
    } else if (
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      await handleCheckoutFailed(event.data.object as Stripe.Checkout.Session, event.type);
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
    } else if (event.type === "charge.failed") {
      await handleChargeFailed(event.data.object as Stripe.Charge);
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

  const { data: paidClient } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();
  const paidAgencyId = (paidClient as { agency_id: string | null } | null)?.agency_id ?? null;

  // Tell them the money landed. The idempotency guard above returns early on
  // a Stripe retry, so a retried webhook cannot send this twice.
  if (paidAgencyId) {
    await notifyPortalUpdate({
      agencyId: paidAgencyId,
      clientId,
      headline: `Payment received — $${amountUsd.toFixed(2)}`,
      detail: "Thank you. Your invoice is now marked paid in the portal.",
      linkLabel: "See your invoices",
      relatedId: invoiceId,
    });
  }

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
    const agencyId = paidAgencyId;
    if (!agencyId) {
      console.warn("[stripe webhook] client has no agency_id — skipping cost entry:", clientId);
      revalidatePath(`/portal/${clientId}`);
      return;
    }
    const fxRate = 1; // Base currency is USD, so Stripe's USD amount stores 1:1.
    // Random suffix on the id: Date.now() alone collides if two payments
    // land in the same millisecond, and a collision here loses the record
    // of money that has actually arrived.
    const costId = `cost-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const { error: costError } = await supabase.from("costs").insert({
      agency_id: agencyId,
      id: costId,
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

    // The invoice is already marked paid above, so a failure here loses
    // only the P&L line — but losing it silently means the books quietly
    // disagree with the bank. Stripe retries on a non-2xx, and the whole
    // handler is idempotent, so failing loudly is safe.
    if (costError) {
      console.error("[stripe webhook] could not record the payment as a cost:", costError.message);
      throw new Error(`Payment recorded but not reconciled: ${costError.message}`);
    }
  }

  revalidatePath(`/portal/${clientId}`);
  revalidatePath("/costs");
  revalidatePath(`/clients/${clientId}`);
}

// ─────────────────────────────────────────────────────────────
// Why a payment did not go through.
//
// Until now this endpoint only listened for successes, so a decline left
// nothing behind anywhere: the invoice simply stayed unpaid and the reason
// lived only in the Stripe dashboard. With clients failing and nobody able
// to say why, that is the gap worth closing first — the next failure now
// explains itself inside the app.
//
// Recorded on the invoice's own notes rather than a new table, because
// there are already migrations waiting to be run and this should not add
// another before it can help.
// ─────────────────────────────────────────────────────────────

/** Prefix so these entries are recognisable, and strippable later. */
const FAILURE_TAG = "[payment failed]";

async function recordFailure(
  invoiceId: string | null,
  clientId: string | null,
  summary: string,
): Promise<void> {
  const supabase = getAgencyServiceSupabase();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const line = `${FAILURE_TAG} ${stamp} UTC — ${summary}`;

  if (invoiceId) {
    const { data } = await supabase
      .from("sampling_invoices")
      .select("notes, client_id")
      .eq("id", invoiceId)
      .maybeSingle();
    const existing = (data as { notes: string | null; client_id: string | null } | null);
    // Newest first, and capped: a card retried ten times should not bury the
    // invoice's real notes.
    const kept = (existing?.notes ?? "")
      .split("\n")
      .filter(Boolean)
      .slice(0, 9)
      .join("\n");
    await supabase
      .from("sampling_invoices")
      .update({ notes: kept ? `${line}\n${kept}` : line })
      .eq("id", invoiceId);
    clientId = clientId ?? existing?.client_id ?? null;
  }

  console.error("[stripe webhook] payment failed:", summary, { invoiceId, clientId });

  // Tell the team, because a client who cannot pay will not always say so.
  if (!clientId) return;
  try {
    const { data: client } = await supabase
      .from("clients")
      .select("agency_id, name")
      .eq("id", clientId)
      .maybeSingle();
    const row = client as { agency_id: string | null; name: string | null } | null;
    if (!row?.agency_id) return;

    const { notifyAgency } = await import("@/lib/email/portal-notify");
    await notifyAgency({
      agencyId: row.agency_id,
      headline: `Payment failed — ${row.name ?? "a client"}`,
      who: row.name ?? "A client",
      quote: summary,
      url: buildPublicUrl("/invoices"),
      linkLabel: "Open Invoices",
      relatedType: "client",
      relatedId: clientId,
    });
  } catch (err) {
    console.error("[stripe webhook] could not alert on the failure:", err);
  }
}

/** Stripe's own words, which are what actually diagnose a decline. */
function describeDecline(
  lastError: Stripe.PaymentIntent.LastPaymentError | null | undefined,
): string {
  if (!lastError) return "No reason given by Stripe.";
  const bits = [
    lastError.message,
    lastError.decline_code ? `decline_code=${lastError.decline_code}` : null,
    lastError.code ? `code=${lastError.code}` : null,
    lastError.type ? `type=${lastError.type}` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const invoiceId = (intent.metadata?.invoice_id as string | undefined) ?? null;
  const clientId = (intent.metadata?.client_id as string | undefined) ?? null;
  const amount = ((intent.amount ?? 0) / 100).toFixed(2);
  await recordFailure(
    invoiceId,
    clientId,
    `$${amount} declined. ${describeDecline(intent.last_payment_error)}`,
  );
}

async function handleChargeFailed(charge: Stripe.Charge): Promise<void> {
  const invoiceId = (charge.metadata?.invoice_id as string | undefined) ?? null;
  const clientId = (charge.metadata?.client_id as string | undefined) ?? null;
  const amount = ((charge.amount ?? 0) / 100).toFixed(2);
  const bits = [
    charge.failure_message,
    charge.failure_code ? `failure_code=${charge.failure_code}` : null,
    charge.outcome?.seller_message,
    charge.outcome?.network_status ? `network=${charge.outcome.network_status}` : null,
    charge.outcome?.reason ? `reason=${charge.outcome.reason}` : null,
    charge.outcome?.risk_level ? `risk=${charge.outcome.risk_level}` : null,
  ].filter(Boolean);
  await recordFailure(
    invoiceId,
    clientId,
    `$${amount} charge failed. ${bits.length ? bits.join(" · ") : "No reason given by Stripe."}`,
  );
}

async function handleCheckoutFailed(
  session: Stripe.Checkout.Session,
  eventType: string,
): Promise<void> {
  const invoiceId = (session.metadata?.invoice_id as string | undefined) ?? null;
  const clientId = (session.metadata?.client_id as string | undefined) ?? null;
  const what =
    eventType === "checkout.session.expired"
      ? "Checkout was opened and abandoned before paying"
      : "A delayed payment method failed";
  await recordFailure(invoiceId, clientId, `${what} (${session.payment_status}).`);
}
