"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import type { PricingInputs } from "@/lib/pricing";

export interface PriceSheet extends PricingInputs {
  id: string;
  workspace_id: string;
  product_id: string | null;
  name: string;
  chosen_price: number | null;
  notes: string | null;
  updated_at: string;
}

// The database uses snake_case and the pricing engine uses camelCase.
// Mapping in one place beats sprinkling conversions through the UI.
const TO_DB: Record<string, string> = {
  otherPerUnit: "other_per_unit",
  dutyPct: "duty_pct",
  discountPct: "discount_pct",
  paymentFeePct: "payment_fee_pct",
  returnsPct: "returns_pct",
  fulfilmentPerUnit: "fulfilment_per_unit",
  targetMarginPct: "target_margin_pct",
  wholesaleMultiple: "wholesale_multiple",
  retailMultiple: "retail_multiple",
};

type Row = Record<string, unknown>;

const num = (v: unknown): number | null =>
  v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

function fromRow(row: Row): PriceSheet {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    product_id: (row.product_id as string) ?? null,
    name: String(row.name ?? "Untitled style"),
    currency: String(row.currency ?? "USD"),
    quantity: Number(row.quantity ?? 100),
    materials: num(row.materials),
    trims: num(row.trims),
    labour: num(row.labour),
    packaging: num(row.packaging),
    otherPerUnit: num(row.other_per_unit),
    freight: num(row.freight),
    dutyPct: num(row.duty_pct),
    sampling: num(row.sampling),
    tooling: num(row.tooling),
    discountPct: num(row.discount_pct),
    paymentFeePct: num(row.payment_fee_pct),
    returnsPct: num(row.returns_pct),
    fulfilmentPerUnit: num(row.fulfilment_per_unit),
    targetMarginPct: num(row.target_margin_pct),
    wholesaleMultiple: num(row.wholesale_multiple),
    retailMultiple: num(row.retail_multiple),
    chosen_price: num(row.chosen_price),
    notes: (row.notes as string) ?? null,
    updated_at: String(row.updated_at),
  };
}

function toRow(patch: Partial<PriceSheet>): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id" || key === "workspace_id" || key === "updated_at") continue;
    out[TO_DB[key] ?? key] = value;
  }
  return out;
}

export async function listPriceSheets(workspaceId: string): Promise<PriceSheet[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("brand_price_sheets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map(fromRow);
}

interface Base {
  workspace_id: string;
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
}

export async function createPriceSheet(
  input: Base & { name?: string; currency?: string },
): Promise<{ success: true; sheet: PriceSheet } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "cost.edit", input.mode)) {
    return { success: false, error: "You don't have permission to edit pricing" };
  }

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("brand_price_sheets")
    .insert({
      workspace_id: input.workspace_id,
      name: input.name?.trim() || "Untitled style",
      currency: input.currency || "USD",
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not create the sheet" };
  revalidatePath(`/app/${input.workspace_slug}/pricing`);
  return { success: true, sheet: fromRow(data) };
}

export async function updatePriceSheet(
  input: Base & { id: string; patch: Partial<PriceSheet> },
): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "cost.edit", input.mode)) {
    return { success: false, error: "You don't have permission to edit pricing" };
  }

  const supabase = await getBrandSupabase();
  // Scoped to the workspace as well as the id — RLS would catch a mismatch,
  // but the extra clause means a wrong id updates nothing instead of erroring.
  const { error } = await supabase
    .from("brand_price_sheets")
    .update(toRow(input.patch))
    .eq("id", input.id)
    .eq("workspace_id", input.workspace_id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/app/${input.workspace_slug}/pricing`);
  return { success: true };
}

export async function deletePriceSheet(
  input: Base & { id: string },
): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "cost.edit", input.mode)) {
    return { success: false, error: "You don't have permission to edit pricing" };
  }

  const supabase = await getBrandSupabase();
  const { error } = await supabase
    .from("brand_price_sheets")
    .delete()
    .eq("id", input.id)
    .eq("workspace_id", input.workspace_id);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/app/${input.workspace_slug}/pricing`);
  return { success: true };
}
