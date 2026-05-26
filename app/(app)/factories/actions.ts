"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import type { RfqTier, RfqSubmission } from "@/lib/data";

export async function createRfq(data: {
  title: string;
  description: string | null;
  deadline: string | null;
  factory_ids: string[];
}): Promise<{ id: string } | { error: string }> {
  const rfqId = "rfq-" + Date.now();

  const { error } = await supabase.from("rfqs").insert({
    id: rfqId,
    title: data.title,
    description: data.description,
    deadline: data.deadline,
    status: "sent",
  });

  if (error) return { error: error.message };

  for (const factoryId of data.factory_ids) {
    await supabase.from("rfq_invites").insert({
      id: "inv-" + Date.now() + "-" + factoryId,
      rfq_id: rfqId,
      factory_id: factoryId,
      token: randomUUID(),
    });
  }

  revalidatePath("/factories");
  return { id: rfqId };
}

export async function closeRfq(rfqId: string): Promise<void> {
  await supabase.from("rfqs").update({ status: "closed" }).eq("id", rfqId);
  revalidatePath("/factories");
}

export async function getRfqDetail(rfqId: string): Promise<{
  invites: Array<{
    id: string;
    factory_name: string;
    factory_email: string;
    token: string;
    viewed_at: string | null;
    submitted_at: string | null;
  }>;
  submissions: Array<{
    factory_name: string;
    notes: string | null;
    images: string[];
    submitted_at: string;
    tiers: Array<Pick<RfqTier, "moq" | "unit_price_usd" | "lead_time_days" | "sample_fee_usd" | "notes">>;
  }>;
}> {
  const { data: invites } = await supabase
    .from("rfq_invites")
    .select("id, token, viewed_at, submitted_at, factories(name, contact_email)")
    .eq("rfq_id", rfqId)
    .order("created_at");

  const mappedInvites = (invites ?? []).map((row: any) => ({
    id: row.id,
    token: row.token,
    viewed_at: row.viewed_at,
    submitted_at: row.submitted_at,
    factory_name: row.factories?.name ?? "Unknown",
    factory_email: row.factories?.contact_email ?? "",
  }));

  const submittedIds = mappedInvites.filter((i) => i.submitted_at).map((i) => i.id);

  if (!submittedIds.length) return { invites: mappedInvites, submissions: [] };

  const { data: submissions } = await supabase
    .from("rfq_submissions")
    .select("*, rfq_tiers(*)")
    .in("rfq_invite_id", submittedIds);

  const mappedSubmissions = (submissions ?? []).map((sub: any) => {
    const invite = mappedInvites.find((i) => i.id === sub.rfq_invite_id);
    return {
      factory_name: invite?.factory_name ?? sub.factory_name ?? "Unknown",
      notes: sub.notes,
      images: sub.images ?? [],
      submitted_at: sub.submitted_at,
      tiers: ((sub.rfq_tiers ?? []) as RfqTier[])
        .sort((a, b) => a.moq - b.moq)
        .map((t) => ({
          moq: t.moq,
          unit_price_usd: t.unit_price_usd,
          lead_time_days: t.lead_time_days,
          sample_fee_usd: t.sample_fee_usd,
          notes: t.notes,
        })),
    };
  });

  return { invites: mappedInvites, submissions: mappedSubmissions };
}
