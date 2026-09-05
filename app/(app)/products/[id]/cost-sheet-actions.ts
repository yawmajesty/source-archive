"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import type { CostSheet, CostSheetLine, CostSection } from "@/lib/cost-sheet";

async function costCtxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  if (!can(ctx.role, ctx.permissions, "cost.view")) {
    throw new Error("You don't have permission to see costing");
  }
  return ctx;
}

export async function listCostSheets(productId: string): Promise<CostSheet[]> {
  const ctx = await getAgencyContext();
  if (!ctx || !can(ctx.role, ctx.permissions, "cost.view")) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("product_cost_sheets")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CostSheet[];
}

export async function getCostSheetLines(sheetId: string): Promise<CostSheetLine[]> {
  const ctx = await getAgencyContext();
  if (!ctx || !can(ctx.role, ctx.permissions, "cost.view")) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("cost_sheet_lines")
    .select("*")
    .eq("sheet_id", sheetId)
    .order("section")
    .order("position");
  return (data ?? []) as CostSheetLine[];
}

/** A new sheet starts with the skeleton of a garment, not an empty table. */
export async function createCostSheet(
  productId: string,
  quantity = 100,
): Promise<{ success: true; sheet: CostSheet } | { success: false; error: string }> {
  const ctx = await costCtxOrThrow();
  const supabase = await getAgencySupabase();

  const { data, error } = await supabase
    .from("product_cost_sheets")
    .insert({ agency_id: ctx.agency.id, product_id: productId, quantity })
    .select()
    .single();
  if (error) return { success: false, error: error.message };

  const sheet = data as CostSheet;
  const starter: { section: CostSection; label: string; unit: string; position: number }[] = [
    { section: "shell",  label: "Shell fabric A", unit: "metre", position: 0 },
    { section: "shell",  label: "Shell fabric B", unit: "metre", position: 1 },
    { section: "lining", label: "Lining",         unit: "metre", position: 0 },
    { section: "trim",   label: "Main zip",       unit: "piece", position: 0 },
    { section: "trim",   label: "Labels",         unit: "set",   position: 1 },
  ];
  await supabase.from("cost_sheet_lines").insert(starter.map((l) => ({ ...l, sheet_id: sheet.id })));

  revalidatePath(`/products/${productId}`);
  return { success: true, sheet };
}

export async function updateCostSheet(
  sheetId: string,
  productId: string,
  patch: Partial<CostSheet>,
): Promise<{ success: boolean; error?: string }> {
  await costCtxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("product_cost_sheets").update(patch).eq("id", sheetId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function upsertLine(
  sheetId: string,
  line: Partial<CostSheetLine> & { label: string; section: CostSection },
): Promise<{ success: true; line: CostSheetLine } | { success: false; error: string }> {
  await costCtxOrThrow();
  const supabase = await getAgencySupabase();
  const row = {
    sheet_id: sheetId,
    section: line.section,
    label: line.label,
    supplier: line.supplier ?? null,
    item_number: line.item_number ?? null,
    composition: line.composition ?? null,
    unit_price: line.unit_price ?? null,
    unit: line.unit ?? "metre",
    consumption: line.consumption ?? null,
    position: line.position ?? 0,
    notes: line.notes ?? null,
  };
  const query = line.id
    ? supabase.from("cost_sheet_lines").update(row).eq("id", line.id).select().single()
    : supabase.from("cost_sheet_lines").insert(row).select().single();
  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, line: data as CostSheetLine };
}

export async function deleteLine(id: string): Promise<{ success: boolean; error?: string }> {
  await costCtxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("cost_sheet_lines").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Push a fabric line into the library.
 *
 * The point of capturing supplier, item number and composition on a cost
 * sheet is that it's the same data the library wants — so it shouldn't have
 * to be typed twice. Re-saving the same line updates its fabric rather than
 * creating a second one.
 */
export async function saveLineToFabricLibrary(
  lineId: string,
): Promise<{ success: true; fabricId: string; code: string | null } | { success: false; error: string }> {
  const ctx = await costCtxOrThrow();
  const supabase = await getAgencySupabase();

  const { data: line } = await supabase.from("cost_sheet_lines").select("*").eq("id", lineId).maybeSingle();
  if (!line) return { success: false, error: "That line no longer exists" };
  const l = line as CostSheetLine;
  if (!l.composition?.trim()) return { success: false, error: "Add the composition before saving to the library" };

  const payload = {
    name: l.label.trim(),
    composition: l.composition.trim(),
    mill: l.supplier?.trim() || null,
    notes: l.item_number ? `Supplier item ${l.item_number}` : null,
    price_per_unit_usd: l.unit_price ?? null,
    price_unit: (["metre", "yard", "sqft", "kg"].includes(l.unit) ? l.unit : "metre") as string,
    consumption_per_unit: l.consumption ?? null,
  };

  if (l.fabric_id) {
    const { error } = await supabase.from("fabrics").update(payload).eq("id", l.fabric_id);
    if (error) return { success: false, error: error.message };
    const { data: f } = await supabase.from("fabrics").select("code").eq("id", l.fabric_id).maybeSingle();
    return { success: true, fabricId: l.fabric_id, code: (f as { code: string } | null)?.code ?? null };
  }

  // New fabric: allocate a code the same way the library does.
  const { data: code, error: codeError } = await supabase.rpc("next_fabric_code", {
    ag_id: ctx.agency.id,
    p_tier: "standard",
    p_cat: "OTH",
  });
  if (codeError) return { success: false, error: `Could not allocate a fabric code: ${codeError.message}` };

  const { data: fabric, error } = await supabase
    .from("fabrics")
    .insert({
      agency_id: ctx.agency.id,
      code,
      tier: "standard",
      category: "Cotton / Linen Base Woven",
      category_code: "OTH",
      is_published: false,
      ...payload,
    })
    .select()
    .single();
  if (error) return { success: false, error: error.message };

  await supabase.from("cost_sheet_lines").update({ fabric_id: (fabric as { id: string }).id }).eq("id", lineId);
  revalidatePath("/fabrics");
  return { success: true, fabricId: (fabric as { id: string }).id, code: code as string };
}

/** Create (or rotate) the factory link. */
export async function shareWithFactory(
  sheetId: string,
  productId: string,
  factoryName: string | null,
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  await costCtxOrThrow();
  const supabase = await getAgencySupabase();
  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase
    .from("product_cost_sheets")
    .update({
      share_token: token,
      shared_at: new Date().toISOString(),
      factory_name: factoryName?.trim() || null,
      status: "awaiting_factory",
    })
    .eq("id", sheetId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true, token };
}

export async function revokeFactoryLink(
  sheetId: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  await costCtxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("product_cost_sheets")
    .update({ share_token: null, shared_at: null })
    .eq("id", sheetId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

// ── The factory's side ───────────────────────────────────────────
// No login: the token is the credential. Service role, because a factory is
// not an agency member and RLS would hide everything.

export async function getSheetByToken(token: string): Promise<
  { sheet: CostSheet; lines: CostSheetLine[]; productName: string } | null
> {
  const service = getAgencyServiceSupabase();
  const { data: sheet } = await service
    .from("product_cost_sheets")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();
  if (!sheet) return null;

  const s = sheet as CostSheet;
  if (s.share_expires_at && new Date(s.share_expires_at) < new Date()) return null;

  const [{ data: lines }, { data: product }] = await Promise.all([
    service.from("cost_sheet_lines").select("*").eq("sheet_id", s.id).order("section").order("position"),
    service.from("products").select("name").eq("id", s.product_id).maybeSingle(),
  ]);

  return {
    sheet: s,
    lines: (lines ?? []) as CostSheetLine[],
    productName: (product as { name: string } | null)?.name ?? "Product",
  };
}

/** The factory fills in prices and their own supplier detail — nothing else. */
export async function submitFactoryQuote(
  token: string,
  input: {
    lines: { id: string; unit_price: number | null; supplier: string | null; item_number: string | null; composition: string | null; notes: string | null }[];
    labor_cmt: number | null;
    labor_notes: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  const service = getAgencyServiceSupabase();
  const { data: sheet } = await service
    .from("product_cost_sheets")
    .select("id, share_token, share_expires_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!sheet) return { success: false, error: "This link is no longer valid" };

  const s = sheet as { id: string; share_expires_at: string | null };
  if (s.share_expires_at && new Date(s.share_expires_at) < new Date()) {
    return { success: false, error: "This link has expired" };
  }

  for (const l of input.lines) {
    await service
      .from("cost_sheet_lines")
      .update({
        unit_price: l.unit_price,
        supplier: l.supplier,
        item_number: l.item_number,
        composition: l.composition,
        notes: l.notes,
      })
      .eq("id", l.id)
      .eq("sheet_id", s.id); // a token only ever edits its own sheet
  }

  const { error } = await service
    .from("product_cost_sheets")
    .update({ labor_cmt: input.labor_cmt, labor_notes: input.labor_notes, status: "received" })
    .eq("id", s.id);
  if (error) return { success: false, error: error.message };

  return { success: true };
}
