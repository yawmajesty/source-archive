"use server";

import { auth } from "@clerk/nextjs/server";
import { getAgencyServiceSupabase } from "./supabase-agency";

// ─────────────────────────────────────────────────────────────
// Upload authorization.
//
// Uploads used to run straight from the browser with the client in
// lib/supabase.ts. That client is cookie-aware (createBrowserClient), so any
// browser still holding a pre-Clerk Supabase auth cookie sent that expired
// session JWT instead of the anon key, and storage rejected the write.
//
// Now the browser asks the server for a one-time signed upload token and PUTs
// the file straight to Supabase with it. No session, no cookie. The file never
// passes through this server, so the 1MB Server Action body limit doesn't
// apply and large photos still work.
//
// Server Functions are reachable by direct POST, not just through our UI, so
// this validates the bucket, the path, and (for staff-only buckets) the caller.
// ─────────────────────────────────────────────────────────────

// Buckets written by unauthenticated public surfaces: the client portal, the
// public brief form, and the token-gated factory RFQ portal.
const PUBLIC_BUCKETS = new Set(["product-media", "brief-attachments", "rfq-assets", "rfq-media"]);

// Buckets only signed-in agency staff may write to.
const AUTHED_BUCKETS = new Set(["brand-assets", "brand-receipts"]);

export interface UploadTicket {
  bucket: string | null;
  path: string | null;
  token: string | null;
  error: string | null;
}

function reject(error: string): UploadTicket {
  return { bucket: null, path: null, token: null, error };
}

export async function createUploadTicket(bucket: string, path: string): Promise<UploadTicket> {
  const known = PUBLIC_BUCKETS.has(bucket) || AUTHED_BUCKETS.has(bucket);
  if (!known) return reject(`Uploads are not allowed to "${bucket}".`);

  // Keep the caller inside the bucket: no absolute paths, no traversal.
  if (!path || path.startsWith("/") || path.includes("..")) {
    return reject("Invalid upload path.");
  }

  if (AUTHED_BUCKETS.has(bucket)) {
    const { userId } = await auth();
    if (!userId) return reject("You must be signed in to upload this file.");
  }

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) return reject(error?.message ?? "Could not authorize the upload.");
  return { bucket, path: data.path, token: data.token, error: null };
}
