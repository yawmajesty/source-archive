"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";

export async function markInviteViewed(inviteId: string): Promise<void> {
  await supabase
    .from("rfq_invites")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("viewed_at", null);
}

export async function submitQuote(data: {
  invite_id: string;
  factory_name: string;
  notes: string;
  images: string[];
  tiers: Array<{
    moq: number;
    unit_price_usd: number;
    lead_time_days: number | null;
    sample_fee_usd: number | null;
    notes: string;
  }>;
}): Promise<{ success: boolean; error?: string }> {
  // Idempotent: delete any existing submission first
  const { data: existing } = await supabase
    .from("rfq_submissions")
    .select("id")
    .eq("rfq_invite_id", data.invite_id)
    .maybeSingle();

  if (existing) {
    await supabase.from("rfq_tiers").delete().eq("submission_id", existing.id);
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

  for (let i = 0; i < data.tiers.length; i++) {
    const tier = data.tiers[i];
    await supabase.from("rfq_tiers").insert({
      id: `tier-${Date.now()}-${i}`,
      submission_id: submissionId,
      moq: tier.moq,
      unit_price_usd: tier.unit_price_usd,
      lead_time_days: tier.lead_time_days,
      sample_fee_usd: tier.sample_fee_usd,
      notes: tier.notes || null,
    });
  }

  await supabase
    .from("rfq_invites")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", data.invite_id);

  return { success: true };
}
