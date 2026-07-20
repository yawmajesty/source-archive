"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import { logActivity } from "@/lib/brand-activity";

export async function addComment(input: {
  workspace_id: string;
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
  collection_id: string;
  product_id?: string | null;
  body: string;
}): Promise<{ success: true; comment_id: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "comment.create", input.mode)) {
    return { success: false, error: "You don't have permission to comment" };
  }
  const body = input.body.trim();
  if (!body) return { success: false, error: "Comment can't be empty" };

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      workspace_id: input.workspace_id,
      collection_id: input.collection_id,
      product_id: input.product_id ?? null,
      user_id: userId,
      body,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to add comment" };

  // Fire-and-forget activity write.
  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "comment.added",
    summary: input.product_id
      ? "commented on product"
      : "commented on collection",
    targetType: "comment",
    targetId: data.id,
    collectionId: input.collection_id,
    productId: input.product_id ?? null,
    meta: { excerpt: body.slice(0, 140) },
  });

  const path = input.product_id
    ? `/app/${input.workspace_slug}/collections/${input.collection_id}/products/${input.product_id}`
    : `/app/${input.workspace_slug}/collections/${input.collection_id}`;
  revalidatePath(path);
  return { success: true, comment_id: data.id };
}

export async function deleteComment(input: {
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
  comment_id: string;
  collection_id: string;
  product_id?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  // RLS enforces "author only" — no extra role check needed for
  // ordinary users. If workspace admins should later be able to
  // delete anyone's comment, layer that in via the service client.
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("comments").delete().eq("id", input.comment_id);
  if (error) return { success: false, error: error.message };

  const path = input.product_id
    ? `/app/${input.workspace_slug}/collections/${input.collection_id}/products/${input.product_id}`
    : `/app/${input.workspace_slug}/collections/${input.collection_id}`;
  revalidatePath(path);
  return { success: true };
}
