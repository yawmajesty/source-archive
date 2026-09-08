"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getAgencyContext } from "@/lib/agency-data";
import { canUseShootPlanner } from "@/lib/plan-limits";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll, clientRecipients, looksLikeEmail } from "@/lib/email/send";
import { crewCallSheet, shootBriefShared, campaignItemDue } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
import {
  anglesFor, LAUNCH_PLAN, ALWAYS_ON_PLAN, phaseDate,
  SHOOT_STATUSES, PHASE_LABEL, PHASE_TONE,
  type ShootType, type Phase, type CrewMember,
} from "@/lib/shoots";

/**
 * Who may write to the planner.
 *
 * Two kinds of caller reach these actions: agency staff, and brand
 * workspace members on a plan that includes shoot planning. They share
 * the tables, and both Supabase bridges attach the same Clerk token, so
 * row-level security is the actual boundary in both cases — a workspace
 * member updating someone else's shoot updates nothing, because the
 * policy doesn't match.
 *
 * This check is therefore about intent and about which agency_id to
 * stamp on new rows, not about isolation. Isolation is the database's
 * job and it is doing it.
 */
const PLATFORM_AGENCY = "ag-source-archive";

async function editor(): Promise<{ agency: { id: string }; currentUserId: string; scope: "agency" | "workspace" }> {
  const ctx = await getAgencyContext();
  if (ctx) {
    if (!can(ctx.role, ctx.permissions, "client.edit")) {
      throw new Error("You don't have permission to plan shoots");
    }
    return { agency: { id: ctx.agency.id }, currentUserId: ctx.currentUserId, scope: "agency" };
  }

  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  // A brand-side caller. They must belong to a workspace whose plan
  // carries the planner; RLS then decides which rows they can touch.
  const supabase = await getAgencySupabase();
  const { data: memberships } = await supabase
    .from("workspace_members").select("workspace_id").eq("user_id", userId);
  const ids = ((memberships ?? []) as Array<{ workspace_id: string }>).map((m) => m.workspace_id);
  if (ids.length === 0) throw new Error("Not a member of any agency or workspace");

  const { data: subs } = await supabase
    .from("subscriptions").select("workspace_id, plan").in("workspace_id", ids);
  const entitled = ((subs ?? []) as Array<{ plan: string | null }>)
    .some((sub) => canUseShootPlanner(sub.plan));
  if (!entitled) throw new Error("Shoot planning isn't on your plan");

  return { agency: { id: PLATFORM_AGENCY }, currentUserId: userId, scope: "workspace" };
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
  // No agency check: a brand workspace member has no agency context, and
  // RLS already returns nothing for a shoot they can't see.
  const { userId } = await auth();
  if (!userId) return null;
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
  const { userId } = await auth();
  if (!userId) return [];
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
  const { userId } = await auth();
  if (!userId) return [];
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
  const { userId } = await auth();
  if (!userId) return [];
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
  const { userId } = await auth();
  if (!userId) return [];
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

// ── Connections ───────────────────────────────────────────────

/**
 * Pull a client's moodboard images into a shoot as references.
 *
 * The client already chose these; making someone retype them into the
 * brief is how the brief ends up disagreeing with the board. The link
 * home is kept so the two stay recognisably the same thing.
 */
export async function importMoodboardReferences(input: {
  shootId: string;
  clientId: string;
  slot: string;
  itemIds: string[];
}): Promise<{ success: true; refs: RefRow[] } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }
  if (input.itemIds.length === 0) return { success: false, error: "Pick some images first" };

  const supabase = await getAgencySupabase();
  const { data: items } = await supabase
    .from("moodboard_items")
    .select("id, image_url, caption, kind")
    .in("id", input.itemIds)
    .eq("kind", "image");

  const rows = ((items ?? []) as Array<{ id: string; image_url: string | null; caption: string | null }>)
    .filter((i) => i.image_url);
  if (rows.length === 0) return { success: false, error: "Those aren't images" };

  const { data, error } = await supabase
    .from("shoot_references")
    .insert(
      rows.map((r, n) => ({
        agency_id: ctx.agency.id,
        shoot_id: input.shootId,
        slot: input.slot,
        image_url: r.image_url as string,
        note: r.caption,
        moodboard_item_id: r.id,
        position: n,
      })),
    )
    .select();

  if (error) return { success: false, error: error.message };
  revalidatePath("/studio-plan");
  return { success: true, refs: (data ?? []) as RefRow[] };
}

/** The client's moodboard images, for the picker. */
export async function listMoodboardImages(
  clientId: string,
): Promise<Array<{ id: string; image_url: string; caption: string | null }>> {
  const { userId } = await auth();
  if (!userId) return [];
  const supabase = await getAgencySupabase();
  const { data: boards } = await supabase.from("moodboards").select("id").eq("client_id", clientId);
  const ids = ((boards ?? []) as Array<{ id: string }>).map((b) => b.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("moodboard_items")
    .select("id, image_url, caption")
    .in("board_id", ids)
    .eq("kind", "image")
    .limit(200);
  return ((data ?? []) as Array<{ id: string; image_url: string | null; caption: string | null }>)
    .filter((i) => i.image_url)
    .map((i) => ({ id: i.id, image_url: i.image_url as string, caption: i.caption }));
}

// ── Notifications ─────────────────────────────────────────────

/**
 * Send the call sheet to everyone booked.
 *
 * The crew are not users of this system and never will be — a
 * photographer is not going to make an account to read a call time. The
 * email is the interface.
 */
export async function sendCallSheet(
  shootId: string,
): Promise<{ success: true; sent: number } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const detail = await getShoot(shootId);
  if (!detail) return { success: false, error: "Shoot not found" };

  const crew = ((detail.shoot.crew as CrewMember[]) ?? []).filter(
    (m) => m.contact && looksLikeEmail(m.contact),
  );
  if (crew.length === 0) {
    return { success: false, error: "Nobody on the crew has an email address yet." };
  }

  const messages = crew.map((m) => {
    const built = crewCallSheet({
      role: m.role,
      shootTitle: detail.shoot.title,
      date: detail.shoot.shoot_date,
      callTime: (detail.shoot.call_time as string) ?? null,
      location: detail.shoot.location,
      shotCount: detail.shots.length,
      notes: (detail.shoot.notes as string) ?? null,
    });
    return {
      agencyId: ctx.agency.id,
      to: m.contact as string,
      toName: m.name,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "shoot_crew_callsheet" as const,
      relatedType: null,
      relatedId: shootId,
    };
  });

  const results = await sendAll(messages);
  const supabase = await getAgencySupabase();
  await supabase.from("shoots").update({ crew_notified_at: new Date().toISOString() }).eq("id", shootId);

  revalidatePath("/studio-plan");
  return { success: true, sent: results.filter((r) => r.status === "sent").length };
}

/** Tell the client their brief is ready to read, and open it to them. */
export async function shareBriefWithClient(
  shootId: string,
): Promise<{ success: true; status: string } | { success: false; error: string }> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getAgencySupabase();
  const { data: shoot } = await supabase
    .from("shoots").select("id, title, shoot_date, client_id").eq("id", shootId).maybeSingle();
  const s = shoot as { title: string; shoot_date: string | null; client_id: string | null } | null;
  if (!s?.client_id) return { success: false, error: "This shoot isn't attached to a client" };

  await supabase.from("shoots").update({ shared_with_client: true }).eq("id", shootId);

  const { emails, enabled } = await clientRecipients(s.client_id);
  if (!enabled || emails.length === 0) {
    return { success: true, status: "shared" };
  }

  const built = shootBriefShared({
    shootTitle: s.title,
    date: s.shoot_date,
    portalUrl: buildPublicUrl(`/portal/${s.client_id}`),
  });

  const results = await sendAll(
    emails.map((to) => ({
      agencyId: ctx.agency.id,
      to,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "shoot_brief_shared" as const,
      relatedType: "client" as const,
      relatedId: s.client_id,
    })),
  );

  revalidatePath("/studio-plan");
  return { success: true, status: results[0]?.status ?? "sent" };
}

/**
 * Chase whatever is past its date.
 *
 * Grouped by owner so someone with four overdue posts gets one email
 * rather than four. Four emails about being behind is how a person
 * starts ignoring the emails.
 */
export async function chaseOverdueItems(): Promise<
  { success: true; sent: number } | { success: false; error: string }
> {
  let ctx;
  try { ctx = await editor(); } catch (e) { return { success: false, error: (e as Error).message }; }

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await getAgencySupabase();
  const { data: items } = await supabase
    .from("campaign_items")
    .select("id, title, owner, due_date, status, campaign_id")
    .lt("due_date", today)
    .not("owner", "is", null)
    .in("status", ["idea", "briefed", "in_progress", "ready"]);

  const rows = (items ?? []) as Array<{
    title: string; owner: string | null; due_date: string | null; campaign_id: string;
  }>;
  if (rows.length === 0) return { success: false, error: "Nothing is overdue." };

  const { data: campaigns } = await supabase.from("campaigns").select("id, name");
  const names = new Map(((campaigns ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));

  const byOwner = new Map<string, Array<{ title: string; campaign: string; due: string | null }>>();
  for (const r of rows) {
    if (!looksLikeEmail(r.owner)) continue;
    const key = r.owner.trim().toLowerCase();
    const list = byOwner.get(key) ?? [];
    list.push({ title: r.title, campaign: names.get(r.campaign_id) ?? "A campaign", due: r.due_date });
    byOwner.set(key, list);
  }

  if (byOwner.size === 0) {
    return { success: false, error: "Overdue items exist, but no owner has an email address on them." };
  }

  const messages = Array.from(byOwner.entries()).map(([email, list]) => {
    const built = campaignItemDue({
      ownerName: email,
      items: list,
      url: buildPublicUrl("/studio-plan"),
    });
    return {
      agencyId: ctx.agency.id,
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "campaign_item_due" as const,
      relatedType: null,
      relatedId: null,
    };
  });

  const results = await sendAll(messages);
  return { success: true, sent: results.filter((r) => r.status === "sent").length };
}

// ── Approvals ─────────────────────────────────────────────────

export interface ApprovalRow {
  id: string; subject: string; subject_id: string;
  decision: string; note: string | null;
  approved_by_name: string | null; created_at: string;
}

export async function listApprovals(
  subject: "shoot" | "campaign",
  subjectId: string,
): Promise<ApprovalRow[]> {
  const { userId } = await auth();
  if (!userId) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("plan_approvals")
    .select("*")
    .eq("subject", subject)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ApprovalRow[];
}

// ── The calendar ──────────────────────────────────────────────

export interface CalendarEntry {
  id: string;
  kind: "shoot" | "launch" | "item";
  title: string;
  subtitle: string | null;
  date: string;
  clientName: string | null;
  tone: string;
}

/**
 * Everything dated, across every client, on one list.
 *
 * The question this answers is the one a single campaign view can't:
 * three brands dropping in the same week, or a shoot booked the day
 * before a launch it was meant to feed.
 */
export async function planningCalendar(
  fromISO?: string,
  days = 120,
): Promise<CalendarEntry[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];

  const from = fromISO ?? new Date().toISOString().slice(0, 10);
  const until = new Date(`${from}T12:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const to = until.toISOString().slice(0, 10);

  const supabase = await getAgencySupabase();
  const [clients, shoots, campaigns, items] = await Promise.all([
    supabase.from("clients").select("id, name"),
    supabase.from("shoots").select("id, title, shoot_date, client_id, status")
      .gte("shoot_date", from).lte("shoot_date", to),
    supabase.from("campaigns").select("id, name, launch_date, client_id")
      .gte("launch_date", from).lte("launch_date", to),
    supabase.from("campaign_items").select("id, title, due_date, campaign_id, status, phase")
      .gte("due_date", from).lte("due_date", to),
  ]);

  const names = new Map(((clients.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));
  const campaignById = new Map(
    ((campaigns.data ?? []) as Array<{ id: string; name: string; client_id: string | null }>)
      .map((c) => [c.id, c]),
  );

  const out: CalendarEntry[] = [];

  for (const s of (shoots.data ?? []) as Array<{
    id: string; title: string; shoot_date: string; client_id: string | null; status: string;
  }>) {
    out.push({
      id: `shoot-${s.id}`, kind: "shoot", title: s.title,
      subtitle: SHOOT_STATUSES.find((x) => x.id === s.status)?.label ?? s.status,
      date: s.shoot_date,
      clientName: s.client_id ? names.get(s.client_id) ?? null : null,
      tone: "#0058B0",
    });
  }

  for (const c of (campaigns.data ?? []) as Array<{
    id: string; name: string; launch_date: string; client_id: string | null;
  }>) {
    out.push({
      id: `launch-${c.id}`, kind: "launch", title: c.name, subtitle: "Drops",
      date: c.launch_date,
      clientName: c.client_id ? names.get(c.client_id) ?? null : null,
      tone: "#1E8E4E",
    });
  }

  for (const i of (items.data ?? []) as Array<{
    id: string; title: string; due_date: string; campaign_id: string; status: string; phase: string;
  }>) {
    // Anything already out the door is history, not a plan.
    if (i.status === "done" || i.status === "live") continue;
    const parent = campaignById.get(i.campaign_id);
    out.push({
      id: `item-${i.id}`, kind: "item", title: i.title,
      subtitle: parent?.name ?? PHASE_LABEL[i.phase] ?? null,
      date: i.due_date,
      clientName: parent?.client_id ? names.get(parent.client_id) ?? null : null,
      tone: PHASE_TONE[i.phase] ?? "#6E6E73",
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Label a reference image with what it's showing. */
export async function updateReference(
  id: string,
  note: string,
): Promise<{ success: boolean }> {
  try { await editor(); } catch { return { success: false }; }
  const supabase = await getAgencySupabase();
  await supabase.from("shoot_references").update({ note: note.slice(0, 500) || null }).eq("id", id);
  return { success: true };
}
