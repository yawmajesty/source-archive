"use server";

import { supabaseData } from "@/lib/supabase-data";
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

export async function submitBrief(payload: BriefPayload) {
  const productSummary = payload.brief_products.map((p) => p.name).join(", ");

  await supabaseData.from("leads").insert({
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
    // Extended fields
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
  });
}
