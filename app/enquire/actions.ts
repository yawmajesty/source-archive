"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";

// Public enquiry form — no Clerk auth. Every submission lands in the
// Source Archive agency for now; per-agency public enquiry forms are
// a future enhancement.
const OWNER_AGENCY_ID = "ag-source-archive";

export async function submitEnquiry(data: {
  contact_name: string;
  company_name: string;
  contact_email: string;
  phone: string | null;
  country: string | null;
  industry: string | null;
  product_interest: string | null;
  how_found_us: string | null;
  message: string | null;
}) {
  const supabase = getAgencyServiceSupabase();
  await supabase.from("leads").insert({
    agency_id: OWNER_AGENCY_ID,
    ...data,
    status: "new",
    source: "enquiry_form",
    brief_products: [],
  });
}
