"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// What has happened to this lead.
//
// Every reply already writes a row to the email log with the lead's id on
// it — 185 of them at the time of writing — so the trail was already
// recorded and simply never shown. Nobody could see who had been contacted
// without opening the Emails page and reading addresses.
//
// Booking a call is the one event with no email behind it, because it
// happens in a calendar rather than here. That one gets its own mark.
// ─────────────────────────────────────────────────────────────

const SETUP = "This needs a one-time database step — run migrations/043_lead_call_booked.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST204" || error.code === "42703" || /call_booked_at/.test(error.message);
}

export interface TrailEvent {
  at: string;
  label: string;
  detail: string | null;
  kind: "intake" | "sent" | "revised" | "call" | "status";
}

/** Friendly names for the templates that appear against a lead. */
const TEMPLATE_LABEL: Record<string, string> = {
  brief_received_client: "Brief confirmation sent to them",
  brief_received_admin: "Brief alert to us",
  enquiry_received_client: "Enquiry confirmation sent to them",
  enquiry_received_admin: "Enquiry alert to us",
  techpack_received_client: "Tech pack confirmation sent to them",
  techpack_received_admin: "Tech pack alert to us",
  lead_acknowledged: "Thank-you sent",
  lead_more_info: "Asked them for more detail",
  lead_book_call: "Call invitation sent",
  lead_declined: "Declined",
  agency_alert: "Alert to us",
  crm_message: "Written from the CRM",
};

export async function getLeadTrail(leadId: string): Promise<TrailEvent[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];

  const supabase = await getAgencySupabase();

  const [leadRes, mailRes] = await Promise.all([
    supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
    supabase
      .from("email_messages")
      .select("template, status, created_at, to_email, subject")
      .eq("related_type", "lead")
      .eq("related_id", leadId)
      .order("created_at"),
  ]);

  const lead = leadRes.data as Record<string, unknown> | null;
  if (!lead) return [];

  const events: TrailEvent[] = [];
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

  const created = str(lead.created_at);
  if (created) {
    events.push({
      at: created,
      kind: "intake",
      label: lead.source === "brief_form" ? "Brief submitted" : "Enquiry submitted",
      detail: str(lead.company_name),
    });
  }

  for (const row of (mailRes.data ?? []) as Array<Record<string, unknown>>) {
    const template = String(row.template ?? "");
    const state = String(row.status ?? "");
    events.push({
      at: String(row.created_at),
      kind: "sent",
      label: TEMPLATE_LABEL[template] ?? template.replace(/_/g, " "),
      detail:
        state === "sent"
          ? str(row.to_email)
          : `${state} — ${str(row.to_email) ?? "no address"}`,
    });
  }

  const revised = str(lead.revised_at);
  if (revised) {
    const count = typeof lead.revision_count === "number" ? lead.revision_count : 1;
    events.push({
      at: revised,
      kind: "revised",
      label: "They updated their brief",
      detail: count > 1 ? `${count} revisions in total` : null,
    });
  }

  const booked = str(lead.call_booked_at);
  if (booked) events.push({ at: booked, kind: "call", label: "Booked a call", detail: null });

  return events.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Mark that a call is in the diary, or take the mark off.
 *
 * Does not touch status. Which stage of the pipeline they are at is a
 * judgement; whether a call exists is a fact, and conflating the two is how
 * you end up unable to answer either question.
 */
export async function setLeadCallBooked(
  leadId: string,
  booked: boolean,
): Promise<{ success: true; booked: boolean } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to change leads" };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("leads")
    .update({ call_booked_at: booked ? new Date().toISOString() : null })
    .eq("id", leadId);

  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true, booked };
}
