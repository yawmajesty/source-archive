import { notFound } from "next/navigation";
import { BriefForm, type BriefRevisit } from "../BriefForm";
import { getAgencySettings } from "@/lib/data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import type { BriefProduct } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// Reopening a brief.
//
// No login: the token in the URL is the credential, the same arrangement
// the factory cost sheet uses. It is matched exactly and nothing else is
// read from the request, so a wrong or expired token simply finds no row
// and gets a 404 — not a hint that the id was nearly right.
//
// Service-role client because there is no user here at all. It reads one
// row, by a token only we have sent.
// ─────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Update your brief — Source[Archive]",
  // Not somewhere a search engine should be sending people.
  robots: { index: false, follow: false },
};

export default async function BriefRevisitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, company_name, website, contact_name, contact_email, phone, country, industry, " +
        "brand_stage, manufactured_before, how_found_us, estimated_budget, timeline, " +
        "moodboard_links, brief_files, sustainability_requirements, message, brief_products",
    )
    .eq("edit_token", token)
    .maybeSingle();

  // A missing column means migration 041 has not been run. That is our
  // problem, not the brand's, so it reads as a dead link rather than a crash.
  if (error || !data) notFound();

  const lead = data as unknown as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  const revisit: BriefRevisit = {
    token,
    brand: {
      company_name: str(lead.company_name),
      website: str(lead.website),
      contact_name: str(lead.contact_name),
      contact_email: str(lead.contact_email),
      phone: str(lead.phone),
      country: str(lead.country),
      industry: str(lead.industry),
      brand_stage: str(lead.brand_stage),
      manufactured_before:
        lead.manufactured_before === true ? "yes" : lead.manufactured_before === false ? "no" : "",
      how_found_us: str(lead.how_found_us),
    },
    products: Array.isArray(lead.brief_products) ? (lead.brief_products as BriefProduct[]) : [],
    refs: {
      estimated_budget: str(lead.estimated_budget),
      timeline: str(lead.timeline),
      moodboard_links: str(lead.moodboard_links),
      moodboard_files: Array.isArray(lead.brief_files) ? (lead.brief_files as string[]) : [],
      sustainability_requirements: str(lead.sustainability_requirements),
      message: str(lead.message),
    },
  };

  const agencySettings = await getAgencySettings();
  return <BriefForm agencySettings={agencySettings} revisit={revisit} />;
}
