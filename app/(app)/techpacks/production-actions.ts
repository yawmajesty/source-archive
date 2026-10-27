"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll } from "@/lib/email/send";
import { buildPublicUrl } from "@/lib/url";

// ─────────────────────────────────────────────────────────────
// Outsourced tech packs, from our side.
//
// Two things live here: who we outsource to, and what we have asked them
// for. The board this feeds is the point of the feature — knowing a pack
// has been sitting with a studio for three weeks is worth more than the
// upload link itself.
//
// Reads and writes go through the service-role client with an explicit
// agency filter on every query, the way lib/command-centre-build.ts does.
// The cross-tenant digest leak came from trusting a service-role client
// without one.
// ─────────────────────────────────────────────────────────────

const SETUP = "Tech pack jobs need a one-time database step — run migrations/049_techpack_studios.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || error.code === "PGRST204" || /techpack_(studios|jobs)/.test(error.message);
}

export interface Studio {
  id: string;
  name: string;
  contactEmail: string | null;
  token: string;
  revokedAt: string | null;
  openJobs: number;
}

export interface ProductionJob {
  id: string;
  status: string;
  brief: string | null;
  dueDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
  productId: string;
  productName: string;
  clientId: string | null;
  clientName: string | null;
  studioId: string | null;
  studioName: string | null;
  currentVersion: number;
  latestFileUrl: string | null;
  /** Days since we asked. The number that makes a board worth looking at. */
  ageDays: number;
}

export interface ProductionBoard {
  allowed: boolean;
  needsSetup: boolean;
  setupMessage: string;
  studios: Studio[];
  jobs: ProductionJob[];
  /** For the "ask for a pack" form. */
  products: Array<{ id: string; name: string; clientId: string | null; clientName: string | null }>;
}

const EMPTY: ProductionBoard = {
  allowed: false, needsSetup: false, setupMessage: SETUP,
  studios: [], jobs: [], products: [],
};

export async function getProductionBoard(): Promise<ProductionBoard> {
  const ctx = await getAgencyContext();
  if (!ctx) return EMPTY;
  if (!can(ctx.role, ctx.permissions, "product.edit")) return EMPTY;

  const supabase = getAgencyServiceSupabase();
  const agencyId = ctx.agency.id;

  const [studioRes, jobRes] = await Promise.all([
    supabase.from("techpack_studios").select("*").eq("agency_id", agencyId).order("created_at"),
    supabase.from("techpack_jobs").select("*").eq("agency_id", agencyId).order("created_at", { ascending: false }),
  ]);

  if (studioRes.error && notSetUp(studioRes.error)) {
    return { ...EMPTY, allowed: true, needsSetup: true };
  }

  const studioRows = (studioRes.data ?? []) as Array<{
    id: string; name: string; contact_email: string | null; token: string; revoked_at: string | null;
  }>;
  const jobRows = (jobRes.data ?? []) as Array<{
    id: string; status: string; brief: string | null; due_date: string | null; delivered_at: string | null;
    created_at: string; product_id: string; client_id: string | null; studio_id: string | null;
  }>;

  // Every product that belongs to this agency, for the picker and for names.
  const { data: productRows } = await supabase
    .from("products")
    .select("id, name, project_id")
    .eq("agency_id", agencyId);
  const products = (productRows ?? []) as Array<{ id: string; name: string; project_id: string | null }>;

  const [{ data: projectRows }, { data: clientRows }] = await Promise.all([
    supabase.from("projects").select("id, client_id").eq("agency_id", agencyId),
    supabase.from("clients").select("id, name").eq("agency_id", agencyId),
  ]);
  const clientOfProject = new Map(
    ((projectRows ?? []) as Array<{ id: string; client_id: string | null }>).map((p) => [p.id, p.client_id]),
  );
  const clientName = new Map(
    ((clientRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );
  const productName = new Map(products.map((p) => [p.id, p.name]));

  const { data: packRows } = await supabase
    .from("product_techpacks")
    .select("product_id, version, file_url")
    .eq("agency_id", agencyId)
    .order("version", { ascending: false });
  const packs = (packRows ?? []) as Array<{ product_id: string; version: number; file_url: string }>;
  const latest = new Map<string, { version: number; file_url: string }>();
  for (const p of packs) if (!latest.has(p.product_id)) latest.set(p.product_id, p);

  const studioName = new Map(studioRows.map((s) => [s.id, s.name]));
  const now = Date.now();

  return {
    allowed: true,
    needsSetup: false,
    setupMessage: SETUP,
    studios: studioRows.map((s) => ({
      id: s.id,
      name: s.name,
      contactEmail: s.contact_email,
      token: s.token,
      revokedAt: s.revoked_at,
      openJobs: jobRows.filter((j) => j.studio_id === s.id && j.status === "requested").length,
    })),
    jobs: jobRows
      .filter((j) => j.status !== "cancelled")
      .map((j) => {
        const clientId = j.client_id ?? clientOfProject.get(j.product_id ?? "") ?? null;
        const current = latest.get(j.product_id);
        return {
          id: j.id,
          status: j.status,
          brief: j.brief,
          dueDate: j.due_date,
          deliveredAt: j.delivered_at,
          createdAt: j.created_at,
          productId: j.product_id,
          productName: productName.get(j.product_id) ?? "Unnamed product",
          clientId,
          clientName: clientId ? clientName.get(clientId) ?? null : null,
          studioId: j.studio_id,
          studioName: j.studio_id ? studioName.get(j.studio_id) ?? null : null,
          currentVersion: current?.version ?? 0,
          latestFileUrl: current?.file_url ?? null,
          ageDays: Math.max(0, Math.floor((now - new Date(j.created_at).getTime()) / 86_400_000)),
        };
      }),
    products: products.map((p) => {
      const clientId = p.project_id ? clientOfProject.get(p.project_id) ?? null : null;
      return {
        id: p.id,
        name: p.name,
        clientId,
        clientName: clientId ? clientName.get(clientId) ?? null : null,
      };
    }).sort((a, b) => (a.clientName ?? "").localeCompare(b.clientName ?? "") || a.name.localeCompare(b.name)),
  };
}

async function writable() {
  const ctx = await getAgencyContext();
  if (!ctx) return { error: "Not a member of any agency" as const, ctx: null };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { error: "You don't have permission to manage tech packs" as const, ctx: null };
  }
  return { error: null, ctx };
}

export async function createStudio(input: {
  name: string;
  contactEmail?: string | null;
}): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const name = input.name.trim().slice(0, 120);
  if (!name) return { success: false, error: "Give the studio a name" };

  // Two uuids' worth of entropy: this link is the whole credential.
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase.from("techpack_studios").insert({
    id: `tps-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: ctx.agency.id,
    name,
    contact_email: input.contactEmail?.trim()?.slice(0, 200) || null,
    token,
  });
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  revalidatePath("/techpacks");
  return { success: true, token };
}

export async function setStudioRevoked(
  studioId: string,
  revoked: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("techpack_studios")
    .update({ revoked_at: revoked ? new Date().toISOString() : null })
    .eq("id", studioId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/techpacks");
  return { success: true };
}

export async function requestTechPack(input: {
  studioId: string;
  productId: string;
  brief?: string | null;
  dueDate?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };
  if (!input.productId) return { success: false, error: "Pick a product" };
  if (!input.studioId) return { success: false, error: "Pick a studio" };

  const supabase = getAgencyServiceSupabase();

  // The product must be ours. A product id from the browser is not proof.
  const { data: product } = await supabase
    .from("products")
    .select("id, name, project_id, agency_id")
    .eq("id", input.productId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  const prod = product as { id: string; name: string; project_id: string | null } | null;
  if (!prod) return { success: false, error: "That product could not be found" };

  let clientId: string | null = null;
  if (prod.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("client_id")
      .eq("id", prod.project_id)
      .maybeSingle();
    clientId = (project as { client_id: string | null } | null)?.client_id ?? null;
  }

  const { data: studio } = await supabase
    .from("techpack_studios")
    .select("id, name, contact_email")
    .eq("id", input.studioId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  const st = studio as { id: string; name: string; contact_email: string | null } | null;
  if (!st) return { success: false, error: "That studio could not be found" };

  const { error } = await supabase.from("techpack_jobs").insert({
    id: `tpj-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: ctx.agency.id,
    studio_id: st.id,
    product_id: prod.id,
    client_id: clientId,
    brief: input.brief?.trim()?.slice(0, 2000) || null,
    due_date: input.dueDate || null,
  });
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  revalidatePath("/techpacks");
  return { success: true };
}

export async function setJobStatus(
  jobId: string,
  status: "requested" | "accepted" | "cancelled",
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("techpack_jobs")
    .update({ status, accepted_at: status === "accepted" ? new Date().toISOString() : null })
    .eq("id", jobId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/techpacks");
  return { success: true };
}

/** Email the studio their link, rather than making somebody copy and paste it. */
export async function emailStudioLink(
  studioId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("techpack_studios")
    .select("name, contact_email, token, revoked_at")
    .eq("id", studioId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  const studio = data as { name: string; contact_email: string | null; token: string; revoked_at: string | null } | null;
  if (!studio) return { success: false, error: "That studio could not be found" };
  if (!studio.contact_email) return { success: false, error: "No email address on that studio" };
  if (studio.revoked_at) return { success: false, error: "That link is turned off" };

  const url = buildPublicUrl(`/packs/${studio.token}`);
  await sendAll([
    {
      agencyId: ctx.agency.id,
      to: studio.contact_email,
      toName: studio.name,
      template: "techpack_studio_link",
      subject: "Your tech pack link — Source Archive",
      html:
        `<p>Hi ${studio.name},</p>` +
        `<p>Here is your link for the tech packs we send you. Keep it — it stays the same, ` +
        `and everything we assign you will appear on it.</p>` +
        `<p><a href="${url}">${url}</a></p>` +
        `<p>Best,<br/>Source Archive team</p>`,
      text:
        `Hi ${studio.name},\n\n` +
        `Here is your link for the tech packs we send you. Keep it — it stays the same, ` +
        `and everything we assign you will appear on it.\n\n${url}\n\n` +
        `Best,\nSource Archive team`,
    },
  ]);

  return { success: true };
}
