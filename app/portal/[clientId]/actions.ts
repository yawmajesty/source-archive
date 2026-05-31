"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
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
