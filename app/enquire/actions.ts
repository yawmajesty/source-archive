"use server";

import { supabaseData } from "@/lib/supabase-data";

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
  await supabaseData.from("leads").insert({
    ...data,
    status: "new",
    source: "enquiry_form",
    brief_products: [],
  });
}
