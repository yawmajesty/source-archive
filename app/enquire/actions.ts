"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { sendAll, agencyNotificationRecipients } from "@/lib/email/send";
import { enquiryReceivedClient, enquiryReceivedAdmin } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";

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
  const { data: lead } = await supabase.from("leads").insert({
    agency_id: OWNER_AGENCY_ID,
    ...data,
    status: "new",
    source: "enquiry_form",
    brief_products: [],
  }).select("id").maybeSingle();

  const leadId = (lead as { id: string } | null)?.id ?? null;
  const admins = await agencyNotificationRecipients(OWNER_AGENCY_ID);
  const confirmation = enquiryReceivedClient({ contactName: data.contact_name });
  const alert = enquiryReceivedAdmin({
    name: data.contact_name,
    email: data.contact_email,
    company: data.company_name,
    message: data.message,
    leadsUrl: buildPublicUrl("/leads"),
  });

  await sendAll([
    {
      agencyId: OWNER_AGENCY_ID,
      to: data.contact_email,
      toName: data.contact_name,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
      template: "enquiry_received_client" as const,
      relatedType: "lead" as const,
      relatedId: leadId,
    },
    ...admins.map((to) => ({
      agencyId: OWNER_AGENCY_ID,
      to,
      replyTo: data.contact_email,
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
      template: "enquiry_received_admin" as const,
      relatedType: "lead" as const,
      relatedId: leadId,
    })),
  ]);
}
