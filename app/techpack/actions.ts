"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { sendAll, agencyNotificationRecipients } from "@/lib/email/send";
import { techpackReceivedClient, techpackReceivedAdmin } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";

// Public techpack form — no Clerk auth. Every submission lands in the
// Source Archive agency for now; per-agency public techpack forms are
// a future enhancement.
const OWNER_AGENCY_ID = "ag-source-archive";

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
  const supabase = getAgencyServiceSupabase();
  const { data: row } = await supabase.from("techpack_submissions").insert({
    agency_id: OWNER_AGENCY_ID,
    ...payload,
    status: "new",
  }).select("id").maybeSingle();

  const garment = payload.collection_name || payload.product_category || null;
  const admins = await agencyNotificationRecipients(OWNER_AGENCY_ID);
  const confirmation = techpackReceivedClient({ contactName: payload.contact_name, garment });
  const alert = techpackReceivedAdmin({
    contactName: payload.contact_name,
    contactEmail: payload.contact_email,
    garment,
    url: buildPublicUrl("/techpacks"),
  });
  const relatedId = (row as { id: string } | null)?.id ?? null;

  await sendAll([
    {
      agencyId: OWNER_AGENCY_ID,
      to: payload.contact_email,
      toName: payload.contact_name,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
      template: "techpack_received_client" as const,
      relatedType: null,
      relatedId,
    },
    ...admins.map((to) => ({
      agencyId: OWNER_AGENCY_ID,
      to,
      replyTo: payload.contact_email,
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
      template: "techpack_received_admin" as const,
      relatedType: null,
      relatedId,
    })),
  ]);
}
