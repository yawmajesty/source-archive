// ─────────────────────────────────────────────────────────────
// Outbound email.
//
// Two rules govern everything here:
//
//   1. Sending must never break the thing that triggered it. A client
//      submitting a brief cares that the brief was saved; if the
//      confirmation email fails, that is our problem, not theirs, and
//      it must not surface as a failed submission.
//
//   2. Every message is written to the log first, whether or not it can
//      actually go out. Before the provider is configured, that means a
//      row saying "skipped — email is not configured yet", which tells
//      you exactly what to fix. Silence would not.
//
// Uses Resend over plain fetch rather than an SDK: one HTTP call, no
// dependency, and swapping providers later is a change to one function.
// ─────────────────────────────────────────────────────────────

import { clerkClient } from "@clerk/nextjs/server";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";

export type EmailTemplate =
  | "brief_received_client"
  | "brief_received_admin"
  | "enquiry_received_client"
  | "enquiry_received_admin"
  | "techpack_received_client"
  | "techpack_received_admin"
  | "stage_update_client"
  | "crm_message";

export interface OutboundEmail {
  agencyId: string;
  to: string;
  toName?: string | null;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplate;
  relatedType?: "lead" | "product" | "client" | null;
  relatedId?: string | null;
}

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  id: string | null;
  error?: string;
}

/** Cheap sanity check. Not RFC-complete on purpose — it exists to stop
 *  obviously-broken addresses reaching the provider and costing a bounce. */
export function looksLikeEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  return v.length > 4 && v.length < 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function config() {
  return {
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
}

export function emailIsConfigured(): boolean {
  const { key, from } = config();
  return Boolean(key && from);
}

/**
 * Record and attempt one email.
 *
 * Always resolves — never throws — so callers can fire it without a
 * try/catch and without their own success depending on it.
 */
export async function sendEmail(message: OutboundEmail): Promise<SendResult> {
  const supabase = getAgencyServiceSupabase();

  if (!looksLikeEmail(message.to)) {
    return { status: "skipped", id: null, error: "No usable address" };
  }

  // Log first. If the process dies mid-send we would rather have a row
  // saying "queued" than no evidence the email was ever attempted.
  let rowId: string | null = null;
  try {
    const { data } = await supabase
      .from("email_messages")
      .insert({
        agency_id: message.agencyId,
        to_email: message.to.trim(),
        to_name: message.toName ?? null,
        reply_to: message.replyTo ?? null,
        subject: message.subject,
        body_html: message.html,
        body_text: message.text,
        template: message.template,
        related_type: message.relatedType ?? null,
        related_id: message.relatedId ?? null,
        status: "queued",
      })
      .select("id")
      .single();
    rowId = (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    // A log we cannot write is not a reason to withhold the email.
    console.error("[email] could not write the log row:", err);
  }

  const { key, from } = config();
  if (!key || !from) {
    await finish(rowId, "skipped", null, "Email is not configured yet — add RESEND_API_KEY and EMAIL_FROM.");
    return { status: "skipped", id: rowId, error: "Email is not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to.trim()],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500);
      await finish(rowId, "failed", null, `${res.status}: ${detail}`);
      return { status: "failed", id: rowId, error: detail };
    }

    const body = (await res.json()) as { id?: string };
    await finish(rowId, "sent", body.id ?? null, null);
    return { status: "sent", id: rowId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await finish(rowId, "failed", null, detail.slice(0, 500));
    return { status: "failed", id: rowId, error: detail };
  }
}

async function finish(
  rowId: string | null,
  status: "sent" | "failed" | "skipped",
  providerId: string | null,
  error: string | null,
) {
  if (!rowId) return;
  try {
    await getAgencyServiceSupabase()
      .from("email_messages")
      .update({
        status,
        provider_id: providerId,
        error,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", rowId);
  } catch (err) {
    console.error("[email] could not update the log row:", err);
  }
}

/**
 * Send several at once without letting one failure take the others down.
 * Used wherever both the client and the agency need telling.
 */
export async function sendAll(messages: OutboundEmail[]): Promise<SendResult[]> {
  return Promise.all(messages.map((m) => sendEmail(m)));
}

/**
 * Who on our side hears about a new enquiry.
 *
 * Falls back to the agency's admins when no notification address is set,
 * so a brief never lands silently just because a setting was skipped.
 */
export async function agencyNotificationRecipients(agencyId: string): Promise<string[]> {
  const supabase = getAgencyServiceSupabase();

  const { data: settings } = await supabase
    .from("agency_settings")
    .select("notification_email")
    .eq("agency_id", agencyId)
    .maybeSingle();

  const configured = (settings as { notification_email: string | null } | null)?.notification_email;
  if (looksLikeEmail(configured)) return [configured.trim()];

  // agency_members stores Clerk user ids, not addresses — the team page
  // resolves them the same way. Worth the round trip: without it a brief
  // would land silently whenever the setting hasn't been filled in.
  const { data: admins } = await supabase
    .from("agency_members")
    .select("user_id")
    .eq("agency_id", agencyId)
    .eq("role", "admin");

  const ids = (admins ?? []).map((a) => (a as { user_id: string }).user_id).filter(Boolean);
  if (ids.length === 0) return [];

  const found: string[] = [];
  try {
    const clerk = await clerkClient();
    for (const id of ids.slice(0, 10)) {
      try {
        const user = await clerk.users.getUser(id);
        const address = user.emailAddresses[0]?.emailAddress;
        if (looksLikeEmail(address)) found.push(address.trim());
      } catch {
        // A member deleted in Clerk but still in the table. Skip them.
      }
    }
  } catch (err) {
    console.error("[email] could not resolve admin addresses:", err);
  }

  return Array.from(new Set(found));
}

/**
 * Everyone on the client's side who should hear about their own work:
 * the main contact plus anyone with a portal login, deduplicated.
 */
export async function clientRecipients(
  clientId: string,
): Promise<{ emails: string[]; clientName: string; enabled: boolean }> {
  const supabase = getAgencyServiceSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("name, contact_email, email_updates_enabled")
    .eq("id", clientId)
    .maybeSingle();

  const c = client as
    | { name: string; contact_email: string | null; email_updates_enabled: boolean | null }
    | null;
  if (!c) return { emails: [], clientName: "", enabled: false };

  const { data: members } = await supabase
    .from("client_members")
    .select("email")
    .eq("client_id", clientId);

  const all = [c.contact_email, ...(members ?? []).map((m) => (m as { email: string | null }).email)]
    .filter(looksLikeEmail)
    .map((e) => e.trim().toLowerCase());

  return {
    emails: Array.from(new Set(all)),
    clientName: c.name,
    // Defaults to on: a client added before the column existed still hears.
    enabled: c.email_updates_enabled !== false,
  };
}
