"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll, clientRecipients } from "@/lib/email/send";
import { esc } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
import { sumInvoice } from "@/lib/invoice-total";

export interface InvoiceRow {
  id: string;
  client_id: string;
  client_name: string;
  round: number | null;
  title: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  invoice_kind: string | null;
  line_items: Array<Record<string, unknown>>;
  total: number;
  ageDays: number;
}

/**
 * Every invoice, newest first, with its total worked out.
 *
 * Totals aren't stored — they're the sum of the line items — so anything
 * that shows an amount has to compute it the same way. That sum lives in
 * one place precisely so the dashboard and this page can't disagree
 * about how much a client owes.
 */
export async function listInvoices(): Promise<InvoiceRow[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  // Money is admin territory. A workshop maker has no business seeing
  // what a client has or hasn't paid.
  if (!can(ctx.role, ctx.permissions, "cost.view")) return [];

  const supabase = await getAgencySupabase();
  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase.from("sampling_invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
  ]);

  const names = new Map(((clients ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));
  const now = Date.now();

  return ((invoices ?? []) as Array<Record<string, unknown>>).map((inv) => {
    const items = Array.isArray(inv.line_items) ? (inv.line_items as Array<Record<string, unknown>>) : [];
    return {
      id: String(inv.id),
      client_id: String(inv.client_id),
      client_name: names.get(String(inv.client_id)) ?? "Unknown client",
      round: (inv.round as number) ?? null,
      title: (inv.title as string) ?? null,
      status: String(inv.status ?? "draft"),
      created_at: String(inv.created_at),
      paid_at: (inv.paid_at as string) ?? null,
      invoice_kind: (inv.invoice_kind as string) ?? null,
      line_items: items,
      total: sumInvoice(items),
      ageDays: Math.floor((now - new Date(String(inv.created_at)).getTime()) / 86_400_000),
    };
  });
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: "draft" | "sent" | "paid",
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "cost.view")) {
    return { success: false, error: "You don't have permission to change invoices" };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("sampling_invoices")
    .update({
      status,
      // Clearing paid_at on un-paying matters: a stale timestamp on an
      // unpaid invoice is worse than none, because it reads as evidence.
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", invoiceId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Nudge the client about an unpaid invoice. */
export async function chaseInvoice(
  invoiceId: string,
): Promise<{ success: true; status: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "cost.view")) {
    return { success: false, error: "You don't have permission" };
  }

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("sampling_invoices").select("*").eq("id", invoiceId).maybeSingle();
  const inv = data as Record<string, unknown> | null;
  if (!inv) return { success: false, error: "Invoice not found" };

  const clientId = String(inv.client_id);
  const total = sumInvoice(Array.isArray(inv.line_items) ? (inv.line_items as Array<Record<string, unknown>>) : []);
  const label = (inv.title as string) || `Invoice · round ${inv.round ?? 1}`;

  const { emails, enabled } = await clientRecipients(clientId);
  if (!enabled || emails.length === 0) {
    return { success: false, error: "No contact address on file for this client" };
  }

  const url = buildPublicUrl(`/portal/${clientId}`);
  const results = await sendAll(
    emails.map((to) => ({
      agencyId: ctx.agency.id,
      to,
      subject: `${label} — still outstanding`,
      html:
        `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;">` +
        `<h1 style="font-size:19px;margin:0 0 12px;">${esc(label)}</h1>` +
        `<p style="font-size:14px;color:#6E6E73;line-height:1.6;margin:0 0 12px;">` +
        `A quick note that this one is still outstanding — $${total.toFixed(2)}. ` +
        `You can settle it from your portal, and just reply here if anything looks wrong.</p>` +
        `<p style="margin-top:16px;"><a href="${esc(url)}" style="background:#0058B0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Open the invoice</a></p>` +
        `</div>`,
      text: `${label} — still outstanding\n\nA quick note that this one is still outstanding: $${total.toFixed(2)}. You can settle it from your portal, and just reply here if anything looks wrong.\n\n${url}`,
      template: "crm_message" as const,
      relatedType: "client" as const,
      relatedId: clientId,
    })),
  );

  revalidatePath("/invoices");
  return { success: true, status: results[0]?.status ?? "sent" };
}
