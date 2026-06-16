"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";

export async function softDeleteCost(id: string, reason: string | null): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("costs")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_reason: reason && reason.trim() ? reason.trim() : null,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}

export async function restoreCost(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("costs")
    .update({ deleted_at: null, deleted_reason: null })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}

export async function purgeCost(id: string): Promise<{ success: boolean; error?: string }> {
  // Permanent hard-delete. Only callable from the trash view, on already
  // soft-deleted rows.
  const { error } = await supabase.from("costs").delete().eq("id", id).not("deleted_at", "is", null);
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}
