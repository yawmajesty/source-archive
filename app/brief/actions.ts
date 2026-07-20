"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
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

  await supabase.from("leads").insert({
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
  });
}
