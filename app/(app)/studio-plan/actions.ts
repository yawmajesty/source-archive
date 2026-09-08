"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import {
  anglesFor, LAUNCH_PLAN, ALWAYS_ON_PLAN, phaseDate,
  type ShootType, type Phase,
} from "@/lib/shoots";

async function editor() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    throw new Error("You don't have permission to plan shoots");
  }
  return ctx;
}

export interface ShootRow {
  id: string; client_id: string; project_id: string | null;
  title: string; shoot_type: ShootType; status: string;
  shoot_date: string | null; location: string | null;
  [key: string]: unknown;
}

export interface ShotRow {
  id: string; shoot_id: string; product_id: string | null;
  angle: string; medium: string; description: string | null;
  reference_url: string | null; position: number; done: boolean;
}

export interface RefRow {
  id: string; shoot_id: string; slot: string; image_url: string;
  storage_path: string | null; note: string | null; position: number;
}

// ── Shoots ────────────────────────────────────────────────────

export async function listShoots(): Promise<ShootRow[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("shoots").select("*").order("shoot_date", { ascending: false, nullsFirst: false });
  return (data ?? []) as ShootRow[];
}

export async function getShoot(
  id: string,
): Promise<{ shoot: ShootRow; shots: ShotRow[]; refs: RefRow[]; productIds: string[] } | null> {
  const ctx = await getAgencyContext();
  if (!ctx) return null;
  const supabase = await getAgencySupabase();

  const { data: shoot } = await supabase.from("shoots").select("*").eq("id", id).maybeSingle();
  if (!shoot) return null;

  const [shots, refs, products] = await Promise.all([
    supabase.from("shoot_shots").select("*").eq("shoot_id", id).order("position"),
    supabase.from("shoot_references").select("*").eq("shoot_id", id).order("position"),
    supabase.from("shoot_products").select("product_id").eq("shoot_id", id),
  ]);

  return {
    shoot: shoot as ShootRow,
    shots: (shots.data ?? []) as ShotRow[],
    refs: (refs.data ?? []) as RefRow[],
    productIds: ((products.data ?? []) as Array<{ product_id: string }>).map((p) => p.product_id),
  };
}

/**
 * Create a shoot, pre-filled with the standard shot list for its type.
 *
 * A blank shot list teaches a brand owner nothing about what a
 * photographer needs. Starting from the real list makes the first
 * version an edit rather than an authoring job.
 */
export async function createShoot(input: {
  clientId: string;
  projectId?: string | null;
  title: string;
  shootType: ShootType;
  seedShotList?: boolean;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("shoots")
    .insert({
      agency_id: ctx.agency.id,
      client_id: input.clientId,
      project_id: input.projectId || null,
      title: input.title.trim() || "Untitled shoot",
      shoot_type: input.shootType,
      created_by: ctx.currentUserId,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not create the shoot" };
  const shootId = (data as { id: string }).id;

  if (input.seedShotList !== false) {
    const angles = anglesFor(input.shootType);
    await supabase.from("shoot_shots").insert(
      angles.map((a, i) => ({
        agency_id: ctx.agency.id,
        shoot_id: shootId,
        angle: a.angle,
        medium: a.medium,
        description: a.description,
        position: i,
      })),
    );
  }

  revalidatePath("/studio-plan");
  return { success: true, id: shootId };
}

export async function updateShoot(
  id: string,
  patch: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try { await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  const supabase = await getAgencySupabase();
  // Never let a caller move a shoot to another agency or client.
  const { agency_id, client_id, id: _id, ...safe } = patch as Record<string, unknown>;
  void agency_id; void client_id; void _id;
  const { error } = await supabase.from("shoots").update(safe).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/studio-plan");
  return { success: true };
}

export async function deleteShoot(id: string): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoots").delete().eq("id", id);
  revalidatePath("/studio-plan");
  return { success: true };
}

// ── Shot list ─────────────────────────────────────────────────

export async function addShot(input: {
  shootId: string; angle: string; medium?: string; description?: string | null; position: number;
}): Promise<{ success: true; shot: ShotRow } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("shoot_shots")
    .insert({
      agency_id: ctx.agency.id,
      shoot_id: input.shootId,
      angle: input.angle.trim() || "Untitled shot",
      medium: input.medium === "video" ? "video" : "photo",
      description: input.description?.trim() || null,
      position: input.position,
    })
    .select()
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Could not add the shot" };
  return { success: true, shot: data as ShotRow };
}

export async function updateShot(
  id: string,
  patch: Partial<Pick<ShotRow, "angle" | "medium" | "description" | "reference_url" | "done" | "position" | "product_id">>,
): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_shots").update(patch).eq("id", id);
  return { success: true };
}

export async function deleteShot(id: string): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_shots").delete().eq("id", id);
  return { success: true };
}

// ── Reference images ──────────────────────────────────────────

export async function addReferences(input: {
  shootId: string;
  slot: string;
  items: Array<{ image_url: string; storage_path?: string | null; note?: string | null }>;
}): Promise<{ success: true; refs: RefRow[] } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("shoot_references")
    .insert(
      input.items.map((i, n) => ({
        agency_id: ctx.agency.id,
        shoot_id: input.shootId,
        slot: input.slot,
        image_url: i.image_url,
        storage_path: i.storage_path ?? null,
        note: i.note ?? null,
        position: n,
      })),
    )
    .select();
  if (error) return { success: false, error: error.message };
  return { success: true, refs: (data ?? []) as RefRow[] };
}

export async function deleteReference(id: string): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_references").delete().eq("id", id);
  return { success: true };
}

// ── Products on the call sheet ────────────────────────────────

export async function setShootProducts(
  shootId: string,
  productIds: string[],
): Promise<{ success: boolean }> {
  let ctx;
  try { ctx = await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_products").delete().eq("shoot_id", shootId);
  if (productIds.length > 0) {
    await supabase.from("shoot_products").insert(
      productIds.map((id) => ({ agency_id: ctx.agency.id, shoot_id: shootId, product_id: id })),
    );
  }
  revalidatePath("/studio-plan");
  return { success: true };
}

// ── Templates ─────────────────────────────────────────────────

export interface TemplateRow {
  id: string; name: string; category: string | null; shoot_type: string;
  payload: Record<string, unknown>;
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("shoot_templates").select("*").order("name");
  return (data ?? []) as TemplateRow[];
}

/** Freeze a shoot's brief and shot list so the next one starts there. */
export async function saveAsTemplate(input: {
  shootId: string; name: string; category?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  if (!input.name.trim()) return { success: false, error: "Give the template a name" };

  const detail = await getShoot(input.shootId);
  if (!detail) return { success: false, error: "Shoot not found" };

  // Deliberately excludes the date, location, crew and products — those
  // are what changes between two shoots of the same kind. What carries
  // over is the thinking.
  const { shoot, shots, refs } = detail;
  const payload = {
    brief: {
      objective: shoot.objective, photo_style: shoot.photo_style, video_style: shoot.video_style,
      model_style: shoot.model_style, hair_makeup: shoot.hair_makeup, styling_notes: shoot.styling_notes,
      lighting_notes: shoot.lighting_notes, background: shoot.background,
      retouching: shoot.retouching, deliverables: shoot.deliverables, usage_rights: shoot.usage_rights,
    },
    shots: shots.map((s) => ({ angle: s.angle, medium: s.medium, description: s.description })),
    refs: refs.map((r) => ({ slot: r.slot, image_url: r.image_url, note: r.note })),
  };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("shoot_templates").insert({
    agency_id: ctx.agency.id,
    name: input.name.trim(),
    category: input.category?.trim() || null,
    shoot_type: shoot.shoot_type,
    payload,
    created_by: ctx.currentUserId,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/studio-plan");
  return { success: true };
}

/** Apply a template over a shoot, replacing the brief and the shot list. */
export async function applyTemplate(
  shootId: string,
  templateId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getAgencySupabase();
  const { data: tpl } = await supabase
    .from("shoot_templates").select("payload").eq("id", templateId).maybeSingle();
  const payload = (tpl as { payload: Record<string, unknown> } | null)?.payload;
  if (!payload) return { success: false, error: "Template not found" };

  const brief = (payload.brief ?? {}) as Record<string, unknown>;
  await supabase.from("shoots").update(brief).eq("id", shootId);

  const shots = (payload.shots ?? []) as Array<{ angle: string; medium: string; description: string | null }>;
  await supabase.from("shoot_shots").delete().eq("shoot_id", shootId);
  if (shots.length) {
    await supabase.from("shoot_shots").insert(
      shots.map((s, i) => ({
        agency_id: ctx.agency.id, shoot_id: shootId,
        angle: s.angle, medium: s.medium === "video" ? "video" : "photo",
        description: s.description, position: i,
      })),
    );
  }

  const refs = (payload.refs ?? []) as Array<{ slot: string; image_url: string; note: string | null }>;
  if (refs.length) {
    await supabase.from("shoot_references").insert(
      refs.map((r, i) => ({
        agency_id: ctx.agency.id, shoot_id: shootId,
        slot: r.slot, image_url: r.image_url, note: r.note, position: i,
      })),
    );
  }

  revalidatePath("/studio-plan");
  return { success: true };
}

// ── Marketing ─────────────────────────────────────────────────

export interface CampaignRow {
  id: string; client_id: string; project_id: string | null;
  name: string; kind: string; launch_date: string | null;
  objective: string | null; audience: string | null; notes: string | null;
}

export interface CampaignItemRow {
  id: string; campaign_id: string; phase: Phase; channel: string;
  title: string; brief: string | null; owner: string | null;
  due_date: string | null; status: string; position: number;
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("campaigns").select("*").order("launch_date", { ascending: false, nullsFirst: false });
  return (data ?? []) as CampaignRow[];
}

export async function getCampaignItems(campaignId: string): Promise<CampaignItemRow[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("campaign_items").select("*").eq("campaign_id", campaignId)
    .order("phase").order("position");
  return (data ?? []) as CampaignItemRow[];
}

/**
 * Create a campaign, optionally laid out from the standard plan.
 *
 * With a launch date the whole run gets dated automatically from each
 * phase's offset — a teaser three weeks out, the drop, remarketing three
 * weeks after. Handing someone a dated plan to argue with beats handing
 * them an empty calendar.
 */
export async function createCampaign(input: {
  clientId: string;
  projectId?: string | null;
  name: string;
  kind: "collection" | "always_on";
  launchDate?: string | null;
  seedPlan?: boolean;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      agency_id: ctx.agency.id,
      client_id: input.clientId,
      project_id: input.kind === "always_on" ? null : input.projectId || null,
      name: input.name.trim() || "Untitled campaign",
      kind: input.kind,
      launch_date: input.launchDate || null,
      created_by: ctx.currentUserId,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not create the campaign" };
  const id = (data as { id: string }).id;

  if (input.seedPlan !== false) {
    const rows =
      input.kind === "always_on"
        ? ALWAYS_ON_PLAN.map((p, i) => ({
            agency_id: ctx.agency.id, campaign_id: id,
            phase: "always_on" as Phase, channel: p.channel,
            title: p.title, brief: p.brief, position: i,
          }))
        : LAUNCH_PLAN.map((p, i) => ({
            agency_id: ctx.agency.id, campaign_id: id,
            phase: p.phase, channel: p.channel,
            title: p.title, brief: p.brief, position: i,
            due_date: phaseDate(input.launchDate ?? null, p.phase),
          }));
    await supabase.from("campaign_items").insert(rows);
  }

  revalidatePath("/studio-plan");
  return { success: true, id };
}

export async function updateCampaign(
  id: string,
  patch: Record<string, unknown>,
): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  const { agency_id, client_id, id: _id, ...safe } = patch as Record<string, unknown>;
  void agency_id; void client_id; void _id;
  await supabase.from("campaigns").update(safe).eq("id", id);
  revalidatePath("/studio-plan");
  return { success: true };
}

export async function deleteCampaign(id: string): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("campaigns").delete().eq("id", id);
  revalidatePath("/studio-plan");
  return { success: true };
}

export async function addCampaignItem(input: {
  campaignId: string; phase: Phase; channel: string; title: string; position: number;
}): Promise<{ success: true; item: CampaignItemRow } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("campaign_items")
    .insert({
      agency_id: ctx.agency.id,
      campaign_id: input.campaignId,
      phase: input.phase,
      channel: input.channel,
      title: input.title.trim() || "Untitled",
      position: input.position,
    })
    .select()
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Could not add" };
  return { success: true, item: data as CampaignItemRow };
}

export async function updateCampaignItem(
  id: string,
  patch: Partial<CampaignItemRow>,
): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  const { id: _id, campaign_id, ...safe } = patch as Record<string, unknown>;
  void _id; void campaign_id;
  await supabase.from("campaign_items").update(safe).eq("id", id);
  return { success: true };
}

export async function deleteCampaignItem(id: string): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("campaign_items").delete().eq("id", id);
  return { success: true };
}

// ── Sample readiness ──────────────────────────────────────────

export interface Readiness {
  productId: string;
  name: string;
  stage: string | null;
  ready: boolean;
}

/**
 * Whether the garments on the call sheet actually exist yet.
 *
 * The commonest reason a shoot gets rebooked is a sample not turning up,
 * and the system already knows each product's stage. A shoot that says
 * "booked" while a garment on its list is still being cut is a shoot
 * about to be moved.
 */
const READY_STAGES = new Set(["review", "approved", "revision", "production", "shipped", "qc"]);

export async function shootReadiness(shootId: string): Promise<Readiness[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();

  const { data: links } = await supabase
    .from("shoot_products").select("product_id").eq("shoot_id", shootId);
  const ids = ((links ?? []) as Array<{ product_id: string }>).map((l) => l.product_id);
  if (ids.length === 0) return [];

  const { data: products } = await supabase
    .from("products").select("id, name, stage").in("id", ids);

  return ((products ?? []) as Array<{ id: string; name: string | null; stage: string | null }>).map((p) => ({
    productId: p.id,
    name: p.name ?? "Unnamed",
    stage: p.stage,
    ready: READY_STAGES.has(p.stage ?? ""),
  }));
}

// ── Delivered assets ──────────────────────────────────────────

export interface AssetRow {
  id: string; shoot_id: string; product_id: string | null;
  image_url: string; storage_path: string | null;
  kind: string; caption: string | null; released: boolean; position: number;
}

export async function listAssets(shootId: string): Promise<AssetRow[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("shoot_assets").select("*").eq("shoot_id", shootId).order("position");
  return (data ?? []) as AssetRow[];
}

export async function addAssets(input: {
  shootId: string;
  items: Array<{ image_url: string; storage_path?: string | null; kind?: string; product_id?: string | null }>;
}): Promise<{ success: true; assets: AssetRow[] } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("shoot_assets")
    .insert(
      input.items.map((i, n) => ({
        agency_id: ctx.agency.id,
        shoot_id: input.shootId,
        image_url: i.image_url,
        storage_path: i.storage_path ?? null,
        kind: i.kind === "video" ? "video" : "photo",
        product_id: i.product_id ?? null,
        position: n,
      })),
    )
    .select();
  if (error) return { success: false, error: error.message };
  return { success: true, assets: (data ?? []) as AssetRow[] };
}

export async function updateAsset(
  id: string,
  patch: Partial<Pick<AssetRow, "caption" | "released" | "product_id">>,
): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_assets").update(patch).eq("id", id);
  revalidatePath("/studio-plan");
  return { success: true };
}

export async function deleteAsset(id: string): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_assets").delete().eq("id", id);
  return { success: true };
}

/**
 * Push released shots onto the products they belong to.
 *
 * The point of a shoot is that the images end up somewhere. Without this
 * the brief is a nicely organised dead end — the assets sit in the shoot
 * and the product page still shows nothing.
 */
export async function pushAssetsToProducts(
  shootId: string,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getAgencySupabase();
  const { data: assets } = await supabase
    .from("shoot_assets").select("*").eq("shoot_id", shootId).eq("released", true);

  const rows = ((assets ?? []) as AssetRow[]).filter((a) => a.product_id);
  if (rows.length === 0) {
    return { success: false, error: "Nothing to push — release some shots and tag them to a product first." };
  }

  // product_media is the same table the portal reads, so a pushed image
  // appears to the client immediately without a second copy anywhere.
  const { error } = await supabase.from("product_media").insert(
    rows.map((a) => ({
      agency_id: ctx.agency.id,
      product_id: a.product_id,
      url: a.image_url,
      kind: a.kind === "video" ? "video" : "image",
      caption: a.caption,
      uploaded_by_role: "agency",
      uploaded_by_name: "Shoot",
      // Only released assets get here, and released means the client may
      // see them — so say so rather than relying on a column default.
      visible_to_client: true,
    })),
  );
  if (error) return { success: false, error: error.message };

  revalidatePath("/studio-plan");
  return { success: true, count: rows.length };
}

// ── Budget → cost tracker ─────────────────────────────────────

/**
 * Record a shoot or campaign budget as a real cost.
 *
 * cost_id is stamped on the row so pressing the button twice can't bill
 * the client twice — the second press updates the entry it already made.
 */
export async function pushBudgetToCosts(
  kind: "shoot" | "campaign",
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const table = kind === "shoot" ? "shoots" : "campaigns";
  const supabase = await getAgencySupabase();
  const { data: row } = await supabase
    .from(table)
    .select("id, title, name, budget, currency, project_id, client_id, cost_id")
    .eq("id", id)
    .maybeSingle();

  const r = row as Record<string, unknown> | null;
  if (!r) return { success: false, error: "Not found" };

  const amount = Number(r.budget ?? 0);
  if (!amount) return { success: false, error: "Set a budget first" };
  if (!r.project_id) return { success: false, error: "Attach it to a collection first — costs hang off a collection." };

  const label = String(r.title ?? r.name ?? "Untitled");
  const payload = {
    agency_id: ctx.agency.id,
    project_id: r.project_id as string,
    category: kind === "shoot" ? "Photography" : "Marketing",
    description: `${kind === "shoot" ? "Shoot" : "Campaign"} — ${label}`,
    amount,
    currency: (r.currency as string) ?? "GBP",
    // The column is billable_to_client, not billable — a shoot billed on
    // to the brand is the normal case for an agency.
    billable_to_client: true,
    client_id: (r.client_id as string) ?? null,
  };

  if (r.cost_id) {
    const { error } = await supabase.from("costs").update(payload).eq("id", r.cost_id as string);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  const { data: created, error } = await supabase.from("costs").insert(payload).select("id").single();
  if (error || !created) return { success: false, error: error?.message ?? "Could not record the cost" };

  await supabase.from(table).update({ cost_id: (created as { id: string }).id }).eq("id", id);
  revalidatePath("/costs");
  revalidatePath("/studio-plan");
  return { success: true };
}

/** Let the client see the brief, the way the production log is released. */
export async function setSharedWithClient(
  kind: "shoot" | "campaign",
  id: string,
  shared: boolean,
): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from(kind === "shoot" ? "shoots" : "campaigns")
    .update({ shared_with_client: shared }).eq("id", id);
  revalidatePath("/studio-plan");
  return { success: true };
}
