"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";
import type { InvoiceLineItem } from "@/lib/data";

export async function createProjectQuote(data: {
  client_id: string;
  project_id: string;
  round: number;
  line_items: InvoiceLineItem[];
  invoice_kind?: "sampling" | "production";
  deposit_percent?: number;
  title?: string | null;
}): Promise<void> {
  await supabase.from("sampling_invoices").insert({
    client_id: data.client_id,
    round: data.round,
    title: data.title ?? null,
    line_items: data.line_items,
    notes: null,
    status: "draft",
    invoice_kind: data.invoice_kind ?? "sampling",
    deposit_percent: data.deposit_percent ?? 100,
  });
  revalidatePath(`/projects/${data.project_id}`);
  revalidatePath(`/portal/${data.client_id}`);
}

export async function sendQuote(invoiceId: string, clientId: string, projectId: string): Promise<void> {
  await supabase.from("sampling_invoices").update({ status: "sent" }).eq("id", invoiceId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal/${clientId}`);
}

export async function deleteQuote(invoiceId: string, clientId: string, projectId: string): Promise<void> {
  await supabase.from("sampling_invoices").delete().eq("id", invoiceId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal/${clientId}`);
}

// Mark an invoice as paid manually — used when the client paid via bank
// transfer or some other channel that isn't the Stripe webhook. Records the
// paid_at timestamp so we know when the money arrived.
export async function markInvoicePaid(invoiceId: string, clientId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("sampling_invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal/${clientId}`);
  return { success: true };
}

// Given a paid deposit invoice, create a follow-up balance invoice for the
// unpaid remainder. Same line items, same client + project, but the deposit_percent
// flips to (100 - deposit) so the totals compute to the outstanding balance.
// Linked to the parent via parent_invoice_id so we can prevent duplicates.
export async function createBalanceInvoice(parentInvoiceId: string, projectId: string): Promise<
  { success: true; newInvoiceId: string } | { success: false; error: string }
> {
  const { data: parent, error: loadErr } = await supabase
    .from("sampling_invoices")
    .select("*")
    .eq("id", parentInvoiceId)
    .single();
  if (loadErr || !parent) return { success: false, error: loadErr?.message ?? "Parent invoice not found" };

  if (parent.invoice_kind !== "production") {
    return { success: false, error: "Balance invoices are only supported for production invoices." };
  }
  if (parent.status !== "paid") {
    return { success: false, error: "Mark the deposit invoice as paid before generating the balance." };
  }
  const parentDeposit = Number(parent.deposit_percent ?? 100);
  if (parentDeposit >= 100) {
    return { success: false, error: "This invoice was billed at 100% — there's no balance to invoice." };
  }

  // Prevent duplicate balances for the same parent.
  const { data: existing } = await supabase
    .from("sampling_invoices")
    .select("id")
    .eq("parent_invoice_id", parentInvoiceId)
    .maybeSingle();
  if (existing) {
    return { success: false, error: `A balance invoice already exists for this deposit (id: ${existing.id}).` };
  }

  // Compute round for the new invoice — one higher than the current max on
  // this client so the portal tabs stay in order.
  const { data: highestRoundRows } = await supabase
    .from("sampling_invoices")
    .select("round")
    .eq("client_id", parent.client_id)
    .order("round", { ascending: false })
    .limit(1);
  const nextRound = (highestRoundRows?.[0]?.round ?? parent.round) + 1;

  const remainingPct = Math.max(0, Math.min(100, 100 - parentDeposit));

  const { data: inserted, error: insertErr } = await supabase
    .from("sampling_invoices")
    .insert({
      client_id: parent.client_id,
      round: nextRound,
      title: parent.title ? `${parent.title} — Balance` : `Production invoice — Balance`,
      line_items: parent.line_items,
      notes: parent.notes,
      status: "draft",
      invoice_kind: "production",
      deposit_percent: remainingPct,
      parent_invoice_id: parentInvoiceId,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { success: false, error: insertErr?.message ?? "Failed to create balance invoice" };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/portal/${parent.client_id}`);
  return { success: true, newInvoiceId: inserted.id };
}

export async function forkProductsToRound(
  productIds: string[],
  projectId: string,
): Promise<void> {
  if (productIds.length === 0) return;

  const { data: originals } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (!originals?.length) return;

  const clones = originals.map((p: any) => ({
    project_id: p.project_id,
    name: p.name,
    category: p.category,
    stage: "sampling",
    factory_id: p.factory_id,
    target_cost_usd: p.target_cost_usd,
    quoted_cost_usd: p.quoted_cost_usd,
    quoted_cost_currency: p.quoted_cost_currency,
    quoted_cost_local: p.quoted_cost_local,
    client_unit_price_usd: p.client_unit_price_usd,
    moq: p.moq,
    order_qty: p.order_qty,
    lead_time_days: p.lead_time_days,
    sample_lead_time_days: p.sample_lead_time_days,
    colorways: p.colorways,
    bom_data: p.bom_data,
    notes: p.notes,
    // reset per-round sampling fields
    sample_fee_usd: null,
    sample_cost_usd: null,
    expected_sample_date: null,
    // lineage
    sample_round: (p.sample_round ?? 1) + 1,
    parent_product_id: p.id,
  }));

  await supabase.from("products").insert(clones);
  revalidatePath(`/projects/${projectId}`);
}
