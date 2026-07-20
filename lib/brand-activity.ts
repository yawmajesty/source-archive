import { getBrandSupabase } from "./supabase-brand";

// Every verb lives in one closed set so summaries render deterministic
// icons/colors and permission checks can key off them later.
export type ActivityVerb =
  | "collection.created"
  | "collection.updated"
  | "collection.deleted"
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "product.stage_changed"
  | "product.costing_updated"
  | "sample.round_created"
  | "sample.round_updated"
  | "sample.status_changed"
  | "sample.comment_added"
  | "milestone.created"
  | "milestone.done"
  | "milestone.deleted"
  | "supplier.created"
  | "supplier.updated"
  | "comment.added";

export type ActivityTargetType =
  | "collection"
  | "product"
  | "sample_round"
  | "milestone"
  | "supplier"
  | "comment";

export interface ActivityEvent {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  verb: ActivityVerb;
  target_type: ActivityTargetType | null;
  target_id: string | null;
  collection_id: string | null;
  product_id: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

interface LogArgs {
  workspaceId: string;
  actorId: string | null;
  verb: ActivityVerb;
  summary: string;
  targetType?: ActivityTargetType | null;
  targetId?: string | null;
  collectionId?: string | null;
  productId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Best-effort activity write. Callers never await error handling —
 * a failure here should never block the underlying mutation. If the
 * write fails we log server-side and move on.
 */
export async function logActivity(args: LogArgs): Promise<void> {
  try {
    const supabase = await getBrandSupabase();
    await supabase.from("activity_events").insert({
      workspace_id: args.workspaceId,
      actor_id: args.actorId,
      verb: args.verb,
      summary: args.summary,
      target_type: args.targetType ?? null,
      target_id: args.targetId ?? null,
      collection_id: args.collectionId ?? null,
      product_id: args.productId ?? null,
      meta: args.meta ?? null,
    });
  } catch (err) {
    console.error("[activity] insert failed:", err);
  }
}

export async function listWorkspaceActivity(workspaceId: string, limit = 50): Promise<ActivityEvent[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("activity_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityEvent[];
}

export async function listCollectionActivity(collectionId: string, limit = 50): Promise<ActivityEvent[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("activity_events")
    .select("*")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityEvent[];
}

export async function listProductActivity(productId: string, limit = 50): Promise<ActivityEvent[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("activity_events")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ActivityEvent[];
}
