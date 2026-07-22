"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function createCost(input: {
  id: string;
  project_id: string | null;
  client_id: string | null;
  product_id: string | null;
  category: string;
  description: string;
  amount: number;
  currency: string;
  fx_rate: number;
  amount_gbp: number;
  direction: string;
  cost_type: string;
  billable_to_client: boolean;
  paid_by: string;
  date_paid: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("costs").insert({ agency_id: ctx.agency.id, ...input });
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}

export async function updateCost(id: string, patch: {
  category: string;
  description: string;
  amount: number;
  currency: string;
  fx_rate: number;
  amount_gbp: number;
  cost_type: string;
  billable_to_client: boolean;
  paid_by: string;
  date_paid: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("costs").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}

export async function softDeleteCost(id: string, reason: string | null): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
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
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("costs")
    .update({ deleted_at: null, deleted_reason: null })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}

export async function purgeCost(id: string): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  // Permanent hard-delete. Only callable from the trash view, on already
  // soft-deleted rows.
  const { error } = await supabase.from("costs").delete().eq("id", id).not("deleted_at", "is", null);
  if (error) return { success: false, error: error.message };
  revalidatePath("/costs");
  return { success: true };
}
