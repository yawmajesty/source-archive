"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll, clientRecipients, looksLikeEmail } from "@/lib/email/send";
import { esc, invoiceChaseDraft, leadReply, type Draft } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
import { sumInvoice, money } from "@/lib/invoice-total";
import { ageOf } from "@/lib/command-centre";

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
  client_inactive: boolean;
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
    supabase.from("clients").select("id, name, status"),
  ]);

  const clientRows = (clients ?? []) as Array<{ id: string; name: string; status: string | null }>;
  const names = new Map(clientRows.map((c) => [c.id, c.name]));
  const inactive = new Set(clientRows.filter((c) => c.status === "inactive").map((c) => c.id));
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
      client_inactive: inactive.has(String(inv.client_id)),
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
export async function archiveClient(clientId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to change clients" };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("clients").update({ status: "inactive" }).eq("id", clientId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return { success: true };
}

/**
 * Build the chase for an unpaid invoice.
 *
 * Chasing is a judgement call, which is why nothing here sends on its own:
 * a client who said they would pay on Friday should not be reminded on
 * Wednesday, and no schedule can know that. The digest gives you the list
 * and a link; a person decides.
 */
export async function draftInvoiceChase(
  invoiceId: string,
): Promise<{ success: true; to: string; draft: Draft } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("sampling_invoices")
    .select("id, client_id, title, round, invoice_kind, line_items, deposit_percent, status, created_at")
    .eq("id", invoiceId)
    .maybeSingle();

  const inv = data as {
    client_id: string; title: string | null; round: number | null; invoice_kind: string | null;
    line_items: unknown; deposit_percent: number | null; status: string; created_at: string;
  } | null;
  if (!inv) return { success: false, error: "Invoice not found" };
  if (inv.status === "paid") return { success: false, error: "This invoice is already paid" };

  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, contact_name, contact_email")
    .eq("id", inv.client_id)
    .maybeSingle();
  const client = clientRow as { name: string; contact_name: string | null; contact_email: string | null } | null;
  if (!looksLikeEmail(client?.contact_email)) {
    return { success: false, error: "No usable email address on this client" };
  }

  const total = sumInvoice(inv.line_items);
  const due = total * ((inv.deposit_percent ?? 100) / 100);
  const title =
    inv.title ??
    (inv.invoice_kind === "production"
      ? `Production invoice${inv.round ? ` — Round ${inv.round}` : ""}`
      : `Round ${inv.round ?? 1} sampling`);

  return {
    success: true,
    to: client!.contact_email as string,
    draft: invoiceChaseDraft({
      contactName: client?.contact_name ?? "",
      clientName: client?.name ?? "",
      invoiceTitle: title,
      amount: money(due),
      age: ageOf(inv.created_at),
      portalUrl: buildPublicUrl(`/portal/${inv.client_id}`),
    }),
  };
}

/** Send the chase as edited. */
export async function sendInvoiceChase(input: {
  invoiceId: string;
  subject: string;
  body: string;
}): Promise<{ success: true; to: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) return { success: false, error: "The subject is empty" };
  if (!body) return { success: false, error: "The message is empty" };

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("sampling_invoices")
    .select("client_id, status")
    .eq("id", input.invoiceId)
    .maybeSingle();
  const inv = data as { client_id: string; status: string } | null;
  if (!inv) return { success: false, error: "Invoice not found" };
  if (inv.status === "paid") return { success: false, error: "This invoice is already paid" };

  const { emails, enabled } = await clientRecipients(inv.client_id);
  if (!enabled || emails.length === 0) {
    return { success: false, error: "No usable email address on this client" };
  }

  const built = leadReply({ subject, body });
  const [result] = await sendAll(
    emails.map((to) => ({
      agencyId: ctx.agency.id,
      to,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "invoice_chase" as const,
      relatedType: "client" as const,
      relatedId: inv.client_id,
    })),
  );

  if (result.status === "failed") return { success: false, error: result.error ?? "Could not send" };
  return { success: true, to: emails[0] };
}
