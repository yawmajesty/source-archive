"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll, clientRecipients } from "@/lib/email/send";
import { priceChanged } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
import {
  CLIENT_PRICE_FIELDS, PRICE_FIELD_CLIENT_LABEL, isClientPriceField,
  type ClientPriceField, type PriceChangeLine, type PriceNoticeTarget,
} from "@/lib/price-notify";

// ─────────────────────────────────────────────────────────────
// Telling a client their price has moved.
//
// A price change they discover on the invoice is the fastest way to lose
// a client, and the portal showing the new number is not the same as
// being told. So the moment a client-facing price is saved, we offer to
// say so — and it is an offer, not an automatic send: correcting a typo
// a minute after making it is not news, and only the person who made the
// change knows which kind it was.
//
// The email is built from the database, never from what the browser
// claims changed. The browser says *which* fields moved; the server
// reads what they moved from and to. A figure in an email to a client
// has to be the figure in the system.
// ─────────────────────────────────────────────────────────────

// ── Formatting ───────────────────────────────────────────────

function money(value: unknown, currency: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not set";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(2)}`;
}

function volumeTiers(value: unknown, currency: string): string {
  if (!Array.isArray(value) || value.length === 0) return "none set";
  return value
    .map((t) => t as { moq?: number; unit_price_usd?: number })
    .filter((t) => typeof t.moq === "number" && typeof t.unit_price_usd === "number")
    .sort((a, b) => (a.moq ?? 0) - (b.moq ?? 0))
    .map((t) => `${(t.moq ?? 0).toLocaleString()}+ at ${money(t.unit_price_usd, currency)}`)
    .join(", ") || "none set";
}

function compositionTiers(value: unknown, currency: string): string {
  if (!Array.isArray(value) || value.length === 0) return "none set";
  return value
    .map((t) => t as { label?: string; unit_price_usd?: number })
    .filter((t) => t.label && typeof t.unit_price_usd === "number")
    .map((t) => `${t.label} at ${money(t.unit_price_usd, currency)}`)
    .join(", ") || "none set";
}

function format(field: ClientPriceField, value: unknown, currency: string): string {
  if (field === "price_tiers") return volumeTiers(value, currency);
  if (field === "composition_tiers") return compositionTiers(value, currency);
  return money(value, currency);
}

// ── Reading what actually changed ────────────────────────────

/**
 * What the email would say, and who it would go to.
 *
 * Called when the prompt opens rather than when it is answered, so the
 * person sees the real figures and the real addresses before deciding.
 */
export async function getPriceNoticeTarget(
  productId: string,
  fields: string[],
): Promise<PriceNoticeTarget> {
  const empty: PriceNoticeTarget = {
    canSend: false, reason: "Not allowed", clientId: null, clientName: null,
    recipients: [], productName: "", changes: [],
  };

  const ctx = await getAgencyContext();
  if (!ctx) return empty;
  if (!can(ctx.role, ctx.permissions, "product.edit")) return empty;

  const wanted = Array.from(new Set(fields.filter(isClientPriceField)));
  if (wanted.length === 0) return { ...empty, reason: "Nothing the client can see has changed" };

  const supabase = getAgencyServiceSupabase();

  const { data: productRow } = await supabase
    .from("products")
    .select("id, name, project_id, quoted_cost_currency, " + CLIENT_PRICE_FIELDS.join(", "))
    .eq("id", productId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  const product = productRow as Record<string, unknown> | null;
  if (!product) return { ...empty, reason: "Product not found" };

  const currency = String(product.quoted_cost_currency ?? "USD");
  const productName = String(product.name ?? "This style");

  // The trigger on products writes every price move here, so the "before"
  // is read rather than remembered. A field with no entry is a first
  // value, which still deserves an email — it just has nothing to be
  // compared against.
  const { data: historyRows } = await supabase
    .from("product_price_history")
    .select("field_name, old_value, changed_at")
    .eq("product_id", productId)
    .in("field_name", wanted)
    .order("changed_at", { ascending: false })
    .limit(50);

  const before = new Map<string, unknown>();
  for (const row of (historyRows ?? []) as Array<{ field_name: string; old_value: unknown }>) {
    if (!before.has(row.field_name)) before.set(row.field_name, row.old_value);
  }

  const changes: PriceChangeLine[] = wanted.map((field) => ({
    label: PRICE_FIELD_CLIENT_LABEL[field],
    before: before.has(field) ? format(field, before.get(field), currency) : "not set",
    after: format(field, product[field], currency),
  }))
    // A "change" to the same figure is noise in somebody's inbox.
    .filter((c) => c.before !== c.after);

  if (changes.length === 0) {
    return { ...empty, productName, reason: "The figures ended up the same" };
  }

  const projectId = product.project_id ? String(product.project_id) : null;
  let clientId: string | null = null;
  if (projectId) {
    const { data: project } = await supabase
      .from("projects").select("client_id").eq("id", projectId).maybeSingle();
    clientId = (project as { client_id: string | null } | null)?.client_id ?? null;
  }
  if (!clientId) {
    return { ...empty, productName, changes, reason: "This product isn't attached to a client yet" };
  }

  const { emails, clientName, enabled } = await clientRecipients(clientId);
  if (!enabled) {
    return { ...empty, productName, changes, clientId, clientName, reason: `${clientName} has email updates turned off` };
  }
  if (emails.length === 0) {
    return { ...empty, productName, changes, clientId, clientName, reason: `No email address on file for ${clientName}` };
  }

  return {
    canSend: true, reason: null, clientId, clientName,
    recipients: emails, productName, changes,
  };
}

/** Send it. Re-reads everything: the prompt's figures are for the human. */
export async function notifyClientOfPriceChange(input: {
  productId: string;
  fields: string[];
  note?: string | null;
}): Promise<{ success: true; sent: number } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to email this client" };
  }

  const target = await getPriceNoticeTarget(input.productId, input.fields);
  if (!target.canSend || !target.clientId) {
    return { success: false, error: target.reason ?? "There's nobody to send this to" };
  }

  const built = priceChanged({
    productName: target.productName,
    clientName: target.clientName ?? "",
    changes: target.changes,
    note: input.note?.trim()?.slice(0, 1000) || null,
    portalUrl: buildPublicUrl(`/portal/${target.clientId}`),
  });

  const results = await sendAll(
    target.recipients.map((to) => ({
      agencyId: ctx.agency.id,
      to,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "price_changed_client" as const,
      relatedType: "product" as const,
      relatedId: input.productId,
    })),
  );

  const sent = results.filter((r) => r.status === "sent").length;
  if (sent === 0) {
    const why = results.find((r) => r.error)?.error;
    return { success: false, error: why ?? "The email didn't go out" };
  }
  return { success: true, sent };
}
