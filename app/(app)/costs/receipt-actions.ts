"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { receiptName, type CostReceipt } from "@/lib/cost-receipts";

// ─────────────────────────────────────────────────────────────
// Reading and removing the files attached to a cost entry.
//
// The bucket is private and carries no storage policies of its own, so
// every byte goes through the service-role client. That bypasses RLS, which
// is exactly why each function here first asks the RLS-bound client whether
// this agency can see the expense at all. If the answer is no — wrong
// agency, or a member without `cost.view` — nothing is listed, signed or
// deleted.
//
// Nothing is written to the database. See lib/cost-receipts.ts for why the
// files are the record.
// ─────────────────────────────────────────────────────────────

const BUCKET = "cost-receipts";

/** Long enough to read a PDF, short enough that a copied link goes stale. */
const LINK_TTL_SECONDS = 60 * 60;

/**
 * The agency folder for an expense, or a reason there isn't one.
 * `null` folder means "not yours", and every caller treats that as empty
 * rather than as an error worth shouting about.
 */
async function folderFor(costId: string): Promise<{ folder: string | null; error: string | null }> {
  if (!costId || !/^[A-Za-z0-9_-]{3,64}$/.test(costId)) {
    return { folder: null, error: "Unknown entry." };
  }
  const ctx = await getAgencyContext();
  if (!ctx) return { folder: null, error: "You are not signed in." };

  const db = await getAgencySupabase();
  const { data, error } = await db.from("costs").select("id").eq("id", costId).maybeSingle();
  if (error) return { folder: null, error: error.message };
  if (!data) return { folder: null, error: "That entry no longer exists." };

  return { folder: `${ctx.agency.id}/${costId}`, error: null };
}

export async function listCostReceipts(
  costId: string,
): Promise<{ receipts: CostReceipt[]; error: string | null }> {
  const { folder, error } = await folderFor(costId);
  if (!folder) return { receipts: [], error };

  const svc = getAgencyServiceSupabase();
  const listed = await svc.storage.from(BUCKET).list(folder, {
    limit: 100,
    sortBy: { column: "created_at", order: "asc" },
  });
  if (listed.error) return { receipts: [], error: listed.error.message };

  // Folders come back with a null id. There are none in here, but a listing
  // that assumed otherwise would hand a prefix to createSignedUrls and get
  // an opaque failure back.
  const files = (listed.data ?? []).filter((entry) => entry.id);
  if (files.length === 0) return { receipts: [], error: null };

  const paths = files.map((f) => `${folder}/${f.name}`);
  const signed = await svc.storage.from(BUCKET).createSignedUrls(paths, LINK_TTL_SECONDS);
  if (signed.error) return { receipts: [], error: signed.error.message };

  const urlFor = new Map(
    (signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl ?? ""]),
  );

  const receipts: CostReceipt[] = files.map((f, i) => {
    const path = paths[i];
    const meta = (f.metadata ?? {}) as { size?: number; mimetype?: string };
    return {
      path,
      name: receiptName(f.name),
      size: Number(meta.size) || 0,
      mimeType: typeof meta.mimetype === "string" ? meta.mimetype : "",
      url: urlFor.get(path) ?? "",
      uploadedAt: f.created_at ?? new Date().toISOString(),
    };
  });

  return { receipts, error: null };
}

export async function removeCostReceipt(
  costId: string,
  path: string,
): Promise<{ success: boolean; error?: string }> {
  const { folder, error } = await folderFor(costId);
  if (!folder) return { success: false, error: error ?? "Not allowed." };

  // The browser hands back a path this server handed it, but it is still the
  // browser. Anything outside this expense's own folder is refused.
  if (!path.startsWith(`${folder}/`) || path.includes("..")) {
    return { success: false, error: "That file is not on this entry." };
  }

  const svc = getAgencyServiceSupabase();
  const { error: removeError } = await svc.storage.from(BUCKET).remove([path]);
  if (removeError) return { success: false, error: removeError.message };
  return { success: true };
}

/**
 * Which expenses have anything attached, as one listing of the agency's
 * folder. Called by the page so a few hundred rows can show a paperclip
 * without a few hundred round trips.
 */
export async function costsWithReceipts(): Promise<string[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];

  const svc = getAgencyServiceSupabase();
  const ids: string[] = [];
  const page = 1000;

  // Paged, because the ceiling here is "every expense the agency has ever
  // photographed" and that number only goes up.
  for (let offset = 0; offset < page * 20; offset += page) {
    const { data, error } = await svc.storage
      .from(BUCKET)
      .list(ctx.agency.id, { limit: page, offset });
    if (error || !data) break;
    for (const entry of data) if (!entry.id) ids.push(entry.name);
    if (data.length < page) break;
  }

  return ids;
}
