"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";

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
}

export async function listClientFiles(clientId: string): Promise<{ files: SharedFile[]; setupNeeded: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { files: [], setupNeeded: false };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("portal_files")
    .select("id, filename, size_kb, source, uploaded_at, file_url, uploaded_by_name, note")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });

  if (error) return { files: [], setupNeeded: notSetUp(error) };
  return { files: (data ?? []) as unknown as SharedFile[], setupNeeded: false };
}

export async function shareFileWithClient(input: {
  clientId: string;
  fileUrl: string;
  filePath: string;
  filename: string;
  sizeBytes: number;
  contentType?: string | null;
  note?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to share files with this client" };
  }
  if (!input.fileUrl) return { success: false, error: "Upload failed — nothing to record" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("portal_files").insert({
    agency_id: ctx.agency.id,
    client_id: input.clientId,
    project_id: null,
    filename: input.filename.slice(0, 240),
    size_kb: Math.max(1, Math.round(input.sizeBytes / 1024)),
    source: "agency",
    file_url: input.fileUrl,
    file_path: input.filePath,
    content_type: input.contentType ?? null,
    uploaded_by_name: ctx.agency.name ?? null,
    note: input.note?.trim()?.slice(0, 500) || null,
  });
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  // The client is told, because a file shared silently is a file nobody opens.
  try {
    const { notifyPortalUpdate } = await import("@/lib/email/portal-notify");
    await notifyPortalUpdate({
      agencyId: ctx.agency.id,
      clientId: input.clientId,
      headline: `New file in your portal — ${input.filename}`,
      detail: input.note?.trim() || "It's under Files in your portal.",
      linkLabel: "Open Files",
      relatedId: input.clientId,
    });
  } catch (err) {
    console.error("[files] could not notify the client:", err);
  }

  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath(`/portal/${input.clientId}`);
  return { success: true };
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
