"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { AGENCY_TABLES, backupFilename, type BackupFile } from "@/lib/backup";

/**
 * Take a backup.
 *
 * Uses the service-role client because a backup that only contains the
 * rows the person running it happens to be scoped to is not a backup.
 * Admin-only, checked here, for the same reason.
 */
export async function runBackup(
  trigger: "manual" | "scheduled" = "manual",
  agencyIdOverride?: string,
): Promise<
  { success: true; path: string; rowTotal: number; bytes: number; failed: string[] }
  | { success: false; error: string }
> {
  let agencyId = agencyIdOverride;

  if (!agencyId) {
    const ctx = await getAgencyContext();
    if (!ctx) return { success: false, error: "Not a member of any agency" };
    if (ctx.role !== "admin") return { success: false, error: "Only admins can take a backup" };
    agencyId = ctx.agency.id;
  }

  const supabase = getAgencyServiceSupabase();
  const data: Record<string, unknown[]> = {};
  const tables: Record<string, number> = {};
  const failed: string[] = [];
  let rowTotal = 0;

  for (const table of AGENCY_TABLES) {
    try {
      // Not every table carries agency_id; the ones that don't are
      // reached through their parent and fall back to a full read.
      const { data: rows, error } = await supabase.from(table).select("*").eq("agency_id", agencyId);
      if (error) {
        const { data: all, error: allError } = await supabase.from(table).select("*");
        if (allError) { failed.push(table); continue; }
        data[table] = all ?? [];
      } else {
        data[table] = rows ?? [];
      }
      tables[table] = data[table].length;
      rowTotal += data[table].length;
    } catch {
      failed.push(table);
    }
  }

  const file: BackupFile = {
    takenAt: new Date().toISOString(),
    agencyId,
    tables,
    rowTotal,
    failed,
    data,
  };

  const body = JSON.stringify(file);
  const bytes = new TextEncoder().encode(body).length;
  const path = backupFilename(agencyId);

  const { error: uploadError } = await supabase.storage
    .from("backups")
    .upload(path, body, { contentType: "application/json", upsert: true });

  if (uploadError) {
    await supabase.from("backup_runs").insert({
      agency_id: agencyId, status: "failed", error: uploadError.message,
      trigger, table_counts: tables, row_total: rowTotal,
    });
    return { success: false, error: uploadError.message };
  }

  await supabase.from("backup_runs").insert({
    agency_id: agencyId,
    storage_path: path,
    table_counts: tables,
    row_total: rowTotal,
    bytes,
    status: "ok",
    trigger,
  });

  revalidatePath("/settings");
  return { success: true, path, rowTotal, bytes, failed };
}

export interface BackupRun {
  id: string;
  storage_path: string | null;
  row_total: number;
  bytes: number;
  status: string;
  error: string | null;
  trigger: string;
  created_at: string;
}

export async function listBackups(): Promise<BackupRun[]> {
  const ctx = await getAgencyContext();
  if (!ctx || ctx.role !== "admin") return [];
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("backup_runs").select("*").eq("agency_id", ctx.agency.id)
    .order("created_at", { ascending: false }).limit(30);
  return (data ?? []) as BackupRun[];
}

/**
 * A link to download one.
 *
 * Signed and short-lived: the bucket is private because a backup holds
 * every client's costs, contacts and pricing, and a permanent URL would
 * be a permanent way in.
 */
export async function backupDownloadUrl(
  path: string,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx || ctx.role !== "admin") return { success: false, error: "Only admins can download backups" };
  // The path always begins with the agency id, so this refuses a crafted
  // path pointing at another agency's file.
  if (!path.startsWith(`${ctx.agency.id}/`)) {
    return { success: false, error: "That backup isn't yours" };
  }

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase.storage.from("backups").createSignedUrl(path, 300);
  if (error || !data) return { success: false, error: error?.message ?? "Could not create a link" };
  return { success: true, url: data.signedUrl };
}
