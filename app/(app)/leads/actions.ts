"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";
import type { BriefProduct } from "@/lib/mock-data";

export async function updateLeadStatus(leadId: string, status: string) {
  await supabase.from("leads").update({ status }).eq("id", leadId);
  revalidatePath("/leads");
}

export async function convertLeadToClient(leadId: string): Promise<{ clientId: string }> {
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
