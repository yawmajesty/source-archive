"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { emailIsConfigured } from "@/lib/email/send";

export interface EmailRow {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_html: string;
  body_text: string;
  template: string;
  related_type: string | null;
  related_id: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export async function listEmails(limit = 200): Promise<{
  rows: EmailRow[];
  configured: boolean;
  counts: Record<string, number>;
}> {
  const ctx = await getAgencyContext();
  if (!ctx || ctx.role !== "admin") return { rows: [], configured: emailIsConfigured(), counts: {} };

  // Service role rather than the user's client: RLS already restricts this
  // table to admins, and we've just checked that. Going through the service
  // client keeps the page working even if the Clerk JWT template is
  // misconfigured, which is exactly when you need to read the log.
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("email_messages")
    .select("*")
    .eq("agency_id", ctx.agency.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as EmailRow[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  return { rows, configured: emailIsConfigured(), counts };
}

/** Set where "a brief just came in" lands. */
export async function setNotificationEmail(
  email: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (ctx.role !== "admin") return { success: false, error: "Only admins can change this" };

  const trimmed = email.trim();
  if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { success: false, error: "That doesn't look like an email address" };
  }

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("agency_settings")
    .upsert(
      { agency_id: ctx.agency.id, notification_email: trimmed || null, updated_at: new Date().toISOString() },
      { onConflict: "agency_id" },
    );

  if (error) return { success: false, error: error.message };
  revalidatePath("/emails");
  return { success: true };
}

export async function getNotificationEmail(): Promise<string> {
  const ctx = await getAgencyContext();
  if (!ctx) return "";
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("agency_settings")
    .select("notification_email")
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  return (data as { notification_email: string | null } | null)?.notification_email ?? "";
}

/**
 * Clients who can't be emailed.
 *
 * A stage change for one of these notifies nobody and leaves no trace —
 * there is no address to write a log row against. Surfacing them on the
 * page that shows what was sent is the only place the absence is
 * noticeable before someone asks why they never heard anything.
 */
export async function clientsMissingEmail(): Promise<Array<{ id: string; name: string }>> {
  const ctx = await getAgencyContext();
  if (!ctx || ctx.role !== "admin") return [];

  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("clients")
    .select("id, name, contact_email, status")
    .eq("agency_id", ctx.agency.id);

  return ((data ?? []) as Array<{ id: string; name: string; contact_email: string | null; status: string | null }>)
    // An inactive client isn't expected to be hearing from us.
    .filter((c) => c.status !== "inactive" && !c.contact_email?.trim())
    .map((c) => ({ id: c.id, name: c.name }));
}
