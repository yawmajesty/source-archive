"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import type { BriefProduct } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// Where a client came from.
//
// Converting a lead copied its contents into a client, a project and some
// products, and then lost the thread: the brief itself, the files, the
// brand's own words about what they wanted. All of it stayed on a lead
// record nobody opens once it says "converted".
//
// This reads it back, so the client page can show the enquiry alongside the
// work it turned into.
// ─────────────────────────────────────────────────────────────

export interface ClientOrigin {
  leadId: string;
  source: string | null;
  submittedAt: string | null;
  revisedAt: string | null;
  revisionCount: number;
  /** What they told us about themselves at the time. */
  about: Array<[string, string]>;
  message: string | null;
  moodboardLinks: string | null;
  sustainability: string | null;
  files: string[];
  products: BriefProduct[];
}

export async function getClientOrigin(clientId: string): Promise<ClientOrigin | null> {
  const ctx = await getAgencyContext();
  if (!ctx) return null;

  const supabase = await getAgencySupabase();

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("lead_id, contact_email")
    .eq("id", clientId)
    .maybeSingle();
  // lead_id arrives with migration 041; before that there is simply no origin.
  if (clientErr || !clientRow) return null;

  const client = clientRow as { lead_id: string | null; contact_email: string | null };

  // The link when we have it. Failing that, the email — which is how clients
  // converted before the column existed can still find their enquiry.
  let query = supabase
    .from("leads")
    .select(
      "id, source, created_at, revised_at, revision_count, company_name, contact_name, " +
        "contact_email, phone, website, country, industry, brand_stage, manufactured_before, " +
        "how_found_us, estimated_budget, timeline, message, moodboard_links, " +
        "sustainability_requirements, brief_files, brief_products",
    )
    .limit(1);

  if (client.lead_id) query = query.eq("id", client.lead_id);
  else if (client.contact_email) query = query.eq("contact_email", client.contact_email);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  const lead = data as unknown as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

  const about: Array<[string, string]> = [];
  const push = (label: string, value: unknown) => {
    const v = str(value);
    if (v) about.push([label, v]);
  };
  push("Contact", lead.contact_name);
  push("Email", lead.contact_email);
  push("Phone", lead.phone);
  push("Website", lead.website);
  push("Country", lead.country);
  push("Industry", lead.industry);
  push("Brand stage", lead.brand_stage);
  if (lead.manufactured_before != null) {
    about.push(["Manufactured before", lead.manufactured_before ? "Yes" : "No — first time"]);
  }
  push("Budget at enquiry", lead.estimated_budget);
  push("Timeline", lead.timeline);
  push("Found us via", lead.how_found_us);

  return {
    leadId: String(lead.id),
    source: str(lead.source),
    submittedAt: str(lead.created_at),
    revisedAt: str(lead.revised_at),
    revisionCount: typeof lead.revision_count === "number" ? lead.revision_count : 0,
    about,
    message: str(lead.message),
    moodboardLinks: str(lead.moodboard_links),
    sustainability: str(lead.sustainability_requirements),
    files: Array.isArray(lead.brief_files) ? (lead.brief_files as string[]) : [],
    products: Array.isArray(lead.brief_products) ? (lead.brief_products as BriefProduct[]) : [],
  };
}
