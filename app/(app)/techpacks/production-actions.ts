"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll } from "@/lib/email/send";
import { buildPublicUrl } from "@/lib/url";
import {
  JOB_STATUSES, isStudioRank,
  type JobStatus, type JobNote, type JobVersion, type StudioRank,
} from "@/lib/techpack-jobs";

// ─────────────────────────────────────────────────────────────
// Outsourced tech packs, from our side.
//
// Who we outsource to, what we have asked them for, and the conversation
// around it. The board this feeds is the point of the feature — knowing a
// pack has been sitting with a studio for three weeks, or that they have
// been waiting on a logo from us for five days, is worth more than the
// upload link itself.
//
// Reads and writes go through the service-role client with an explicit
// agency filter on every query, the way lib/command-centre-build.ts does.
// The cross-tenant digest leak came from trusting a service-role client
// without one.
// ─────────────────────────────────────────────────────────────

const SETUP = "Tech pack jobs need a one-time database step — run migrations/049_techpack_studios.sql.";
const SETUP_050 = "The studio conversation needs a one-time database step — run migrations/051_studio_workspace.sql, which covers it.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || error.code === "PGRST204" || /techpack_(studios|jobs)/.test(error.message);
}

function notesMissing(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || /techpack_job_notes|revision_count|revision_note|started_at|priority/.test(error.message);
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
  status: JobStatus;
  priority: "high" | "normal";
  brief: string | null;
  dueDate: string | null;
  startedAt: string | null;
  deliveredAt: string | null;
  acceptedAt: string | null;
  createdAt: string;

  revisionNote: string | null;
  revisionCount: number;

  /** The studio's own two fields: when they say it lands, and their order. */
  studioEta: string | null;
  studioRank: StudioRank | null;

  productId: string;
  productName: string;
  productImage: string | null;
  productCategory: string | null;

  clientId: string | null;
  clientName: string | null;
  studioId: string | null;
  studioName: string | null;

  versions: JobVersion[];
  currentVersion: number;
  latestFileUrl: string | null;

  /** Unresolved things the studio has asked us for. */
  openRequests: number;
  noteCount: number;
  /** Days since we asked, which is what makes a board worth looking at. */
  ageDays: number;
}

export interface ProductionBoard {
  allowed: boolean;
  needsSetup: boolean;
  needsNotesSetup: boolean;
  setupMessage: string;
  studios: Studio[];
  jobs: ProductionJob[];
  products: Array<{
    id: string;
    name: string;
    clientId: string | null;
    clientName: string | null;
    category: string | null;
    image: string | null;
  }>;
}

const EMPTY: ProductionBoard = {
  allowed: false, needsSetup: false, needsNotesSetup: false, setupMessage: SETUP,
  studios: [], jobs: [], products: [],
};

function firstImage(images: unknown): string | null {
  return Array.isArray(images) && images.length > 0 ? String(images[0]) : null;
}

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
  const jobRows = (jobRes.data ?? []) as Array<Record<string, unknown>>;

  const { data: productRows } = await supabase
    .from("products")
    .select("id, name, project_id, category, images")
    .eq("agency_id", agencyId);
  const products = (productRows ?? []) as Array<{
    id: string; name: string; project_id: string | null; category: string | null; images: unknown;
  }>;

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
  const productById = new Map(products.map((p) => [p.id, p]));

  const { data: packRows } = await supabase
    .from("product_techpacks")
    .select("product_id, version, file_url, file_name, change_note, created_at, uploaded_by")
    .eq("agency_id", agencyId)
    .order("version", { ascending: false });
  const packs = (packRows ?? []) as Array<{
    product_id: string; version: number; file_url: string; file_name: string | null;
    change_note: string | null; created_at: string; uploaded_by: string;
  }>;

  // Notes are optional until 050 is run, so a missing table degrades to
  // "no conversation yet" rather than an empty board.
  const notesRes = await supabase
    .from("techpack_job_notes")
    .select("job_id, asks_for, resolved_at")
    .eq("agency_id", agencyId);
  const needsNotesSetup = !!notesRes.error && notesMissing(notesRes.error);
  const notes = (notesRes.data ?? []) as Array<{ job_id: string; asks_for: string | null; resolved_at: string | null }>;

  const studioName = new Map(studioRows.map((s) => [s.id, s.name]));
  const now = Date.now();

  const jobs: ProductionJob[] = jobRows
    .filter((j) => String(j.status) !== "cancelled")
    .map((j) => {
      const productId = String(j.product_id);
      const product = productById.get(productId);
      const clientId =
        (j.client_id as string | null) ??
        (product?.project_id ? clientOfProject.get(product.project_id) ?? null : null);
      const mine = packs.filter((p) => p.product_id === productId);
      const jobNotes = notes.filter((n) => n.job_id === String(j.id));

      return {
        id: String(j.id),
        status: (JOB_STATUSES.includes(j.status as JobStatus) ? j.status : "requested") as JobStatus,
        priority: j.priority === "high" ? "high" : "normal",
        brief: (j.brief as string | null) ?? null,
        dueDate: (j.due_date as string | null) ?? null,
        startedAt: (j.started_at as string | null) ?? null,
        deliveredAt: (j.delivered_at as string | null) ?? null,
        acceptedAt: (j.accepted_at as string | null) ?? null,
        createdAt: String(j.created_at),
        revisionNote: (j.revision_note as string | null) ?? null,
        revisionCount: Number(j.revision_count ?? 0),
        studioEta: (j.studio_eta as string | null) ?? null,
        studioRank: isStudioRank(j.studio_rank) ? j.studio_rank : null,
        productId,
        productName: product?.name ?? "Unnamed product",
        productImage: firstImage(product?.images),
        productCategory: product?.category ?? null,
        clientId,
        clientName: clientId ? clientName.get(clientId) ?? null : null,
        studioId: (j.studio_id as string | null) ?? null,
        studioName: j.studio_id ? studioName.get(String(j.studio_id)) ?? null : null,
        versions: mine.map((p) => ({
          version: p.version,
          fileName: p.file_name,
          fileUrl: p.file_url,
          changeNote: p.change_note,
          createdAt: p.created_at,
          uploadedBy: p.uploaded_by,
        })),
        currentVersion: mine[0]?.version ?? 0,
        latestFileUrl: mine[0]?.file_url ?? null,
        openRequests: jobNotes.filter((n) => n.asks_for && !n.resolved_at).length,
        noteCount: jobNotes.length,
        ageDays: Math.max(0, Math.floor((now - new Date(String(j.created_at)).getTime()) / 86_400_000)),
      };
    });

  return {
    allowed: true,
    needsSetup: false,
    needsNotesSetup,
    setupMessage: needsNotesSetup ? SETUP_050 : SETUP,
    studios: studioRows.map((s) => ({
      id: s.id,
      name: s.name,
      contactEmail: s.contact_email,
      token: s.token,
      revokedAt: s.revoked_at,
      openJobs: jobs.filter((j) => j.studioId === s.id && j.status !== "accepted").length,
    })),
    jobs,
    products: products
      .map((p) => {
        const clientId = p.project_id ? clientOfProject.get(p.project_id) ?? null : null;
        return {
          id: p.id,
          name: p.name,
          clientId,
          clientName: clientId ? clientName.get(clientId) ?? null : null,
          category: p.category,
          image: firstImage(p.images),
        };
      })
      .sort((a, b) => (a.clientName ?? "").localeCompare(b.clientName ?? "") || a.name.localeCompare(b.name)),
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

/**
 * Ask a studio for packs on several products at once.
 *
 * One product at a time was the first version and it was wrong: a
 * collection goes out as a collection, and twelve trips through the same
 * form to send twelve styles is the kind of thing that stops a feature
 * being used at all.
 */
export async function requestTechPacks(input: {
  studioId: string;
  productIds: string[];
  brief?: string | null;
  dueDate?: string | null;
  priority?: "high" | "normal";
}): Promise<{ success: true; created: number } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };
  if (!input.studioId) return { success: false, error: "Pick a studio" };

  const wanted = Array.from(new Set(input.productIds.filter(Boolean)));
  if (wanted.length === 0) return { success: false, error: "Pick at least one product" };

  const supabase = getAgencyServiceSupabase();

  // The products must be ours. Ids from a browser are not proof, and one
  // query settles it for the whole batch.
  const { data: owned } = await supabase
    .from("products")
    .select("id, project_id")
    .eq("agency_id", ctx.agency.id)
    .in("id", wanted);
  const mine = (owned ?? []) as Array<{ id: string; project_id: string | null }>;
  if (mine.length === 0) return { success: false, error: "Those products could not be found" };

  const projectIds = Array.from(new Set(mine.map((p) => p.project_id).filter(Boolean) as string[]));
  const { data: projectRows } = projectIds.length
    ? await supabase.from("projects").select("id, client_id").in("id", projectIds)
    : { data: [] as Array<{ id: string; client_id: string | null }> };
  const clientOfProject = new Map(
    ((projectRows ?? []) as Array<{ id: string; client_id: string | null }>).map((p) => [p.id, p.client_id]),
  );

  const { data: studio } = await supabase
    .from("techpack_studios")
    .select("id")
    .eq("id", input.studioId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  if (!studio) return { success: false, error: "That studio could not be found" };

  const base = mine.map((p) => ({
    id: `tpj-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: ctx.agency.id,
    studio_id: input.studioId,
    product_id: p.id,
    client_id: p.project_id ? clientOfProject.get(p.project_id) ?? null : null,
    brief: input.brief?.trim()?.slice(0, 2000) || null,
    due_date: input.dueDate || null,
  }));

  // priority arrived with 050. Asking for packs is the point of the whole
  // feature and must not stop working because a later migration has not
  // been run yet, so a rejection naming that column is retried without it.
  const withPriority = input.priority === "high"
    ? base.map((row) => ({ ...row, priority: "high" }))
    : base;

  let { error } = await supabase.from("techpack_jobs").insert(withPriority);
  if (error && /priority/.test(error.message)) {
    ({ error } = await supabase.from("techpack_jobs").insert(base));
  }
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  // Tell them it has landed. The board is a pull; an email is the push,
  // and a studio that has to remember to check a link is a studio that
  // starts three days late.
  await emailStudio(
    input.studioId,
    ctx.agency.id,
    mine.length === 1 ? "A tech pack to draw" : `${mine.length} tech packs to draw`,
    input.dueDate
      ? `${mine.length === 1 ? "A new style is" : `${mine.length} new styles are`} on your list, wanted by ` +
        `${new Date(`${input.dueDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.`
      : `${mine.length === 1 ? "A new style is" : `${mine.length} new styles are`} on your list.`,
  );

  revalidatePath("/techpacks");
  for (const p of mine) revalidatePath(`/products/${p.id}`);
  return { success: true, created: mine.length };
}

// ── The same work, reached from a product page ───────────────
//
// Asking for a pack from the board means knowing to go to the board.
// Most of the time the thought arrives while somebody is looking at the
// style itself, so the same three decisions — who draws it, by when, and
// anything they should know — are offered there too, against this one
// product. Everything below exists to make that panel possible; the
// board remains the place to see all of it at once.

export interface StudioOption {
  id: string;
  name: string;
  hasEmail: boolean;
}

/** Just enough to fill a picker. */
export async function listStudioOptions(): Promise<StudioOption[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  if (!can(ctx.role, ctx.permissions, "product.edit")) return [];

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("techpack_studios")
    .select("id, name, contact_email, revoked_at")
    .eq("agency_id", ctx.agency.id)
    .order("created_at");
  if (error) return [];

  return ((data ?? []) as Array<{ id: string; name: string; contact_email: string | null; revoked_at: string | null }>)
    .filter((row) => !row.revoked_at)
    .map((row) => ({ id: row.id, name: row.name, hasEmail: Boolean(row.contact_email) }));
}

export interface ProductJobSummary {
  id: string;
  status: JobStatus;
  priority: "high" | "normal";
  dueDate: string | null;
  /** The studio's own date, once 051 is in. Null until then. */
  studioEta: string | null;
  deliveredAt: string | null;
  createdAt: string;
  studioId: string | null;
  studioName: string | null;
}

/**
 * The live request for this one product, if there is one.
 *
 * The newest wins. A product asked for twice is usually a re-request
 * after a cancellation, and the one that matters is the current one.
 */
export async function getJobForProduct(productId: string): Promise<ProductJobSummary | null> {
  const ctx = await getAgencyContext();
  if (!ctx) return null;
  if (!can(ctx.role, ctx.permissions, "product.edit")) return null;

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("techpack_jobs")
    .select("*")
    .eq("agency_id", ctx.agency.id)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;

  const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  let studioName: string | null = null;
  if (row.studio_id) {
    const { data: studio } = await supabase
      .from("techpack_studios")
      .select("name")
      .eq("id", String(row.studio_id))
      .eq("agency_id", ctx.agency.id)
      .maybeSingle();
    studioName = (studio as { name: string } | null)?.name ?? null;
  }

  return {
    id: String(row.id),
    status: (JOB_STATUSES.includes(row.status as JobStatus) ? row.status : "requested") as JobStatus,
    priority: row.priority === "high" ? "high" : "normal",
    dueDate: row.due_date ? String(row.due_date) : null,
    // studio_eta arrives with 051. Its absence is not an error here.
    studioEta: typeof row.studio_eta === "string" ? row.studio_eta : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    createdAt: String(row.created_at),
    studioId: row.studio_id ? String(row.studio_id) : null,
    studioName,
  };
}

/**
 * Move the deadline.
 *
 * Pulling a date forward is the version worth an email — a studio that
 * finds out on the day is a studio that misses it. Pushing it back is
 * good news and can wait for them to look.
 */
export async function setJobDueDate(input: {
  jobId: string;
  dueDate: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const next = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
  if (input.dueDate && !next) return { success: false, error: "That date didn't look right" };

  const supabase = getAgencyServiceSupabase();
  const { data: before } = await supabase
    .from("techpack_jobs")
    .select("due_date, studio_id, product_id")
    .eq("id", input.jobId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  const prev = before as { due_date: string | null; studio_id: string | null; product_id: string } | null;
  if (!prev) return { success: false, error: "That request could not be found" };

  const { error } = await supabase
    .from("techpack_jobs")
    .update({ due_date: next })
    .eq("id", input.jobId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { success: false, error: error.message };

  const pulledForward = next != null && prev.due_date != null && next < prev.due_date;
  if (pulledForward) {
    await emailStudio(
      prev.studio_id,
      ctx.agency.id,
      "A deadline has moved forward",
      `We've brought a tech pack deadline forward to ` +
        `${new Date(`${next}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}. ` +
        `If that isn't workable, say so and we'll sort something out.`,
    );
  }

  revalidatePath("/techpacks");
  revalidatePath(`/products/${prev.product_id}`);
  return { success: true };
}

/** Hand an unassigned request to a studio, or move it to a different one. */
export async function setJobStudio(input: {
  jobId: string;
  studioId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { data: studio } = await supabase
    .from("techpack_studios")
    .select("id")
    .eq("id", input.studioId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  if (!studio) return { success: false, error: "That studio could not be found" };

  const { data, error } = await supabase
    .from("techpack_jobs")
    .update({ studio_id: input.studioId })
    .eq("id", input.jobId)
    .eq("agency_id", ctx.agency.id)
    .select("product_id, due_date")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  const row = data as { product_id: string; due_date: string | null } | null;
  if (!row) return { success: false, error: "That request could not be found" };

  await emailStudio(
    input.studioId,
    ctx.agency.id,
    "A tech pack to draw",
    row.due_date
      ? `A style has been put on your list, wanted by ` +
        `${new Date(`${row.due_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.`
      : "A style has been put on your list.",
  );

  revalidatePath("/techpacks");
  revalidatePath(`/products/${row.product_id}`);
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

export async function setJobPriority(
  jobId: string,
  priority: "high" | "normal",
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("techpack_jobs")
    .update({ priority: priority === "high" ? "high" : null })
    .eq("id", jobId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { success: false, error: notesMissing(error) ? SETUP_050 : error.message };

  revalidatePath("/techpacks");
  return { success: true };
}

/**
 * Send a delivered pack back for changes.
 *
 * The pack itself is not touched: the studio answers with a new version,
 * and product_techpacks already supersedes the old one when it lands. All
 * this records is that we asked, what we asked for, and how many times.
 */
export async function requestRevision(input: {
  jobId: string;
  note: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const note = input.note.trim().slice(0, 2000);
  if (!note) return { success: false, error: "Say what needs changing" };

  const supabase = getAgencyServiceSupabase();
  const { data: jobRow } = await supabase
    .from("techpack_jobs")
    .select("id, revision_count, studio_id, product_id")
    .eq("id", input.jobId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  const job = jobRow as { id: string; revision_count: number | null; studio_id: string | null; product_id: string } | null;
  if (!job) return { success: false, error: "That job could not be found" };

  const { error } = await supabase
    .from("techpack_jobs")
    .update({
      status: "revision_requested",
      revision_note: note,
      revision_count: Number(job.revision_count ?? 0) + 1,
      delivered_at: null,
    })
    .eq("id", job.id)
    .eq("agency_id", ctx.agency.id);
  if (error) return { success: false, error: notesMissing(error) ? SETUP_050 : error.message };

  // The ask goes in the thread too, so the studio reads it where they read
  // everything else rather than only as a status.
  await supabase.from("techpack_job_notes").insert({
    id: `tjn-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: ctx.agency.id,
    job_id: job.id,
    author: "agency",
    author_name: ctx.agency.name ?? "Source Archive",
    body: note,
  });

  await emailStudio(job.studio_id, ctx.agency.id, "A tech pack needs changes", note);

  revalidatePath("/techpacks");
  return { success: true };
}

export async function addAgencyNote(input: {
  jobId: string;
  body: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const body = input.body.trim().slice(0, 4000);
  if (!body) return { success: false, error: "Nothing to say" };

  const supabase = getAgencyServiceSupabase();
  const { data: job } = await supabase
    .from("techpack_jobs")
    .select("id, studio_id")
    .eq("id", input.jobId)
    .eq("agency_id", ctx.agency.id)
    .maybeSingle();
  if (!job) return { success: false, error: "That job could not be found" };

  const { error } = await supabase.from("techpack_job_notes").insert({
    id: `tjn-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: ctx.agency.id,
    job_id: input.jobId,
    author: "agency",
    author_name: ctx.agency.name ?? "Source Archive",
    body,
  });
  if (error) return { success: false, error: notesMissing(error) ? SETUP_050 : error.message };

  revalidatePath("/techpacks");
  return { success: true };
}

/** Mark something the studio asked us for as supplied. */
export async function resolveRequest(
  noteId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: denied, ctx } = await writable();
  if (denied || !ctx) return { success: false, error: denied ?? "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("techpack_job_notes")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("agency_id", ctx.agency.id);
  if (error) return { success: false, error: notesMissing(error) ? SETUP_050 : error.message };

  revalidatePath("/techpacks");
  return { success: true };
}

export async function getJobThread(jobId: string): Promise<JobNote[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  if (!can(ctx.role, ctx.permissions, "product.edit")) return [];

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("techpack_job_notes")
    .select("id, author, author_name, body, asks_for, resolved_at, created_at")
    .eq("agency_id", ctx.agency.id)
    .eq("job_id", jobId)
    .order("created_at");
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>).map((n) => ({
    id: String(n.id),
    author: n.author === "studio" ? "studio" : "agency",
    authorName: (n.author_name as string | null) ?? null,
    body: String(n.body),
    asksFor: (n.asks_for as string | null) ?? null,
    resolvedAt: (n.resolved_at as string | null) ?? null,
    createdAt: String(n.created_at),
  }));
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

/** Best-effort nudge. A studio with no address on file simply isn't emailed. */
async function emailStudio(
  studioId: string | null,
  agencyId: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!studioId) return;
  try {
    const supabase = getAgencyServiceSupabase();
    const { data } = await supabase
      .from("techpack_studios")
      .select("name, contact_email, token, revoked_at")
      .eq("id", studioId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    const studio = data as { name: string; contact_email: string | null; token: string; revoked_at: string | null } | null;
    if (!studio?.contact_email || studio.revoked_at) return;

    const url = buildPublicUrl(`/packs/${studio.token}`);
    await sendAll([
      {
        agencyId,
        to: studio.contact_email,
        toName: studio.name,
        template: "techpack_studio_link",
        subject: `${subject} — Source Archive`,
        html: `<p>Hi ${studio.name},</p><p>${body}</p><p><a href="${url}">Open your tech pack list</a></p><p>Best,<br/>Source Archive team</p>`,
        text: `Hi ${studio.name},\n\n${body}\n\n${url}\n\nBest,\nSource Archive team`,
      },
    ]);
  } catch (err) {
    console.error("[techpacks] could not email the studio:", err);
  }
}
