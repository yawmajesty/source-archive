"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import type { Fabric } from "@/lib/fabrics";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function listFabrics(): Promise<Fabric[]> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("fabrics").select("*").order("name");
  return (data ?? []) as Fabric[];
}

export async function saveFabric(
  input: Partial<Fabric> & { name: string; category: string },
): Promise<{ success: true; fabric: Fabric } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  if (!input.name.trim()) return { success: false, error: "Give the fabric a name" };

  const supabase = await getAgencySupabase();

  // Allocate the code once, on creation. It is the durable identifier a tech
  // pack or PO will quote, so it never changes afterwards — not even if the
  // fabric is later re-tiered or re-categorised.
  let code = input.code ?? null;
  if (!input.id && !code) {
    const { data: generated, error: codeError } = await supabase.rpc("next_fabric_code", {
      ag_id: ctx.agency.id,
      p_tier: input.tier ?? "standard",
      p_cat: input.category_code ?? "OTH",
    });
    if (codeError) return { success: false, error: `Could not allocate a code: ${codeError.message}` };
    code = generated as string;
  }

  const row = {
    agency_id: ctx.agency.id,
    name: input.name.trim(),
    code,
    tier: input.tier ?? "standard",
    category: input.category,
    category_code: input.category_code ?? null,
    composition: input.composition ?? null,
    gsm: input.gsm ?? null,
    width_cm: input.width_cm ?? null,
    usable_width_cm: input.usable_width_cm ?? null,
    suitable_for: input.suitable_for ?? [],
    use_notes: input.use_notes ?? null,
    mill: input.mill ?? null,
    hand_feel: input.hand_feel ?? null,
    stretch: input.stretch ?? null,
    drape: input.drape ?? null,
    price_per_unit_usd: input.price_per_unit_usd ?? null,
    price_unit: input.price_unit ?? "metre",
    price_band: input.price_band ?? null,
    moq: input.moq ?? null,
    moq_unit: input.moq_unit ?? "metre",
    lead_time_days: input.lead_time_days ?? null,
    stock_status: input.stock_status ?? "made_to_order",
    consumption_per_unit: input.consumption_per_unit ?? null,
    sustainability: input.sustainability ?? [],
    swatch_url: input.swatch_url ?? null,
    notes: input.notes ?? null,
    our_cost_usd: input.our_cost_usd ?? null,
    mill_notes: input.mill_notes ?? null,
  };

  const query = input.id
    ? supabase.from("fabrics").update(row).eq("id", input.id).select().single()
    : supabase.from("fabrics").insert(row).select().single();

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  revalidatePath("/fabrics");
  return { success: true, fabric: data as Fabric };
}

export async function setFabricPublished(
  ids: string[],
  published: boolean,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await ctxOrThrow();
  if (ctx.role !== "admin" && ctx.role !== "team") {
    return { success: false, error: "Only admins can publish fabrics" };
  }
  if (!ids.length) return { success: true };

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("fabrics")
    .update({ is_published: published, published_at: published ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) return { success: false, error: error.message };
  revalidatePath("/fabrics");
  return { success: true };
}

export async function deleteFabric(id: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await ctxOrThrow();
  if (ctx.role !== "admin" && ctx.role !== "team") {
    return { success: false, error: "Only admins can delete fabrics" };
  }
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("fabrics").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/fabrics");
  return { success: true };
}

// ── Fabric photos ────────────────────────────────────────────────
// One swatch image isn't enough to judge a fabric: a brand needs the flat
// swatch, the drape, the surface up close, and a garment made from it.

export interface FabricPhoto {
  id: string;
  fabric_id: string;
  url: string;
  kind: "image" | "video";
  shot: "texture" | "color" | "swatch" | "drape" | "detail" | "garment" | "other";
  caption: string | null;
  position: number;
  created_at: string;
}

export async function listFabricPhotos(fabricId: string): Promise<FabricPhoto[]> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("fabric_media")
    .select("*")
    .eq("fabric_id", fabricId)
    .order("position")
    .order("created_at");
  return (data ?? []) as FabricPhoto[];
}

export async function addFabricPhotos(
  fabricId: string,
  items: { url: string; kind: "image" | "video"; shot?: FabricPhoto["shot"]; caption?: string | null }[],
): Promise<{ success: true; photos: FabricPhoto[] } | { success: false; error: string }> {
  await ctxOrThrow();
  if (!items.length) return { success: false, error: "Nothing to add" };
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("fabric_media")
    .upsert(
      items.map((it, i) => ({
        fabric_id: fabricId,
        url: it.url,
        kind: it.kind,
        shot: it.shot ?? "texture",
        caption: it.caption ?? null,
        position: i,
      })),
      { onConflict: "fabric_id,url" },
    )
    .select();
  if (error) return { success: false, error: error.message };
  revalidatePath("/fabrics");
  return { success: true, photos: (data ?? []) as FabricPhoto[] };
}

export async function deleteFabricPhoto(id: string): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("fabric_media").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/fabrics");
  return { success: true };
}

// ── Fabrics on products ───────────────────────────────────────

export interface FabricProductLink {
  fabric_id: string;
  product_id: string;
  product_name: string;
  project_name: string | null;
  client_name: string | null;
}

/**
 * Which garments use a fabric.
 *
 * The library was write-only: you could catalogue a cloth and never
 * record that anything was made from it, which is the one question worth
 * asking of a fabric archive — "what did we use this on?"
 */
export async function listFabricProducts(fabricId: string): Promise<FabricProductLink[]> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();

  const { data: links } = await supabase
    .from("fabric_products").select("product_id").eq("fabric_id", fabricId);
  const ids = ((links ?? []) as Array<{ product_id: string }>).map((l) => l.product_id);
  if (ids.length === 0) return [];

  const { data: products } = await supabase
    .from("products").select("id, name, project_id").in("id", ids);
  const rows = (products ?? []) as Array<{ id: string; name: string | null; project_id: string | null }>;

  const projectIds = rows.map((r) => r.project_id).filter(Boolean) as string[];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id, name, client_id").in("id", projectIds)
    : { data: [] };
  const projectMap = new Map(
    ((projects ?? []) as Array<{ id: string; name: string; client_id: string }>).map((p) => [p.id, p]),
  );

  const clientIds = Array.from(projectMap.values()).map((p) => p.client_id);
  const { data: clients } = clientIds.length
    ? await supabase.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const clientMap = new Map(((clients ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));

  return rows.map((r) => {
    const project = r.project_id ? projectMap.get(r.project_id) : undefined;
    return {
      fabric_id: fabricId,
      product_id: r.id,
      product_name: r.name ?? "Unnamed",
      project_name: project?.name ?? null,
      client_name: project ? clientMap.get(project.client_id) ?? null : null,
    };
  });
}

/** Products to choose from, grouped enough to be pickable. */
export async function listProductsForFabric(): Promise<
  Array<{ id: string; name: string; project: string | null; client: string | null }>
> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();

  const [products, projects, clients] = await Promise.all([
    supabase.from("products").select("id, name, project_id").order("name").limit(500),
    supabase.from("projects").select("id, name, client_id"),
    supabase.from("clients").select("id, name"),
  ]);

  const projectMap = new Map(
    ((projects.data ?? []) as Array<{ id: string; name: string; client_id: string }>).map((p) => [p.id, p]),
  );
  const clientMap = new Map(
    ((clients.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );

  return ((products.data ?? []) as Array<{ id: string; name: string | null; project_id: string | null }>).map((p) => {
    const project = p.project_id ? projectMap.get(p.project_id) : undefined;
    return {
      id: p.id,
      name: p.name ?? "Unnamed",
      project: project?.name ?? null,
      client: project ? clientMap.get(project.client_id) ?? null : null,
    };
  });
}

export async function linkFabricToProduct(
  fabricId: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  // Composite primary key, so re-adding the same pair is a no-op rather
  // than a duplicate or an error the user has to read.
  const { error } = await supabase
    .from("fabric_products")
    .upsert({ fabric_id: fabricId, product_id: productId }, { onConflict: "fabric_id,product_id" });
  if (error) return { success: false, error: error.message };
  revalidatePath("/fabrics");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function unlinkFabricFromProduct(
  fabricId: string,
  productId: string,
): Promise<{ success: boolean }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("fabric_products").delete()
    .eq("fabric_id", fabricId).eq("product_id", productId);
  revalidatePath("/fabrics");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/** The other direction: what a product is made from. */
export async function listProductFabrics(productId: string): Promise<Fabric[]> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data: links } = await supabase
    .from("fabric_products").select("fabric_id").eq("product_id", productId);
  const ids = ((links ?? []) as Array<{ fabric_id: string }>).map((l) => l.fabric_id);
  if (ids.length === 0) return [];
  const { data } = await supabase.from("fabrics").select("*").in("id", ids).order("name");
  return (data ?? []) as Fabric[];
}
