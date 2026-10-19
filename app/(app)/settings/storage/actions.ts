"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────
// What storage is costing.
//
// Through two SQL functions rather than the storage API: a recursive walk
// of the buckets is one round trip per folder and had not finished after
// two minutes when I tried it. The same answer comes back from one query
// against storage.objects.
// ─────────────────────────────────────────────────────────────

const SETUP = "Storage usage needs a one-time database step — run migrations/046_storage_usage.sql.";

export interface BucketUsage {
  bucket: string;
  files: number;
  bytes: number;
  /** What this bucket holds, in plain words. */
  holds: string;
}

export interface LargeFile {
  bucket: string;
  name: string;
  bytes: number;
  created_at: string;
}

export interface StorageReport {
  buckets: BucketUsage[];
  largest: LargeFile[];
  totalBytes: number;
  totalFiles: number;
  /** What the plan includes, so the number means something. */
  includedBytes: number;
  setupNeeded: boolean;
}

/** Each bucket, in words, so the page is readable by whoever pays the bill. */
const DESCRIBES: Record<string, string> = {
  "product-media": "Product photos, videos and tech packs",
  "brief-attachments": "Files sent with enquiry briefs",
  "brief-media": "Images from portal product briefs",
  "moodboard-media": "Client moodboard images",
  "shoot-media": "Shoot and campaign references",
  "brand-assets": "Logos and portal branding",
  "brand-receipts": "Receipts from the studio tracker",
  "rfq-media": "RFQ attachments",
  "rfq-assets": "RFQ attachments",
  backups: "Nightly database backups",
};

export async function getStorageReport(): Promise<StorageReport> {
  const empty: StorageReport = {
    buckets: [], largest: [], totalBytes: 0, totalFiles: 0,
    includedBytes: 100 * 1024 * 1024 * 1024, setupNeeded: false,
  };

  const ctx = await getAgencyContext();
  if (!ctx) return empty;
  // The storage bill is the agency's business, not every member's.
  if (ctx.role !== "admin" && !can(ctx.role, ctx.permissions, "cost.view")) return empty;

  // Service role: these functions read the storage schema, which the
  // request-scoped role cannot reach even through a definer function's grant.
  const supabase = getAgencyServiceSupabase();

  const [usageRes, largestRes] = await Promise.all([
    supabase.rpc("storage_usage"),
    supabase.rpc("storage_largest", { limit_rows: 25 }),
  ]);

  if (usageRes.error) {
    return { ...empty, setupNeeded: /storage_usage|does not exist|function/i.test(usageRes.error.message) };
  }

  const rows = (usageRes.data ?? []) as Array<{ bucket_id: string; file_count: number; total_bytes: number }>;
  const buckets: BucketUsage[] = rows.map((r) => ({
    bucket: r.bucket_id,
    files: Number(r.file_count),
    bytes: Number(r.total_bytes),
    holds: DESCRIBES[r.bucket_id] ?? "Uploads",
  }));

  const largest = ((largestRes.data ?? []) as Array<{
    bucket_id: string; name: string; bytes: number; created_at: string;
  }>).map((r) => ({
    bucket: r.bucket_id, name: r.name, bytes: Number(r.bytes), created_at: r.created_at,
  }));

  return {
    buckets,
    largest,
    totalBytes: buckets.reduce((s, b) => s + b.bytes, 0),
    totalFiles: buckets.reduce((s, b) => s + b.files, 0),
    // Supabase Pro includes 100GB of storage; the image transformations this
    // app relies on are a Pro feature, so that is the plan it is on.
    includedBytes: 100 * 1024 * 1024 * 1024,
    setupNeeded: false,
  };
}

/** Remove a file that is only taking up room. */
export async function deleteStorageObject(
  bucket: string,
  name: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (ctx.role !== "admin") return { success: false, error: "Only an admin can delete stored files" };

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase.storage.from(bucket).remove([name]);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
