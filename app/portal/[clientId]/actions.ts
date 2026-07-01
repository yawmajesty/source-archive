"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getStripe } from "@/lib/stripe";
import { getPublicOrigin } from "@/lib/url";
import type { InvoiceLineItem } from "@/lib/data";

export async function logPortalVisit(data: {
  client_id: string;
  session_id: string;
  path: string;
}): Promise<string | null> {
  const id = "pv-" + Date.now() + "-" + randomUUID().slice(0, 8);
  const { error } = await supabase.from("portal_visits").insert({
    id,
    client_id: data.client_id,
    session_id: data.session_id,
    path: data.path,
  });
  if (error) return null;
  return id;
}

export async function updateVisitDuration(visitId: string, durationMs: number): Promise<void> {
  if (!visitId || durationMs <= 0) return;
  await supabase.from("portal_visits").update({ duration_ms: durationMs }).eq("id", visitId);
}

export async function createSamplingInvoice(data: {
  client_id: string;
  round: number;
  title: string | null;
  line_items: InvoiceLineItem[];
  notes: string | null;
}): Promise<void> {
  await supabase.from("sampling_invoices").insert({ ...data, status: "draft" });
  revalidatePath(`/portal/${data.client_id}`);
}

export async function updateInvoiceStatus(id: string, clientId: string, status: string): Promise<void> {
  await supabase.from("sampling_invoices").update({ status }).eq("id", id);

  if (status === "paid") {
    // Avoid double-inserting if already recorded
    const { data: existing } = await supabase
      .from("costs")
      .select("id")
      .eq("source_ref", `invoice:${id}`)
      .maybeSingle();

    if (!existing) {
      const { data: invoice } = await supabase
        .from("sampling_invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (invoice) {
        const lineItems = (invoice.line_items ?? []) as Array<{ amount_usd?: number }>;
        const totalUsd = lineItems.reduce((s, li) => s + (li.amount_usd ?? 0), 0);
        const fxRate = 0.79; // USD → GBP default; user can edit the entry later
        const label = invoice.title ?? `Round ${invoice.round} Sampling`;

        await supabase.from("costs").insert({
          id: "cost-" + Date.now(),
          client_id: clientId,
          project_id: null,
          product_id: null,
          source_ref: `invoice:${id}`,
          category: "sampling",
          description: `${label} — client payment`,
          amount: totalUsd,
          currency: "USD",
          fx_rate: fxRate,
          amount_gbp: Math.round(totalUsd * fxRate * 100) / 100,
          direction: "in",
          cost_type: "operating",
          billable_to_client: false,
          paid_by: "Client",
          date_paid: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }

  revalidatePath(`/portal/${clientId}`);
  revalidatePath("/costs");
}

export async function deleteInvoice(id: string, clientId: string): Promise<void> {
  await supabase.from("sampling_invoices").delete().eq("id", id);
  revalidatePath(`/portal/${clientId}`);
}

// ── Stripe Checkout ────────────────────────────────────────────────

export async function createInvoiceCheckout(invoiceId: string): Promise<
  { url: string } | { error: string }
> {
  // Load the invoice we want to charge for and confirm it's chargeable.
  const { data: invoice, error: loadErr } = await supabase
    .from("sampling_invoices")
    .select("*, clients(name, contact_email)")
    .eq("id", invoiceId)
    .single();
  if (loadErr || !invoice) return { error: "Invoice not found" };
  if (invoice.status === "paid") return { error: "This invoice is already paid" };
  if (invoice.status === "draft") return { error: "Invoice is still in draft — send it before taking payment" };

  const lineItems = (invoice.line_items ?? []) as InvoiceLineItem[];
  const projectTotal = lineItems.reduce((s, li) => s + (li.amount_usd ?? 0), 0);
  const deposit = invoice.deposit_percent ?? 100;
  const amountDueUsd = projectTotal * (deposit / 100);
  if (amountDueUsd <= 0) return { error: "Invoice total is zero — nothing to charge" };

  const isProduction = invoice.invoice_kind === "production";
  const invoiceLabel = invoice.title
    ?? (isProduction ? `Production invoice — Round ${invoice.round}` : `Sampling invoice — Round ${invoice.round}`);
  const description = deposit < 100
    ? `${invoiceLabel} · ${deposit}% deposit`
    : invoiceLabel;

  const origin = getPublicOrigin();
  const successUrl = `${origin}/portal/${invoice.client_id}?paid=${invoice.id}#invoices`;
  const cancelUrl = `${origin}/portal/${invoice.client_id}#invoices`;

  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Cards + wallets by default. Stripe automatically enables more methods
      // based on the merchant's Stripe Dashboard settings.
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amountDueUsd * 100), // Stripe uses minor units
            product_data: {
              name: description,
              description: `${(invoice.clients as any)?.name ?? "Client"} · ${lineItems.length} line item${lineItems.length !== 1 ? "s" : ""}`,
            },
          },
        },
      ],
      customer_email: (invoice.clients as any)?.contact_email ?? undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // metadata is what the webhook reads back to identify the invoice.
      metadata: {
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        invoice_kind: invoice.invoice_kind ?? "sampling",
        deposit_percent: String(deposit),
      },
    });
  } catch (e: any) {
    return { error: `Stripe error: ${e?.message ?? String(e)}` };
  }

  // Store the session id so we can reconcile even if the webhook is delayed
  // and so the UI can show "Payment in progress" style state if we want it later.
  await supabase
    .from("sampling_invoices")
    .update({ stripe_session_id: session.id })
    .eq("id", invoice.id);

  return { url: session.url ?? "" };
}
