"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { sendAll, looksLikeEmail } from "@/lib/email/send";
import { enquiryAcknowledged, moreInfoNeeded, replyWindowFor } from "@/lib/email/templates";
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
 * Send the "we've got it, here's when we'll reply" note.
 *
 * The one email that should never be late. Someone who fills in a brief
 * and hears nothing for two days assumes it went nowhere, and by the
 * time a real reply arrives they have already asked someone else.
 *
 * Marks the lead contacted in the same step, because an acknowledgement
 * that doesn't move the lead out of "new" just means it gets sent twice.
 */
export async function acknowledgeLead(
  leadId: string,
): Promise<{ success: true; status: string; to: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to contact leads" };
  }

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("leads")
    .select("id, company_name, contact_name, contact_email, source, status")
    .eq("id", leadId)
    .maybeSingle();

  const lead = data as {
    id: string; company_name: string | null; contact_name: string | null;
    contact_email: string | null; source: string | null; status: string;
  } | null;
  if (!lead) return { success: false, error: "Lead not found" };
  if (!looksLikeEmail(lead.contact_email)) {
    return { success: false, error: "No usable email address on this lead" };
  }

  const built = enquiryAcknowledged({
    contactName: lead.contact_name ?? "",
    companyName: lead.company_name,
    isBrief: lead.source === "brief_form",
    window: replyWindowFor(),
  });

  const [result] = await sendAll([
    {
      agencyId: ctx.agency.id,
      to: lead.contact_email,
      toName: lead.contact_name,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "lead_acknowledged" as const,
      relatedType: "lead" as const,
      relatedId: lead.id,
    },
  ]);

  if (result.status === "failed") {
    return { success: false, error: result.error ?? "Could not send" };
  }

  // Only advance a lead that's still untouched — re-acknowledging a
  // qualified one shouldn't drag it backwards down the pipeline.
  if (lead.status === "new") {
    await supabase.from("leads").update({ status: "contacted" }).eq("id", leadId);
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true, status: result.status, to: lead.contact_email as string };
}

/**
 * Ask a thin lead for enough to make a call worth having.
 *
 * Separate from the thank-you rather than a variant of it: they answer
 * different situations, and one that tried to do both would end up saying
 * "thanks, now do some homework", which reads badly.
 *
 * Moves the lead to contacted for the same reason the acknowledgement
 * does — a reply that leaves it sitting in "new" gets sent twice.
 */
export async function requestMoreInfo(
  leadId: string,
): Promise<{ success: true; to: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to contact leads" };
  }

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("leads")
    .select("id, company_name, contact_name, contact_email, source, status")
    .eq("id", leadId)
    .maybeSingle();

  const lead = data as {
    id: string; company_name: string | null; contact_name: string | null;
    contact_email: string | null; source: string | null; status: string;
  } | null;
  if (!lead) return { success: false, error: "Lead not found" };
  if (!looksLikeEmail(lead.contact_email)) {
    return { success: false, error: "No usable email address on this lead" };
  }

  const built = moreInfoNeeded({
    contactName: lead.contact_name ?? "",
    companyName: lead.company_name,
    isBrief: lead.source === "brief_form",
  });

  const [result] = await sendAll([
    {
      agencyId: ctx.agency.id,
      to: lead.contact_email,
      toName: lead.contact_name,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "lead_more_info" as const,
      relatedType: "lead" as const,
      relatedId: lead.id,
    },
  ]);

  if (result.status === "failed") {
    return { success: false, error: result.error ?? "Could not send" };
  }

  if (lead.status === "new") {
    await supabase.from("leads").update({ status: "contacted" }).eq("id", leadId);
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  return { success: true, to: lead.contact_email as string };
}
