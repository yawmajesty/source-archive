"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { notifyAgency } from "@/lib/email/portal-notify";
import { buildPublicUrl } from "@/lib/url";

// ─────────────────────────────────────────────────────────────
// The tech pack studio's standing link.
//
// An outside studio draws our packs. They bookmark one link and see only
// the jobs we have assigned them — never the client list, never anybody
// else's work. There is no login, so the token in the URL is the whole
// credential and every call re-checks it rather than trusting a job id
// handed back by the browser.
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
  status: string;
  brief: string | null;
  dueDate: string | null;
  deliveredAt: string | null;
  productId: string;
  productName: string;
  clientName: string | null;
  /** The highest version already on this product, 0 when none. */
  currentVersion: number;
  /** What this studio has already delivered against the job. */
  delivered: Array<{ version: number; fileName: string | null; fileUrl: string; createdAt: string }>;
}

export interface StudioBoard {
  studioName: string;
  jobs: StudioJob[];
  /** Set when the link is unusable, so the page can say which. */
  problem: "unknown" | "revoked" | "setup" | null;
  setupMessage?: string;
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

export async function getStudioBoard(token: string): Promise<StudioBoard> {
  const empty: StudioBoard = { studioName: "", jobs: [], problem: "unknown" };
  if (!token) return empty;

  const supabase = getAgencyServiceSupabase();
  const { error: lookupError, studio } = await studioFor(token);
  if (lookupError) {
    return notSetUp(lookupError)
      ? { studioName: "", jobs: [], problem: "setup", setupMessage: SETUP }
      : empty;
  }
  if (!studio) return empty;
  if (studio.revoked_at) return { studioName: studio.name, jobs: [], problem: "revoked" };

  const { data: jobRows } = await supabase
    .from("techpack_jobs")
    .select("id, status, brief, due_date, delivered_at, product_id, client_id, created_at")
    .eq("studio_id", studio.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const jobs = (jobRows ?? []) as Array<{
    id: string; status: string; brief: string | null; due_date: string | null;
    delivered_at: string | null; product_id: string; client_id: string | null;
  }>;
  if (jobs.length === 0) return { studioName: studio.name, jobs: [], problem: null };

  // Names and versions fetched in three queries rather than per job.
  const productIds = Array.from(new Set(jobs.map((j) => j.product_id)));
  const clientIds = Array.from(new Set(jobs.map((j) => j.client_id).filter(Boolean) as string[]));

  const [productsRes, clientsRes, packsRes] = await Promise.all([
    supabase.from("products").select("id, name").in("id", productIds),
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    supabase
      .from("product_techpacks")
      .select("product_id, version, file_name, file_url, created_at")
      .in("product_id", productIds)
      .order("version", { ascending: false }),
  ]);

  const productName = new Map(
    ((productsRes.data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]),
  );
  const clientName = new Map(
    ((clientsRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );
  const packs = (packsRes.data ?? []) as Array<{
    product_id: string; version: number; file_name: string | null; file_url: string; created_at: string;
  }>;

  return {
    studioName: studio.name,
    problem: null,
    jobs: jobs.map((job) => {
      const mine = packs.filter((p) => p.product_id === job.product_id);
      return {
        id: job.id,
        status: job.status,
        brief: job.brief,
        dueDate: job.due_date,
        deliveredAt: job.delivered_at,
        productId: job.product_id,
        productName: productName.get(job.product_id) ?? "Unnamed product",
        clientName: job.client_id ? clientName.get(job.client_id) ?? null : null,
        currentVersion: mine[0]?.version ?? 0,
        delivered: mine.map((p) => ({
          version: p.version,
          fileName: p.file_name,
          fileUrl: p.file_url,
          createdAt: p.created_at,
        })),
      };
    }),
  };
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

  const { error: lookupError, studio } = await studioFor(input.token);
  if (lookupError) return { success: false, error: notSetUp(lookupError) ? SETUP : lookupError.message };
  if (!studio || studio.revoked_at) return { success: false, error: "This link is no longer active" };

  const supabase = getAgencyServiceSupabase();

  // The job id comes from the browser, so it is checked against the studio
  // the token belongs to rather than taken at face value.
  const { data: jobRow } = await supabase
    .from("techpack_jobs")
    .select("id, studio_id, agency_id, product_id, client_id, status")
    .eq("id", input.jobId)
    .maybeSingle();
  const job = jobRow as {
    id: string; studio_id: string | null; agency_id: string;
    product_id: string; client_id: string | null; status: string;
  } | null;
  if (!job || job.studio_id !== studio.id) return { success: false, error: "Not allowed" };
  if (job.status === "cancelled") return { success: false, error: "This job was cancelled" };

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
