"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import type { SampleStatus } from "@/lib/brand-sampling";
import { logActivity } from "@/lib/brand-activity";

interface Ctx {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  product_id: string;
  mode: WorkspaceMode;
  role: Role;
}

function refresh(ctx: Ctx) {
  revalidatePath(`/app/${ctx.workspace_slug}/collections/${ctx.collection_id}/products/${ctx.product_id}`);
}

// ── Sample rounds ─────────────────────────────────────────────────

export async function createSampleRound(input: Ctx & {
  label: string;
  requested_at?: string | null;
  eta_at?: string | null;
  supplier_id?: string | null;
}): Promise<{ success: true; sample_round_id: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "sample.create", input.mode)) {
    return { success: false, error: "You don't have permission to add sample rounds" };
  }

  const supabase = await getBrandSupabase();

  // sort_order: next after the existing max on this product
  const { data: existing } = await supabase
    .from("sample_rounds")
    .select("sort_order")
    .eq("product_id", input.product_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("sample_rounds")
    .insert({
      workspace_id: input.workspace_id,
      product_id: input.product_id,
      supplier_id: input.supplier_id ?? null,
      label: input.label.trim() || `Sample ${nextOrder + 1}`,
      sort_order: nextOrder,
      status: "requested",
      requested_at: input.requested_at ?? null,
      eta_at: input.eta_at ?? null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed to create sample round" };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "sample.round_created",
    summary: `started ${input.label.trim() || `Sample ${nextOrder + 1}`}`,
    targetType: "sample_round",
    targetId: data.id,
    collectionId: input.collection_id,
    productId: input.product_id,
  });

  refresh(input);
  return { success: true, sample_round_id: data.id };
}

export async function updateSampleRound(input: Ctx & {
  sample_round_id: string;
  patch: Partial<{
    label: string;
    supplier_id: string | null;
    status: SampleStatus;
    requested_at: string | null;
    eta_at: string | null;
    shipped_at: string | null;
    received_at: string | null;
    tracking_number: string | null;
    carrier: string | null;
    photo_urls: string[];
    revision_summary: string | null;
  }>;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  // A status change requires sample.status.change; other patch keys require sample.create.
  const needed = "status" in input.patch ? "sample.status.change" as const : "sample.create" as const;
  if (!can(input.role, needed, input.mode)) return { success: false, error: "You don't have permission" };

  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("sample_rounds").update(input.patch).eq("id", input.sample_round_id);
  if (error) return { success: false, error: error.message };

  const isStatusChange = "status" in input.patch;
  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: isStatusChange ? "sample.status_changed" : "sample.round_updated",
    summary: isStatusChange
      ? `sample marked ${String(input.patch.status).replace(/_/g, " ")}`
      : `updated sample round (${Object.keys(input.patch).join(", ")})`,
    targetType: "sample_round",
    targetId: input.sample_round_id,
    collectionId: input.collection_id,
    productId: input.product_id,
    meta: isStatusChange ? { status: input.patch.status } : { fields: Object.keys(input.patch) },
  });

  refresh(input);
  return { success: true };
}

export async function deleteSampleRound(input: Ctx & { sample_round_id: string })
  : Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "sample.create", input.mode)) return { success: false, error: "You don't have permission" };

  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("sample_rounds").delete().eq("id", input.sample_round_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "sample.round_updated",
    summary: "deleted a sample round",
    targetType: "sample_round",
    targetId: null,
    collectionId: input.collection_id,
    productId: input.product_id,
  });

  refresh(input);
  return { success: true };
}

// ── Comments ──────────────────────────────────────────────────────

export async function addSampleComment(input: Ctx & {
  sample_round_id: string;
  body: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "sample.comment", input.mode)) return { success: false, error: "You don't have permission" };
  if (!input.body.trim()) return { success: false, error: "Comment can't be empty" };

  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("sample_round_comments").insert({
    workspace_id: input.workspace_id,
    sample_round_id: input.sample_round_id,
    user_id: userId,
    body: input.body.trim(),
  });
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "sample.comment_added",
    summary: "commented on sample",
    targetType: "sample_round",
    targetId: input.sample_round_id,
    collectionId: input.collection_id,
    productId: input.product_id,
    meta: { excerpt: input.body.trim().slice(0, 140) },
  });

  refresh(input);
  return { success: true };
}
