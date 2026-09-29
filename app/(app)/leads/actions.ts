"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { sendAll, looksLikeEmail } from "@/lib/email/send";
import {
  acknowledgeDraft,
  moreInfoDraft,
  leadReply,
  replyWindowFor,
  type Draft,
  type LeadReplyKind,
} from "@/lib/email/templates";
import type { BriefProduct } from "@/lib/mock-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function updateLeadStatus(leadId: string, status: string) {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("leads").update({ status }).eq("id", leadId);
  revalidatePath("/leads");
}

export async function createLead(data: {
  company_name: string;
  contact_name: string;
  contact_email: string;
  phone?: string | null;
  country?: string | null;
  industry?: string | null;
  estimated_budget?: string | null;
  source?: string | null;
  message?: string | null;
}) {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("leads").insert({
    agency_id: ctx.agency.id,
    ...data,
    status: "new",
    brief_products: [],
  });
  revalidatePath("/leads");
}

export async function deleteLead(leadId: string) {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("leads").delete().eq("id", leadId);
  revalidatePath("/leads");
}

export async function convertLeadToClient(leadId: string): Promise<{ clientId: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) throw new Error("Lead not found");

  const ts = Date.now();
  const clientId = `client-${ts}`;
  const projectId = `proj-${ts}`;

  const slug = (lead.company_name as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await supabase.from("clients").insert({
    agency_id: ctx.agency.id,
    id: clientId,
    name: lead.company_name,
    slug,
    country: lead.country ?? null,
    industry: lead.industry ?? null,
    contact_name: lead.contact_name ?? null,
    contact_email: lead.contact_email ?? null,
    logo_initial: (lead.company_name as string)[0].toUpperCase(),
    status: "active",
    portal_enabled: false,
  });

  const projectName = lead.timeline
    ? `${lead.company_name} · ${lead.timeline}`
    : `${lead.company_name} · Initial Collection`;

  await supabase.from("projects").insert({
    agency_id: ctx.agency.id,
    id: projectId,
    client_id: clientId,
    name: projectName,
    season: lead.timeline ?? null,
    status: "active",
    notes: lead.message ?? null,
  });

  const products: BriefProduct[] = (lead.brief_products as BriefProduct[]) ?? [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (!p.name) continue;
    await supabase.from("products").insert({
      agency_id: ctx.agency.id,
      id: `prod-${ts}-${i}`,
      project_id: projectId,
      name: p.name,
      category: p.category || null,
      target_cost_usd: p.target_price_usd ?? null,
      moq: p.target_qty ?? null,
      colorways: p.colorways ? Array.from({ length: p.colorways }, (_, j) => ({ name: `Colourway ${j + 1}` })) : [],
      notes: [p.description, p.sustainability ? `Sustainability: ${p.sustainability}` : null, p.moodboard_link ? `Moodboard: ${p.moodboard_link}` : null].filter(Boolean).join("\n\n") || null,
      stage: "brief",
    });
  }

  await supabase.from("leads").update({ status: "converted" }).eq("id", leadId);
  revalidatePath("/leads");
  revalidatePath("/clients");

  return { clientId };
}

/**
 * Build the draft a quick reply starts from.
 *
 * Done on the server rather than in the browser so both the Leads panel and
 * the dashboard get the same wording from the same place, and so neither
 * has to carry the lead's fields around just to compose a sentence.
 */
export async function draftLeadReply(
  leadId: string,
  kind: LeadReplyKind,
): Promise<{ success: true; to: string; draft: Draft } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to contact leads" };
  }

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("leads")
    .select("id, company_name, contact_name, contact_email, source")
    .eq("id", leadId)
    .maybeSingle();

  const lead = data as {
    company_name: string | null; contact_name: string | null;
    contact_email: string | null; source: string | null;
  } | null;
  if (!lead) return { success: false, error: "Lead not found" };
  if (!looksLikeEmail(lead.contact_email)) {
    return { success: false, error: "No usable email address on this lead" };
  }

  const shared = {
    contactName: lead.contact_name ?? "",
    companyName: lead.company_name,
    isBrief: lead.source === "brief_form",
  };

  const draft =
    kind === "acknowledge"
      ? acknowledgeDraft({ ...shared, window: replyWindowFor() })
      : moreInfoDraft(shared);

  return { success: true, to: lead.contact_email, draft };
}

/** Which log slug each quick reply is filed under. */
const REPLY_TEMPLATE: Record<LeadReplyKind, "lead_acknowledged" | "lead_more_info"> = {
  acknowledge: "lead_acknowledged",
  more_info: "lead_more_info",
};

/**
 * Send a quick reply to a lead, as edited by whoever is sending it.
 *
 * The subject and body arrive from the browser because they have been
 * through a preview the sender could change — that is the point of the
 * feature. They are still escaped when the HTML is built, and the kind is
 * checked against a known set rather than trusted, because it decides what
 * the message is filed as.
 */
export async function sendLeadReply(input: {
  leadId: string;
  kind: LeadReplyKind;
  subject: string;
  body: string;
}): Promise<{ success: true; to: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to contact leads" };
  }

  const template = REPLY_TEMPLATE[input.kind];
  if (!template) return { success: false, error: "Unknown reply type" };

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) return { success: false, error: "The subject is empty" };
  if (!body) return { success: false, error: "The message is empty" };

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("leads")
    .select("id, contact_name, contact_email, status")
    .eq("id", input.leadId)
    .maybeSingle();

  const lead = data as {
    id: string; contact_name: string | null; contact_email: string | null; status: string;
  } | null;
  if (!lead) return { success: false, error: "Lead not found" };
  if (!looksLikeEmail(lead.contact_email)) {
    return { success: false, error: "No usable email address on this lead" };
  }

  const built = leadReply({ subject, body });

  const [result] = await sendAll([
    {
      agencyId: ctx.agency.id,
      to: lead.contact_email,
      toName: lead.contact_name,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template,
      relatedType: "lead" as const,
      relatedId: lead.id,
    },
  ]);

  if (result.status === "failed") {
    return { success: false, error: result.error ?? "Could not send" };
  }

  // Only advance a lead that is still untouched — replying to a qualified
  // one should not drag it backwards down the pipeline.
  if (lead.status === "new") {
    await supabase.from("leads").update({ status: "contacted" }).eq("id", input.leadId);
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true, to: lead.contact_email as string };
}
