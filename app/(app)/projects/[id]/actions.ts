"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";

export async function forkProductsToRound(
  productIds: string[],
  projectId: string,
): Promise<void> {
  if (productIds.length === 0) return;

  const { data: originals } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (!originals?.length) return;

  const clones = originals.map((p: any) => ({
    project_id: p.project_id,
    name: p.name,
    category: p.category,
    stage: "sampling",
    factory_id: p.factory_id,
    target_cost_usd: p.target_cost_usd,
    quoted_cost_usd: p.quoted_cost_usd,
    quoted_cost_currency: p.quoted_cost_currency,
    quoted_cost_local: p.quoted_cost_local,
    client_unit_price_usd: p.client_unit_price_usd,
    moq: p.moq,
    order_qty: p.order_qty,
    lead_time_days: p.lead_time_days,
    sample_lead_time_days: p.sample_lead_time_days,
    colorways: p.colorways,
    bom_data: p.bom_data,
    notes: p.notes,
    // reset per-round sampling fields
    sample_fee_usd: null,
    sample_cost_usd: null,
    expected_sample_date: null,
    // lineage
    sample_round: (p.sample_round ?? 1) + 1,
    parent_product_id: p.id,
  }));

  await supabase.from("products").insert(clones);
  revalidatePath(`/projects/${projectId}`);
}
