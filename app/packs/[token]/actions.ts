"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { notifyAgency } from "@/lib/email/portal-notify";
import { buildPublicUrl } from "@/lib/url";
import {
  ASK_LABEL, JOB_STATUSES, cleanDate, isStudioRank,
  type JobStatus, type JobNote, type JobVersion, type StudioRank,
} from "@/lib/techpack-jobs";

// ─────────────────────────────────────────────────────────────
// The tech pack studio's standing link.
//
// An outside studio draws our packs. They bookmark one link and see only
// the jobs we have assigned them. There is no login, so the token in the
// URL is the whole credential: every call re-reads it and re-checks that
// the job being acted on belongs to that studio, rather than trusting a
// job id handed back by the browser.
//
// Delivered files land in product_techpacks, the same table our own
// uploads use, so versioning, supersedes, dual sign-off and the client
// portal all keep working without knowing an outsider was involved.
// ─────────────────────────────────────────────────────────────

const SETUP =
  "Tech pack jobs need a one-time database step — run migrations/049_techpack_studios.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || error.code === "PGRST204" || /techpack_(studios|jobs)/.test(error.message);
}

export interface StudioJob {
  id: string;
  status: JobStatus;
  priority: "high" | "normal";
  brief: string | null;
  dueDate: string | null;
  deliveredAt: string | null;
  createdAt: string;

  /** What we last asked them to change, when we did. */
  revisionNote: string | null;
  revisionCount: number;

  /** Theirs, not ours: when they expect to deliver, and their own order. */
  studioEta: string | null;
  studioRank: StudioRank | null;

  productId: string;
  productName: string;
  productImage: string | null;
  productCategory: string | null;
  /** Everything we know that helps them draw it. */
  productSpec: Array<[string, string]>;
  clientName: string | null;

  currentVersion: number;
  versions: JobVersion[];
  notes: JobNote[];
}

export interface StudioBoard {
  studioName: string;
  jobs: StudioJob[];
  /** Set when the link is unusable, so the page can say which. */
  problem: "unknown" | "revoked" | "setup" | null;
  setupMessage?: string;
  /** False until the notes table exists; the page then hides the conversation. */
  canTalk: boolean;
  /** False until 051 is run; the page then hides planning. */
  canPlan: boolean;
}

async function studioFor(token: string) {
  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("techpack_studios")
    .select("id, agency_id, name, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (error) return { error, studio: null as null };
  return {
    error: null,
    studio: data as { id: string; agency_id: string; name: string; revoked_at: string | null } | null,
  };
}

function spec(p: Record<string, unknown> | undefined): Array<[string, string]> {
  if (!p) return [];
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: unknown) => {
    const text = value == null ? "" : String(value).trim();
    if (text) rows.push([label, text]);
  };
  add("Style no.", p.style_no);
  add("Category", p.category);
  add("Size range", p.size_range);
  add("Fabric", p.fabric);
  add("Composition / GSM", p.composition_gsm);
  if (Array.isArray(p.colorways) && p.colorways.length > 0) add("Colourways", p.colorways.join(", "));
  add("Order quantity", p.order_qty);
  add("Notes", p.notes);
  return rows;
}

export async function getStudioBoard(token: string): Promise<StudioBoard> {
  const empty: StudioBoard = { studioName: "", jobs: [], problem: "unknown", canTalk: false, canPlan: false };
  if (!token) return empty;

  const supabase = getAgencyServiceSupabase();
  const { error: lookupError, studio } = await studioFor(token);
  if (lookupError) {
    return notSetUp(lookupError)
      ? { ...empty, problem: "setup", setupMessage: SETUP }
      : empty;
  }
  if (!studio) return empty;
  if (studio.revoked_at) return { studioName: studio.name, jobs: [], problem: "revoked", canTalk: false, canPlan: false };

  const { data: jobRows } = await supabase
    .from("techpack_jobs")
    .select("*")
    .eq("studio_id", studio.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const jobs = (jobRows ?? []) as Array<Record<string, unknown>>;
  if (jobs.length === 0) {
    return { studioName: studio.name, jobs: [], problem: null, canTalk: true, canPlan: true };
  }

  const productIds = Array.from(new Set(jobs.map((j) => String(j.product_id))));
  const clientIds = Array.from(new Set(jobs.map((j) => j.client_id).filter(Boolean) as string[]));

  const [productsRes, clientsRes, packsRes, notesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, images, style_no, size_range, fabric, composition_gsm, colorways, order_qty, notes")
      .in("id", productIds),
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    supabase
      .from("product_techpacks")
      .select("product_id, version, file_name, file_url, change_note, created_at, uploaded_by")
      .in("product_id", productIds)
      .order("version", { ascending: false }),
    supabase
      .from("techpack_job_notes")
      .select("id, job_id, author, author_name, body, asks_for, resolved_at, created_at")
      .in("job_id", jobs.map((j) => String(j.id)))
      .order("created_at"),
  ]);

  const products = new Map(
    ((productsRes.data ?? []) as Array<Record<string, unknown>>).map((p) => [String(p.id), p]),
  );
  const clientName = new Map(
    ((clientsRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );
  const packs = (packsRes.data ?? []) as Array<{
    product_id: string; version: number; file_name: string | null; file_url: string;
    change_note: string | null; created_at: string; uploaded_by: string;
  }>;
  const canTalk = !notesRes.error;
  // select("*") returns whatever columns exist, so the presence of the key
  // is the honest test for whether 051 has been run.
  const canPlan = "studio_eta" in jobs[0];
  const notes = (notesRes.data ?? []) as Array<Record<string, unknown>>;

  return {
    studioName: studio.name,
    problem: null,
    canTalk,
    canPlan,
    jobs: jobs.map((job) => {
      const productId = String(job.product_id);
      const product = products.get(productId);
      const mine = packs.filter((p) => p.product_id === productId);
      const clientId = job.client_id as string | null;

      return {
        id: String(job.id),
        status: (JOB_STATUSES.includes(job.status as JobStatus) ? job.status : "requested") as JobStatus,
        priority: job.priority === "high" ? "high" : "normal",
        brief: (job.brief as string | null) ?? null,
        dueDate: (job.due_date as string | null) ?? null,
        deliveredAt: (job.delivered_at as string | null) ?? null,
        createdAt: String(job.created_at),
        revisionNote: (job.revision_note as string | null) ?? null,
        revisionCount: Number(job.revision_count ?? 0),
        studioEta: (job.studio_eta as string | null) ?? null,
        studioRank: isStudioRank(job.studio_rank) ? job.studio_rank : null,
        productId,
        productName: (product?.name as string | undefined) ?? "Unnamed product",
        productImage:
          Array.isArray(product?.images) && (product?.images as unknown[]).length > 0
            ? String((product!.images as unknown[])[0])
            : null,
        productCategory: (product?.category as string | null) ?? null,
        productSpec: spec(product),
        clientName: clientId ? clientName.get(clientId) ?? null : null,
        currentVersion: mine[0]?.version ?? 0,
        versions: mine.map((p) => ({
          version: p.version,
          fileName: p.file_name,
          fileUrl: p.file_url,
          changeNote: p.change_note,
          createdAt: p.created_at,
          uploadedBy: p.uploaded_by,
        })),
        notes: notes
          .filter((n) => String(n.job_id) === String(job.id))
          .map((n) => ({
            id: String(n.id),
            author: n.author === "studio" ? ("studio" as const) : ("agency" as const),
            authorName: (n.author_name as string | null) ?? null,
            body: String(n.body),
            asksFor: (n.asks_for as string | null) ?? null,
            resolvedAt: (n.resolved_at as string | null) ?? null,
            createdAt: String(n.created_at),
          })),
      };
    }),
  };
}

/** The job this token is allowed to act on, or null. */
async function jobForStudio(token: string, jobId: string) {
  const { error, studio } = await studioFor(token);
  if (error || !studio || studio.revoked_at) return { studio: null, job: null };

  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("techpack_jobs")
    .select("id, studio_id, agency_id, product_id, client_id, status")
    .eq("id", jobId)
    .maybeSingle();
  const job = data as {
    id: string; studio_id: string | null; agency_id: string;
    product_id: string; client_id: string | null; status: string;
  } | null;
  if (!job || job.studio_id !== studio.id || job.status === "cancelled") return { studio: null, job: null };
  return { studio, job };
}

/** "We've picked this up." Costs nothing and answers our commonest question. */
export async function startJob(input: {
  token: string;
  jobId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { studio, job } = await jobForStudio(input.token, input.jobId);
  if (!studio || !job) return { success: false, error: "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("techpack_jobs")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", job.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function postStudioNote(input: {
  token: string;
  jobId: string;
  body: string;
  asksFor?: string | null;
  authorName?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { studio, job } = await jobForStudio(input.token, input.jobId);
  if (!studio || !job) return { success: false, error: "Not allowed" };

  const body = input.body.trim().slice(0, 4000);
  if (!body) return { success: false, error: "Nothing to send" };
  const asksFor = input.asksFor && ASK_LABEL[input.asksFor] ? input.asksFor : null;

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase.from("techpack_job_notes").insert({
    id: `tjn-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: job.agency_id,
    job_id: job.id,
    author: "studio",
    author_name: (input.authorName?.trim() || studio.name).slice(0, 120),
    body,
    asks_for: asksFor,
  });
  if (error) {
    return {
      success: false,
      error: error.code === "PGRST205"
        ? "Messaging isn't switched on yet — tell the team."
        : error.message,
    };
  }

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", job.product_id)
    .maybeSingle();
  const name = (product as { name: string } | null)?.name ?? "a product";

  await notifyAgency({
    agencyId: job.agency_id,
    headline: asksFor
      ? `${studio.name} needs ${ASK_LABEL[asksFor]} — ${name}`
      : `${studio.name} commented on ${name}`,
    who: studio.name,
    quote: body,
    url: buildPublicUrl(`/techpacks`),
    linkLabel: "Open tech packs",
    relatedType: "product",
    relatedId: job.product_id,
  });

  return { success: true };
}

/**
 * A delivered pack.
 *
 * The version is worked out here and never asked for. product_techpacks
 * carries a unique index on (product_id, version), so a studio typing "1"
 * against a product that already has a v1 would simply be rejected with a
 * constraint error they could do nothing about.
 */
export async function deliverTechPack(input: {
  token: string;
  jobId: string;
  fileUrl: string;
  filePath?: string | null;
  fileName?: string | null;
  changeNote?: string | null;
  uploaderName?: string | null;
}): Promise<{ success: true; version: number } | { success: false; error: string }> {
  if (!input.fileUrl) return { success: false, error: "Upload a file first" };

  const { studio, job } = await jobForStudio(input.token, input.jobId);
  if (!studio || !job) return { success: false, error: "This link is no longer active" };

  const supabase = getAgencyServiceSupabase();

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", job.product_id)
    .maybeSingle();
  const name = (product as { name: string } | null)?.name ?? "the product";

  const { data: latest } = await supabase
    .from("product_techpacks")
    .select("version")
    .eq("product_id", job.product_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest as { version: number } | null)?.version ?? 0) + 1;

  // The pack that was current stops being current the moment a newer one
  // lands, exactly as it does for our own uploads.
  if (version > 1) {
    await supabase
      .from("product_techpacks")
      .update({ superseded_at: new Date().toISOString() })
      .eq("product_id", job.product_id)
      .is("superseded_at", null);
  }

  const { error } = await supabase.from("product_techpacks").insert({
    id: `tp-${crypto.randomUUID().replace(/-/g, "")}`,
    agency_id: job.agency_id,
    product_id: job.product_id,
    client_id: job.client_id,
    version,
    change_note: input.changeNote?.trim()?.slice(0, 500) || null,
    file_url: input.fileUrl,
    file_path: input.filePath ?? null,
    file_name: input.fileName?.slice(0, 240) ?? null,
    uploaded_by: "studio",
    uploader_name: (input.uploaderName?.trim() || studio.name).slice(0, 120),
  });
  if (error) return { success: false, error: error.message };

  await supabase
    .from("techpack_jobs")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", job.id);

  await notifyAgency({
    agencyId: job.agency_id,
    headline: `Tech pack delivered — ${name} (v${version})`,
    who: studio.name,
    quote:
      `${input.fileName ?? "Tech pack"} · version ${version}` +
      `${input.changeNote ? `\n\n${input.changeNote}` : ""}`,
    url: buildPublicUrl(`/products/${job.product_id}`),
    linkLabel: "Open the product",
    relatedType: "product",
    relatedId: job.product_id,
  });

  return { success: true, version };
}

// ─────────────────────────────────────────────────────────────
// The studio's own planning.
//
// Both of these write columns that are theirs. Neither touches due_date or
// our priority, so a studio can keep its own list honest without editing
// what we agreed — and the gap between the two is what tells us a pack is
// going to be late before it is late.
// ─────────────────────────────────────────────────────────────

const NEEDS_051 =
  "Planning needs a one-time database step — tell the team to run migrations/051_studio_workspace.sql.";

function missingColumn(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST204" || /studio_eta|studio_rank/.test(error.message);
}

/** "I'll have it to you on the 20th." */
export async function setStudioEta(input: {
  token: string;
  jobId: string;
  eta: string | null;
  authorName?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { studio, job } = await jobForStudio(input.token, input.jobId);
  if (!studio || !job) return { success: false, error: "Not allowed" };

  const eta = input.eta === null || input.eta === "" ? null : cleanDate(input.eta);
  if (input.eta && !eta) return { success: false, error: "That date didn't look right" };

  const supabase = getAgencyServiceSupabase();

  // Read the job again for the two things that decide whether this is
  // worth an email: what they said last time, and what we asked for.
  const { data: before } = await supabase
    .from("techpack_jobs")
    .select("studio_eta, due_date")
    .eq("id", job.id)
    .maybeSingle();
  const previous = (before as { studio_eta: string | null } | null)?.studio_eta ?? null;
  const dueDate = (before as { due_date: string | null } | null)?.due_date ?? null;

  const { error } = await supabase
    .from("techpack_jobs")
    .update({ studio_eta: eta, studio_eta_set_at: new Date().toISOString() })
    .eq("id", job.id);
  if (error) return { success: false, error: missingColumn(error) ? NEEDS_051 : error.message };

  if (!eta || eta === previous) return { success: true };

  // Worth telling someone about when it is news: a first date, a date
  // that has moved back, or a date past what we asked for. A studio
  // pulling work forward does not need to generate an email.
  const movedBack = previous != null && eta > previous;
  const pastDue = dueDate != null && eta > dueDate;
  if (previous == null || movedBack || pastDue) {
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", job.product_id)
      .maybeSingle();
    const name = (product as { name: string } | null)?.name ?? "a product";
    const when = new Date(`${eta}T00:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", timeZone: "UTC",
    });

    await notifyAgency({
      agencyId: job.agency_id,
      headline: pastDue
        ? `${studio.name} expects ${name} on ${when} — after the date we asked for`
        : `${studio.name} expects ${name} on ${when}`,
      who: input.authorName?.trim() || studio.name,
      quote: previous
        ? `Moved from ${previous} to ${eta}.` + (dueDate ? ` We asked for ${dueDate}.` : "")
        : `They expect to deliver on ${eta}.` + (dueDate ? ` We asked for ${dueDate}.` : ""),
      url: buildPublicUrl(`/techpacks`),
      linkLabel: "Open tech packs",
      relatedType: "product",
      relatedId: job.product_id,
    });
  }

  return { success: true };
}

/** "This is what I'm on today." Their ordering, no email. */
export async function setStudioRank(input: {
  token: string;
  jobId: string;
  rank: StudioRank | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { studio, job } = await jobForStudio(input.token, input.jobId);
  if (!studio || !job) return { success: false, error: "Not allowed" };

  const rank = isStudioRank(input.rank) ? input.rank : null;

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase
    .from("techpack_jobs")
    .update({ studio_rank: rank })
    .eq("id", job.id);
  if (error) return { success: false, error: missingColumn(error) ? NEEDS_051 : error.message };
  return { success: true };
}
