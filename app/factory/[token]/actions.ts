"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";

export async function markInviteViewed(inviteId: string): Promise<void> {
  await supabase
    .from("rfq_invites")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("viewed_at", null);
}

export interface QuotedProductInput {
  name: string;
  description: string;
  moq: number | null;
  unit_price_usd: number | null;
  sample_fee_usd: number | null;
  lead_time_days: number | null;
  notes: string;
  image_url: string | null;
}

export async function submitQuote(data: {
  invite_id: string;
  factory_name: string;
  notes: string;
  images: string[];
  products: QuotedProductInput[];
}): Promise<{ success: boolean; error?: string }> {
  // Delete any existing submission (re-submit)
  const { data: existing } = await supabase
    .from("rfq_submissions")
    .select("id")
    .eq("rfq_invite_id", data.invite_id)
    .maybeSingle();

  if (existing) {
    await supabase.from("rfq_quoted_products").delete().eq("submission_id", existing.id);
    await supabase.from("rfq_submissions").delete().eq("id", existing.id);
  }

  const submissionId = "sub-" + Date.now();
  const { error } = await supabase.from("rfq_submissions").insert({
    id: submissionId,
    rfq_invite_id: data.invite_id,
    factory_name: data.factory_name,
    notes: data.notes || null,
    images: data.images,
    submitted_at: new Date().toISOString(),
  });

  if (error) return { success: false, error: error.message };

  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    await supabase.from("rfq_quoted_products").insert({
      id: `qp-${Date.now()}-${i}`,
      submission_id: submissionId,
      name: p.name,
      description: p.description || null,
      moq: p.moq,
      unit_price_usd: p.unit_price_usd,
      sample_fee_usd: p.sample_fee_usd,
      lead_time_days: p.lead_time_days,
      notes: p.notes || null,
      sort_order: i,
      image_url: p.image_url || null,
    });
  }

  await supabase
    .from("rfq_invites")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", data.invite_id);

  return { success: true };
}
