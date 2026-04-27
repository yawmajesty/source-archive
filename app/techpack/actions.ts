"use server";

import { supabaseData } from "@/lib/supabase-data";

export interface TechpackPayload {
  contact_name: string;
  company_name: string;
  contact_email: string;
  phone: string | null;
  product_category: string;
  collection_name: string | null;
  launch_date: string | null;
  target_quantity: number | null;
  retail_price_point: string | null;
  product_description: string | null;
  aesthetic_feeling: string[];
  reference_urls: string[];
  competitor_urls: string[];
  fit_type: string[];
  measurements_known: boolean | null;
  measurements_notes: string | null;
  fabric_preference: string[];
  fabric_gsm: string | null;
  suggest_fabric: boolean;
  print_type: string[];
  print_placement: string[];
  artwork_urls: string[];
  wash_type: string[];
  wash_effect: string | null;
  zip_type: string | null;
  button_type: string | null;
  drawstring_type: string | null;
  hardware_finish: string | null;
  neck_label: string | null;
  additional_labels: string[];
  packaging: string | null;
  custom_pattern: boolean;
  multiple_panels: boolean;
  special_construction: boolean;
  custom_hardware: boolean;
  sampling_budget: string | null;
  target_unit_cost: string | null;
  quality_priority: string | null;
  understands_revisions: boolean;
  produced_before: boolean | null;
  ready_for_sampling: boolean | null;
  deposit_agreed: boolean;
}

export async function submitTechpack(payload: TechpackPayload): Promise<void> {
  await supabaseData.from("techpack_submissions").insert({
    ...payload,
    status: "new",
  });
}
