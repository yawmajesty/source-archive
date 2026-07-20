"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import { logActivity } from "@/lib/brand-activity";

export async function createMilestone(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  product_id?: string | null;
  mode: WorkspaceMode;
  role: Role;
  title: string;
  date: string; // YYYY-MM-DD
  notes?: string | null;
}): Promise<{ success: true; milestone_id: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "milestone.create", input.mode)) {
    return { success: false, error: "You don't have permission to add milestones" };
  }
  if (!input.title.trim()) return { success: false, error: "Milestone title is required" };
  if (!input.date) return { success: false, error: "Date is required" };

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("milestones")
    .insert({
      workspace_id: input.workspace_id,
      collection_id: input.collection_id,
      product_id: input.product_id ?? null,
      title: input.title.trim(),
      date: input.date,
      notes: input.notes?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to create milestone" };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "milestone.created",
    summary: `added milestone "${input.title.trim()}" for ${input.date}`,
    targetType: "milestone",
    targetId: data.id,
    collectionId: input.collection_id,
    productId: input.product_id ?? null,
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}/timeline`);
  return { success: true, milestone_id: data.id };
}

export async function updateMilestone(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  milestone_id: string;
  mode: WorkspaceMode;
  role: Role;
  patch: Partial<{
    title: string;
    date: string;
    notes: string | null;
    done_at: string | null;
  }>;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "milestone.update", input.mode)) {
    return { success: false, error: "You don't have permission to update milestones" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("milestones").update(input.patch).eq("id", input.milestone_id);
  if (error) return { success: false, error: error.message };

  if ("done_at" in input.patch) {
    await logActivity({
      workspaceId: input.workspace_id,
      actorId: userId,
      verb: "milestone.done",
      summary: input.patch.done_at ? "checked off a milestone" : "reopened a milestone",
      targetType: "milestone",
      targetId: input.milestone_id,
      collectionId: input.collection_id,
    });
  }

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}/timeline`);
  return { success: true };
}

export async function toggleMilestoneDone(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  milestone_id: string;
  mode: WorkspaceMode;
  role: Role;
  currentlyDone: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
  return updateMilestone({
    workspace_id: input.workspace_id,
    workspace_slug: input.workspace_slug,
    collection_id: input.collection_id,
    milestone_id: input.milestone_id,
    mode: input.mode,
    role: input.role,
    patch: { done_at: input.currentlyDone ? null : new Date().toISOString() },
  });
}

export async function deleteMilestone(input: {
  workspace_id: string;
  workspace_slug: string;
  collection_id: string;
  milestone_id: string;
  mode: WorkspaceMode;
  role: Role;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "milestone.delete", input.mode)) {
    return { success: false, error: "You don't have permission to delete milestones" };
  }
  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("milestones").delete().eq("id", input.milestone_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "milestone.deleted",
    summary: "deleted a milestone",
    targetType: "milestone",
    targetId: null,
    collectionId: input.collection_id,
  });

  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}`);
  revalidatePath(`/app/${input.workspace_slug}/collections/${input.collection_id}/timeline`);
  return { success: true };
}
