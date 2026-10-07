"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { sendAll, agencyNotificationRecipients } from "@/lib/email/send";
import { briefReceivedClient, briefReceivedAdmin } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
import { bookingUrl } from "@/lib/booking";
import type { BriefProduct } from "@/lib/mock-data";

interface BriefPayload {
  company_name: string;
  website: string | null;
  contact_name: string;
  contact_email: string;
  phone: string | null;
  country: string | null;
  industry: string | null;
  brand_stage: string | null;
  manufactured_before: boolean | null;
  how_found_us: string | null;
  estimated_budget: string | null;
  timeline: string | null;
  moodboard_links: string | null;
  brief_files: string[];
  sustainability_requirements: string | null;
  message: string | null;
  brief_products: BriefProduct[];
}

// Public brief form — the submitter has no Clerk auth. For now every
// lead lands in the Source Archive agency; per-agency public forms are
// a future enhancement (would need agency-scoped URLs).
const OWNER_AGENCY_ID = "ag-source-archive";

export async function submitBrief(payload: BriefPayload) {
  const supabase = getAgencyServiceSupabase();
  const productSummary = payload.brief_products.map((p) => p.name).join(", ");

  const { data: lead } = await supabase.from("leads").insert({
    agency_id: OWNER_AGENCY_ID,
    company_name: payload.company_name,
    contact_name: payload.contact_name,
    contact_email: payload.contact_email,
    country: payload.country,
    industry: payload.industry,
    product_interest: productSummary,
    estimated_budget: payload.estimated_budget,
    message: payload.message,
    status: "new",
    source: "brief_form",
    website: payload.website,
    phone: payload.phone,
    brand_stage: payload.brand_stage,
    manufactured_before: payload.manufactured_before,
    how_found_us: payload.how_found_us,
    timeline: payload.timeline,
    moodboard_links: payload.moodboard_links,
    brief_files: payload.brief_files,
    sustainability_requirements: payload.sustainability_requirements,
    brief_products: payload.brief_products,
  }).select("id").maybeSingle();

  // Notifications, after the lead is safely stored. sendEmail never throws
  // and never rejects, so a mail outage cannot turn a captured lead into a
  // failed submission for the person who filled the form in.
  const leadsUrl = buildPublicUrl("/leads");
  const admins = await agencyNotificationRecipients(OWNER_AGENCY_ID);
  const leadId = (lead as { id: string } | null)?.id ?? null;

  const confirmation = briefReceivedClient({
    contactName: payload.contact_name,
    companyName: payload.company_name,
    productSummary: productSummary || null,
  });
  // Everything the form collected goes in the alert, so it can be forwarded
  // to whoever is quoting it without them needing a login.
  const alert = briefReceivedAdmin({
    companyName: payload.company_name,
    contactName: payload.contact_name,
    contactEmail: payload.contact_email,
    phone: payload.phone,
    website: payload.website,
    country: payload.country,
    industry: payload.industry,
    brandStage: payload.brand_stage,
    manufacturedBefore: payload.manufactured_before,
    howFoundUs: payload.how_found_us,
    budget: payload.estimated_budget,
    timeline: payload.timeline,
    message: payload.message,
    moodboardLinks: payload.moodboard_links,
    sustainability: payload.sustainability_requirements,
    briefFiles: payload.brief_files,
    products: payload.brief_products,
    leadsUrl,
    bookingUrl: bookingUrl(),
  });

  await sendAll([
    {
      agencyId: OWNER_AGENCY_ID,
      to: payload.contact_email,
      toName: payload.contact_name,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
      template: "brief_received_client" as const,
      relatedType: "lead" as const,
      relatedId: leadId,
    },
    ...admins.map((to) => ({
      agencyId: OWNER_AGENCY_ID,
      to,
      // Replying to the alert reaches the brand, not us.
      replyTo: payload.contact_email,
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
      template: "brief_received_admin" as const,
      relatedType: "lead" as const,
      relatedId: leadId,
    })),
  ]);
}

/**
 * A brand sending back a brief they were asked to expand.
 *
 * Updates the lead in place rather than creating a second one. Two records
 * for one enquiry is how a lead gets answered twice and chased twice.
 *
 * The token in the URL is the whole credential, so it is matched exactly and
 * nothing else is trusted from the caller — not the lead id, not the agency.
 * A wrong or stale token simply finds no row.
 */
export async function reviseBrief(
  token: string,
  payload: BriefPayload,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = getAgencyServiceSupabase();

  const { data: existing } = await supabase
    .from("leads")
    .select("id, agency_id, status, revision_count, company_name")
    .eq("edit_token", token)
    .maybeSingle();

  const lead = existing as {
    id: string; agency_id: string; status: string;
    revision_count: number | null; company_name: string | null;
  } | null;
  if (!lead) return { success: false, error: "This link is no longer valid — ask us for a new one." };

  const productSummary = payload.brief_products.map((p) => p.name).join(", ");

  const { error } = await supabase
    .from("leads")
    .update({
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      country: payload.country,
      industry: payload.industry,
      product_interest: productSummary,
      estimated_budget: payload.estimated_budget,
      message: payload.message,
      website: payload.website,
      phone: payload.phone,
      brand_stage: payload.brand_stage,
      manufactured_before: payload.manufactured_before,
      how_found_us: payload.how_found_us,
      timeline: payload.timeline,
      moodboard_links: payload.moodboard_links,
      brief_files: payload.brief_files,
      sustainability_requirements: payload.sustainability_requirements,
      brief_products: payload.brief_products,
      revised_at: new Date().toISOString(),
      revision_count: (lead.revision_count ?? 0) + 1,
      // Back to us. A lead sitting at "contacted" after they have answered
      // is a lead nobody picks up.
      status: lead.status === "converted" ? lead.status : "new",
    })
    .eq("id", lead.id);

  if (error) return { success: false, error: error.message };

  // Tell our side, because the whole point was that we asked for this.
  const { notifyAgency } = await import("@/lib/email/portal-notify");
  await notifyAgency({
    agencyId: lead.agency_id,
    headline: `Brief updated — ${payload.company_name}`,
    who: payload.contact_name || payload.company_name,
    quote:
      `${payload.brief_products.length} product${payload.brief_products.length === 1 ? "" : "s"}` +
      `${productSummary ? `: ${productSummary}` : ""}` +
      `${payload.message ? `\n\n${payload.message}` : ""}`,
    url: buildPublicUrl("/leads"),
    linkLabel: "Open in Leads",
    relatedType: "lead",
    relatedId: lead.id,
  });

  return { success: true };
}
