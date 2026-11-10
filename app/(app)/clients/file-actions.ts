"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { FILE_TAGS } from "@/lib/portal-file-tags";

// ─────────────────────────────────────────────────────────────
// Sharing a file with a client.
//
// The other half of the Files tab. "Shared by agency" has had an empty
// state since the beginning telling clients that QC reports and
// certificates would appear there, with nothing anywhere that could put
// one in.
// ─────────────────────────────────────────────────────────────

const SETUP = "File sharing needs a one-time database step — run migrations/047_portal_file_sharing.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /file_url|file_path|content_type|uploaded_by_name|note/.test(error.message)
  );
}

export interface SharedFile {
  id: string;
  filename: string;
  size_kb: number;
  source: string;
  uploaded_at: string;
  file_url: string | null;
  uploaded_by_name: string | null;
  note: string | null;
  tag: string | null;
  product_id: string | null;
  /** Resolved for display, so the panel does not have to look it up. */
  product_name?: string | null;
}

export async function listClientFiles(clientId: string): Promise<{ files: SharedFile[]; setupNeeded: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { files: [], setupNeeded: false };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("portal_files")
    .select("id, filename, size_kb, source, uploaded_at, file_url, uploaded_by_name, note, tag, product_id")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });

  if (error) return { files: [], setupNeeded: notSetUp(error) };

  const files = (data ?? []) as unknown as SharedFile[];

  // One lookup for the products referenced, rather than one per file.
  const ids = Array.from(new Set(files.map((f) => f.product_id).filter(Boolean))) as string[];
  if (ids.length > 0) {
    const { data: products } = await supabase.from("products").select("id, name").in("id", ids);
    const nameOf = new Map(((products ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]));
    for (const f of files) if (f.product_id) f.product_name = nameOf.get(f.product_id) ?? null;
  }

  return { files, setupNeeded: false };
}

export interface ShareableFile {
  fileUrl: string;
  filePath: string;
  filename: string;
  sizeBytes: number;
  contentType?: string | null;
}

/**
 * Files going out to a client, as one delivery.
 *
 * A photo shoot is forty images, not one, and the single-file version of
 * this sent the client an email per file. Forty emails about one delivery
 * is worse than no email at all, so the rows are written together and one
 * message goes out describing the batch.
 */
export async function shareFilesWithClient(input: {
  clientId: string;
  files: ShareableFile[];
  note?: string | null;
  tag?: string | null;
}): Promise<{ success: true; shared: number } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to share files with this client" };
  }

  const files = input.files.filter((f) => f.fileUrl);
  if (files.length === 0) return { success: false, error: "Upload failed — nothing to record" };

  const tag = FILE_TAGS.some((t) => t.id === input.tag) ? input.tag : null;
  const note = input.note?.trim()?.slice(0, 500) || null;
  const supabase = await getAgencySupabase();

  const { error } = await supabase.from("portal_files").insert(
    files.map((f) => ({
      // portal_files.id has no database default.
      id: crypto.randomUUID(),
      agency_id: ctx.agency.id,
      client_id: input.clientId,
      project_id: null,
      tag,
      filename: f.filename.slice(0, 240),
      size_kb: Math.max(1, Math.round(f.sizeBytes / 1024)),
      source: "agency",
      file_url: f.fileUrl,
      file_path: f.filePath,
      content_type: f.contentType ?? null,
      uploaded_by_name: ctx.agency.name ?? null,
      note,
    })),
  );
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  // The client is told, because a file shared silently is a file nobody opens.
  try {
    const { notifyPortalUpdate } = await import("@/lib/email/portal-notify");
    const what = tag === "photography"
      ? files.length === 1 ? "A new photo is in your portal" : `${files.length} new photos are in your portal`
      : files.length === 1 ? `New file in your portal — ${files[0].filename}` : `${files.length} new files in your portal`;
    await notifyPortalUpdate({
      agencyId: ctx.agency.id,
      clientId: input.clientId,
      headline: what,
      detail: note || "They're under Files in your portal.",
      linkLabel: "Open Files",
      relatedId: input.clientId,
    });
  } catch (err) {
    console.error("[files] could not notify the client:", err);
  }

  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath(`/portal/${input.clientId}`);
  return { success: true, shared: files.length };
}

/** One file, through the same path, so there is only one of these to maintain. */
export async function shareFileWithClient(input: {
  clientId: string;
  fileUrl: string;
  filePath: string;
  filename: string;
  sizeBytes: number;
  contentType?: string | null;
  note?: string | null;
  tag?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const res = await shareFilesWithClient({
    clientId: input.clientId,
    note: input.note,
    tag: input.tag,
    files: [{
      fileUrl: input.fileUrl,
      filePath: input.filePath,
      filename: input.filename,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
    }],
  });
  return res.success ? { success: true } : res;
}

export async function deleteSharedFile(
  fileId: string,
  clientId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission" };
  }

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("portal_files")
    .select("file_path")
    .eq("id", fileId)
    .maybeSingle();

  const { error } = await supabase.from("portal_files").delete().eq("id", fileId);
  if (error) return { success: false, error: error.message };

  const path = (data as { file_path: string | null } | null)?.file_path;
  if (path) {
    try {
      await supabase.storage.from("portal-files").remove([path]);
    } catch {
      // The row is gone either way; a stray object surfaces in Settings → Storage.
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/portal/${clientId}`);
  return { success: true };
}
