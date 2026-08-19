"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import type { NewMediaItem, ProductMediaItem } from "@/lib/product-media";
import type { ProductionLogEntry } from "@/lib/production-log";

// Server Functions are reachable by direct POST, so every one of these
// re-checks membership rather than trusting the caller.
async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

function canRelease(role: string): boolean {
  // Releasing to a client is an agency decision, not the workshop's.
  return role === "admin" || role === "team";
}

export async function listProductionLog(productId: string): Promise<ProductionLogEntry[]> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("production_log_entries")
    .select("*")
    .eq("product_id", productId)
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as ProductionLogEntry[];
}

export async function createLogEntry(input: {
  product_id: string;
  stage: string;
  work_date: string;
  summary: string;
  minutes_spent?: number | null;
  blocked_reason?: string | null;
  sample_id?: string | null;
}): Promise<{ success: true; entry: ProductionLogEntry } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const summary = input.summary.trim();
  if (!summary) return { success: false, error: "Say what you worked on" };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("production_log_entries")
    .insert({
      agency_id: ctx.agency.id,
      product_id: input.product_id,
      sample_id: input.sample_id ?? null,
      stage: input.stage,
      work_date: input.work_date,
      summary,
      minutes_spent: input.minutes_spent ?? null,
      blocked_reason: input.blocked_reason?.trim() || null,
      author_user_id: userId,
      author_name: ctx.agency.name ?? null,
      visible_to_client: false,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${input.product_id}`);
  return { success: true, entry: data as ProductionLogEntry };
}

export async function updateLogEntry(
  id: string,
  productId: string,
  patch: { stage?: string; work_date?: string; summary?: string; minutes_spent?: number | null; blocked_reason?: string | null },
): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  // RLS decides whether this caller may touch this row: makers own theirs,
  // admin/team may edit any.
  const { error } = await supabase.from("production_log_entries").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function deleteLogEntry(id: string, productId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await ctxOrThrow();
  if (!canRelease(ctx.role)) return { success: false, error: "Only admins can delete log entries" };
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("production_log_entries").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/** Photos attach to an entry and inherit its release state. */
export async function attachLogPhotos(input: {
  entry_id: string;
  product_id: string;
  items: NewMediaItem[];
}): Promise<{ success: true; media: ProductMediaItem[] } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  if (!input.items.length) return { success: false, error: "Nothing to attach" };

  const supabase = await getAgencySupabase();
  const { data: entry } = await supabase
    .from("production_log_entries")
    .select("id, visible_to_client")
    .eq("id", input.entry_id)
    .maybeSingle();
  if (!entry) return { success: false, error: "Log entry not found" };

  const rows = input.items.map((item) => ({
    agency_id: ctx.agency.id,
    product_id: input.product_id,
    log_entry_id: input.entry_id,
    url: item.url,
    kind: item.kind,
    uploaded_by_role: "maker" as const,
    uploaded_by_name: ctx.agency.name ?? null,
    caption: item.caption ?? null,
    visible_to_client: (entry as any).visible_to_client === true,
  }));

  const { data, error } = await supabase
    .from("product_media")
    .upsert(rows, { onConflict: "product_id,url" })
    .select();
  if (error) return { success: false, error: error.message };

  revalidatePath(`/products/${input.product_id}`);
  return { success: true, media: (data ?? []) as ProductMediaItem[] };
}

/**
 * Release (or retract) a stretch of the diary. Flips the entry and every
 * photo hanging off it, so a released day arrives in the portal complete.
 */
export async function setLogEntryVisibility(
  ids: string[],
  productId: string,
  visible: boolean,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await ctxOrThrow();
  if (!canRelease(ctx.role)) return { success: false, error: "Only admins can release updates to clients" };
  if (!ids.length) return { success: true };

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("production_log_entries")
    .update({ visible_to_client: visible, published_at: visible ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) return { success: false, error: error.message };

  const { error: mediaError } = await supabase
    .from("product_media")
    .update({ visible_to_client: visible })
    .in("log_entry_id", ids);
  if (mediaError) return { success: false, error: mediaError.message };

  revalidatePath(`/products/${productId}`);
  return { success: true };
}
