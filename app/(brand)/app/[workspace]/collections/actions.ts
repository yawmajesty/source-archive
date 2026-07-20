"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import { categoryPrefix, stageLabel, type CategoryKey, type Stage, type CostBreakdown } from "@/lib/brand-catalog";
import { logActivity } from "@/lib/brand-activity";

// ── Collections ───────────────────────────────────────────────────

export async function createCollection(input: {
  workspace_id: string;
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
  name: string;
  season?: string;
  base_currency?: string;
}): Promise<
  | { success: true; collection_id: string }
  | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "collection.create", input.mode)) {
    return { success: false, error: "You don't have permission to create collections" };
  }
  if (!input.name.trim()) return { success: false, error: "Collection name is required" };

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("collections")
    .insert({
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      season: input.season?.trim() || null,
      base_currency: input.base_currency ?? "USD",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to create collection" };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "collection.created",
    summary: `created collection "${input.name.trim()}"`,
    targetType: "collection",
    targetId: data.id,
    collectionId: data.id,
  });

  revalidatePath(`/app/${input.workspace_slug}/collections`);
  return { success: true, collection_id: data.id };
}

export async function updateCollection(input: {
  workspace_id: string;
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
  collection_id: string;
  patch: Partial<{
    name: string;
    season: string | null;
    description: string | null;
    status: string;
    cover_image_url: string | null;
    kickoff_date: string | null;
    sample_deadline: string | null;
    production_start: string | null;
    ex_factory_target: string | null;
    launch_date: string | null;
  }>;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "collection.update", input.mode)) {
    return { success: false, error: "You don't have permission" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("collections").update(input.patch).eq("id", input.collection_id);
  if (error) return { success: false, error: error.message };

  const changedKeys = Object.keys(input.patch);
  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "collection.updated",
    summary: `updated collection (${changedKeys.join(", ")})`,
    targetType: "collection",
    targetId: input.collection_id,
    collectionId: input.collection_id,
    meta: { fields: changedKeys },
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true };
}

export async function deleteCollection(input: {
  workspace_id: string;
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
  collection_id: string;
  collection_name?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "collection.delete", input.mode)) {
    return { success: false, error: "You don't have permission to delete collections" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("collections").delete().eq("id", input.collection_id);
  if (error) return { success: false, error: error.message };

  // FK is ON DELETE CASCADE so the events targeting the collection are
  // already gone; log a workspace-scoped one so the deletion still
  // shows up in the workspace feed.
  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "collection.deleted",
    summary: `deleted collection${input.collection_name ? ` "${input.collection_name}"` : ""}`,
    targetType: "collection",
    targetId: null,
    collectionId: null,
  });

  revalidatePath(`/app/${input.workspace_slug}/collections`);
  return { success: true };
}

// ── Products ──────────────────────────────────────────────────────

export async function quickAddProduct(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  mode: WorkspaceMode;
  role: Role;
  name: string;
  category: CategoryKey;
}): Promise<
  | { success: true; product_id: string; style_code: string }
  | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "product.create", input.mode)) {
    return { success: false, error: "You don't have permission to add products" };
  }
  if (!input.name.trim()) return { success: false, error: "Product name is required" };

  const supabase = await getBrandSupabase();

  // Reserve the next style code via the SECURITY DEFINER RPC — atomic
  // and race-safe across concurrent quick-adds.
  const prefix = categoryPrefix(input.category);
  const { data: styleCode, error: seqErr } = await supabase.rpc("next_style_code", {
    p_ws_id: input.workspace_id,
    p_prefix: prefix,
  });
  if (seqErr || !styleCode) return { success: false, error: seqErr?.message ?? "Failed to reserve style code" };

  const { data, error } = await supabase
    .from("brand_products")
    .insert({
      workspace_id: input.workspace_id,
      collection_id: input.collection_id,
      name: input.name.trim(),
      style_code: styleCode,
      category: input.category,
      created_by: userId,
    })
    .select("id, style_code")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to create product" };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "product.created",
    summary: `added "${input.name.trim()}" (${data.style_code})`,
    targetType: "product",
    targetId: data.id,
    collectionId: input.collection_id,
    productId: data.id,
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true, product_id: data.id, style_code: data.style_code };
}

export async function updateProduct(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  product_id: string;
  mode: WorkspaceMode;
  role: Role;
  patch: Partial<{
    name: string;
    description: string | null;
    category: CategoryKey;
    cover_image_url: string | null;
    gallery_urls: string[];
    colorways: Array<{ name: string; hex: string | null; swatch_image_url: string | null }>;
    size_range: string[];
    target_quantity: number | null;
    spec_fabric: string | null;
    spec_trims: string | null;
    spec_wash: string | null;
    spec_customization: string | null;
    spec_packaging: string | null;
    target_sample_date: string | null;
    target_delivery: string | null;
  }>;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "product.update", input.mode)) {
    return { success: false, error: "You don't have permission" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("brand_products").update(input.patch).eq("id", input.product_id);
  if (error) return { success: false, error: error.message };

  const changedKeys = Object.keys(input.patch);
  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "product.updated",
    summary: `updated product (${changedKeys.join(", ")})`,
    targetType: "product",
    targetId: input.product_id,
    collectionId: input.collection_id,
    productId: input.product_id,
    meta: { fields: changedKeys },
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true };
}

export async function changeProductStage(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  product_id: string;
  mode: WorkspaceMode;
  role: Role;
  next_stage: Stage;
  previous_stage?: Stage;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "product.stage.change", input.mode)) {
    return { success: false, error: "You don't have permission to change stage" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase
    .from("brand_products")
    .update({ stage: input.next_stage, stage_entered_at: new Date().toISOString() })
    .eq("id", input.product_id);
  if (error) return { success: false, error: error.message };

  const from = input.previous_stage ? stageLabel(input.previous_stage) : null;
  const to = stageLabel(input.next_stage);
  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "product.stage_changed",
    summary: from ? `moved to ${to} (from ${from})` : `moved to ${to}`,
    targetType: "product",
    targetId: input.product_id,
    collectionId: input.collection_id,
    productId: input.product_id,
    meta: { from: input.previous_stage ?? null, to: input.next_stage },
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true };
}

export async function updateProductCosting(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  product_id: string;
  mode: WorkspaceMode;
  role: Role;
  patch: Partial<{
    estimated_cost: number | null;
    cost_currency: string | null;
    cost_breakdown: CostBreakdown | null;
    sale_price_retail: number | null;
    sale_price_wholesale: number | null;
  }>;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "cost.edit", input.mode)) {
    return { success: false, error: "You don't have permission to edit costing" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("brand_products").update(input.patch).eq("id", input.product_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "product.costing_updated",
    summary: "updated costing",
    targetType: "product",
    targetId: input.product_id,
    collectionId: input.collection_id,
    productId: input.product_id,
    meta: { fields: Object.keys(input.patch) },
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true };
}

export async function updateCollectionFx(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  mode: WorkspaceMode;
  role: Role;
  fx_rates: Record<string, number>;
  target_margin_pct: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "collection.update", input.mode)) {
    return { success: false, error: "You don't have permission" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase
    .from("collections")
    .update({ fx_rates: input.fx_rates, target_margin_pct: input.target_margin_pct })
    .eq("id", input.collection_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "collection.updated",
    summary: "updated FX rates / target margin",
    targetType: "collection",
    targetId: input.collection_id,
    collectionId: input.collection_id,
    meta: { fields: ["fx_rates", "target_margin_pct"] },
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true };
}

export async function deleteProduct(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  product_id: string;
  product_name?: string;
  mode: WorkspaceMode;
  role: Role;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "product.delete", input.mode)) {
    return { success: false, error: "You don't have permission" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("brand_products").delete().eq("id", input.product_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "product.deleted",
    summary: `deleted product${input.product_name ? ` "${input.product_name}"` : ""}`,
    targetType: "product",
    targetId: null,
    collectionId: input.collection_id,
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  return { success: true };
}
