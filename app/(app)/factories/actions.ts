"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function createRfq(data: {
  title: string;
  description: string | null;
  deadline: string | null;
  factory_ids: string[];
}): Promise<{ id: string } | { error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const rfqId = "rfq-" + Date.now();

  const { error } = await supabase.from("rfqs").insert({
    agency_id: ctx.agency.id,
    id: rfqId,
    title: data.title,
    description: data.description,
    deadline: data.deadline,
    status: "sent",
  });

  if (error) return { error: error.message };

  for (const factoryId of data.factory_ids) {
    await supabase.from("rfq_invites").insert({
      agency_id: ctx.agency.id,
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
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("rfqs").update({ status: "closed" }).eq("id", rfqId);
  revalidatePath("/factories");
}

export async function assignQuotedProduct(data: {
  quoted_product_id: string;
  target_product_id: string;
  factory_id: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data: qp } = await supabase
    .from("rfq_quoted_products")
    .select("unit_price_usd, sample_fee_usd, lead_time_days")
    .eq("id", data.quoted_product_id)
    .single();

  if (!qp) return { success: false, error: "Quoted product not found" };

  const update: Record<string, any> = {};
  if (qp.unit_price_usd != null) update.quoted_cost_usd = qp.unit_price_usd;
  if (qp.sample_fee_usd != null) update.sample_fee_usd = qp.sample_fee_usd;
  if (data.factory_id) update.factory_id = data.factory_id;

  const { error } = await supabase.from("products").update(update).eq("id", data.target_product_id);
  if (error) return { success: false, error: error.message };

  await supabase
    .from("rfq_quoted_products")
    .update({ assigned_product_id: data.target_product_id })
    .eq("id", data.quoted_product_id);

  revalidatePath("/factories");
  revalidatePath("/products");
  revalidatePath(`/products/${data.target_product_id}`);
  return { success: true };
}

export async function getRfqDetail(rfqId: string): Promise<{
  invites: Array<{
    id: string;
    factory_id: string;
    factory_name: string;
    factory_email: string;
    token: string;
    viewed_at: string | null;
    submitted_at: string | null;
  }>;
  submissions: Array<{
    factory_name: string;
    factory_id: string;
    notes: string | null;
    submitted_at: string;
    images: string[];
    products: Array<{
      id: string;
      name: string;
      description: string | null;
      moq: number | null;
      unit_price_usd: number | null;
      sample_fee_usd: number | null;
      lead_time_days: number | null;
      notes: string | null;
      assigned_product_id: string | null;
      image_url: string | null;
    }>;
  }>;
}> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data: invites } = await supabase
    .from("rfq_invites")
    .select("id, factory_id, token, viewed_at, submitted_at, factories(name, contact_email)")
    .eq("rfq_id", rfqId)
    .order("created_at");

  const mappedInvites = (invites ?? []).map((row: any) => ({
    id: row.id,
    factory_id: row.factory_id,
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
    .select("*, rfq_quoted_products(*)")
    .in("rfq_invite_id", submittedIds);

  const mappedSubmissions = (submissions ?? []).map((sub: any) => {
    const invite = mappedInvites.find((i) => i.id === sub.rfq_invite_id);
    return {
      factory_name: invite?.factory_name ?? sub.factory_name ?? "Unknown",
      factory_id: invite?.factory_id ?? null,
      notes: sub.notes,
      submitted_at: sub.submitted_at,
      images: sub.images ?? [],
      products: ((sub.rfq_quoted_products ?? []) as any[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          moq: p.moq,
          unit_price_usd: p.unit_price_usd,
          sample_fee_usd: p.sample_fee_usd,
          lead_time_days: p.lead_time_days,
          notes: p.notes,
          assigned_product_id: p.assigned_product_id,
          image_url: p.image_url ?? null,
        })),
    };
  });

  return { invites: mappedInvites, submissions: mappedSubmissions };
}
