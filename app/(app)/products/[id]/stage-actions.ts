"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { PRODUCT_STAGES } from "@/lib/stages";

export interface StageEvent {
  id: string;
  product_id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  changed_by_name: string | null;
  visible_to_client: boolean;
  created_at: string;
}

export async function listStageEvents(productId: string): Promise<StageEvent[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("product_stage_events")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return (data ?? []) as StageEvent[];
}

/**
 * Move a product to a new stage and record who moved it and why.
 *
 * Permission is checked here and again in the database: has_agency_permission
 * gates the history insert, and a trigger on products blocks the stage column
 * changing without it. Belt and braces, because this is the one write we hand
 * to people who aren't admins.
 */
export async function changeProductStage(
  productId: string,
  toStage: string,
  note?: string,
): Promise<{ success: true; from: string | null; to: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "stage.change")) {
    return { success: false, error: "You don't have permission to move products between stages" };
  }
  if (!PRODUCT_STAGES.some((s) => s.id === toStage)) {
    return { success: false, error: `Unknown stage "${toStage}"` };
  }

  const supabase = await getAgencySupabase();
  const { data: product } = await supabase
    .from("products")
    .select("id, stage, agency_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { success: false, error: "Product not found" };

  const from = (product as { stage: string | null }).stage ?? null;
  if (from === toStage) return { success: true, from, to: toStage };

  const { error: updateError } = await supabase
    .from("products")
    .update({ stage: toStage })
    .eq("id", productId);
  if (updateError) return { success: false, error: updateError.message };

  const { error: eventError } = await supabase.from("product_stage_events").insert({
    agency_id: (product as { agency_id: string }).agency_id,
    product_id: productId,
    from_stage: from,
    to_stage: toStage,
    note: note?.trim() || null,
    changed_by: ctx.currentUserId,
    changed_by_name: ctx.agency.name ?? null,
  });
  // The move itself succeeded; a missing history row shouldn't fail the call,
  // but it should be visible rather than swallowed.
  if (eventError) console.error("[stage] history insert failed:", eventError.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/workshop");
  return { success: true, from, to: toStage };
}
