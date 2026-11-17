"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import type { ImportedProduct } from "@/lib/product-import";

/**
 * Writing a spreadsheet into a collection.
 *
 * Two rules do most of the work here.
 *
 * A style already in the collection is updated rather than duplicated,
 * matched on style number where the sheet gives one and on name where it
 * does not. The common case is not a first load — it is the same sheet
 * coming back from a factory with prices filled in, and importing that
 * as fifteen new styles beside the fifteen already there is the failure
 * mode worth designing against.
 *
 * And an update only writes the columns the sheet actually filled. A
 * price list has no fabric column; letting it through as NULL would
 * quietly erase the fabric somebody typed in last week.
 */

function keyOf(styleNo: string | null | undefined, name: string): string {
  return (styleNo?.trim() || name.trim()).toLowerCase();
}

export async function importProducts(input: {
  project_id: string;
  products: ImportedProduct[];
}): Promise<
  | { success: true; created: number; updated: number }
  | { success: false; error: string }
> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to add styles to this collection" };
  }

  const rows = input.products.filter((p) => p.name?.trim());
  if (rows.length === 0) return { success: false, error: "Nothing to import." };

  const supabase = await getAgencySupabase();

  const { data: projectRow } = await supabase
    .from("projects")
    .select("id")
    .eq("id", input.project_id)
    .maybeSingle();
  if (!projectRow) return { success: false, error: "That collection no longer exists." };

  const { data: existingRows } = await supabase
    .from("products")
    .select("id, name, style_no")
    .eq("project_id", input.project_id);

  const existing = new Map<string, string>();
  for (const r of (existingRows ?? []) as Array<{ id: string; name: string | null; style_no: string | null }>) {
    existing.set(keyOf(r.style_no, r.name ?? ""), r.id);
    // Also reachable by name alone, so a sheet without style numbers
    // still finds a style that has one.
    if (r.name) existing.set(r.name.trim().toLowerCase(), r.id);
  }

  /** Only what the sheet actually provided. */
  function changedFields(p: ImportedProduct): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (p.styleNo != null) out.style_no = p.styleNo;
    if (p.category != null) out.category = p.category;
    if (p.sizeRange != null) out.size_range = p.sizeRange;
    if (p.colorways.length > 0) out.colorways = p.colorways;
    if (p.fabric != null) out.fabric = p.fabric;
    if (p.compositionGsm != null) out.composition_gsm = p.compositionGsm;
    if (p.notes != null) out.notes = p.notes;
    if (p.notesZh != null) out.notes_zh = p.notesZh;
    if (p.moq != null) out.moq = p.moq;
    if (p.orderQty != null) out.order_qty = p.orderQty;
    if (p.leadTimeDays != null) out.lead_time_days = p.leadTimeDays;
    if (p.sampleFeeUsd != null) out.sample_fee_usd = p.sampleFeeUsd;
    if (p.clientUnitPriceUsd != null) out.client_unit_price_usd = p.clientUnitPriceUsd;
    if (p.targetCostUsd != null) out.target_cost_usd = p.targetCostUsd;
    if (p.quotedCostUsd != null) out.quoted_cost_usd = p.quotedCostUsd;
    return out;
  }

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; patch: Record<string, unknown> }> = [];
  // Ids minted in a loop can collide inside one millisecond, so the index
  // is part of the id rather than the timestamp alone.
  const stamp = Date.now();

  rows.forEach((p, i) => {
    const name = p.name.trim();
    const found = existing.get(keyOf(p.styleNo, name));
    if (found) {
      const patch = changedFields(p);
      patch.name = name;
      toUpdate.push({ id: found, patch });
      return;
    }
    toInsert.push({
      agency_id: ctx.agency.id,
      id: `prod-${stamp}-${i}`,
      project_id: input.project_id,
      name,
      // The same defaults a style added by hand gets.
      category: p.category ?? null,
      stage: "brief",
      factory_id: null,
      moq: p.moq ?? 0,
      order_qty: p.orderQty ?? 0,
      target_cost_usd: p.targetCostUsd ?? 0,
      quoted_cost_usd: p.quotedCostUsd ?? null,
      quoted_cost_currency: "USD",
      lead_time_days: p.leadTimeDays ?? 0,
      colorways: p.colorways,
      notes: p.notes ?? "",
      sample_round: 1,
      style_no: p.styleNo ?? null,
      size_range: p.sizeRange ?? null,
      fabric: p.fabric ?? null,
      composition_gsm: p.compositionGsm ?? null,
      notes_zh: p.notesZh ?? null,
      sample_fee_usd: p.sampleFeeUsd ?? null,
      client_unit_price_usd: p.clientUnitPriceUsd ?? null,
    });
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("products").insert(toInsert);
    if (error) return { success: false, error: error.message };
  }

  for (const { id, patch } of toUpdate) {
    const { error } = await supabase.from("products").update(patch).eq("id", id);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${input.project_id}`);
  revalidatePath("/products");
  return { success: true, created: toInsert.length, updated: toUpdate.length };
}
