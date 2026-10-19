import { createClient } from "@supabase/supabase-js";
import { createUploadTicket } from "./storage-actions";

// Deliberately NOT the cookie-aware client from lib/supabase.ts. That one
// (createBrowserClient) attaches any Supabase auth cookie it finds as the
// Authorization header — including long-expired ones left over from before
// the April 2026 move to Clerk — which made storage reject the upload.
//
// This client carries no session at all. Uploads are authorized by the
// one-time token minted in storage-actions.ts.
const uploadClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * The project's upload ceiling, in bytes.
 *
 * Supabase enforces this per project, not per bucket — every bucket here
 * has no limit of its own, so this one number governs all of them. Probed
 * rather than assumed: a bucket limit of 50MB is accepted and 100MB comes
 * back 413 EntityTooLarge, which is the same error an oversized upload
 * produces.
 *
 * Raising it is a dashboard setting (Storage → Settings → Upload file size
 * limit), so this reads from the environment: set NEXT_PUBLIC_MAX_UPLOAD_MB
 * to match whatever it is changed to and the guard follows without a code
 * change.
 */
export const MAX_UPLOAD_BYTES = (() => {
  const configured = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);
  const mb = Number.isFinite(configured) && configured > 0 ? configured : 50;
  return Math.round(mb * 1024 * 1024);
})();

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<UploadResult> {
  // Checked here rather than letting Supabase reject it. The server's answer
  // is "The object exceeded the maximum allowed size", which does not say
  // what the size was, what the limit is, or what to do — and by the time it
  // arrives the whole file has been sent.
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      url: null,
      error:
        `That file is ${formatBytes(file.size)} and the limit is ${formatBytes(MAX_UPLOAD_BYTES)}. ` +
        `Compressing the PDF usually does it — or the limit can be raised in Supabase under ` +
        `Storage → Settings.`,
    };
  }

  const ticket = await createUploadTicket(bucket, path);
  if (ticket.error || !ticket.token) {
    console.error("[storage upload] authorization failed:", ticket.error);
    return { url: null, error: ticket.error ?? "Could not authorize the upload." };
  }

  // The file goes browser → Supabase directly, so it never hits the 1MB
  // Server Action body limit.
  // Use the server's canonical key, not the caller's raw path — the server
  // may have sanitized it, and the token is bound to the sanitized key.
  const key = ticket.path ?? path;

  const { error } = await uploadClient.storage
    .from(bucket)
    .uploadToSignedUrl(key, ticket.token, file, {
      contentType: file.type || undefined,
      cacheControl: "31536000, immutable",
    });

  if (error) {
    console.error("[storage upload]", error.message);
    return { url: null, error: error.message };
  }

  const { data } = uploadClient.storage.from(bucket).getPublicUrl(key);
  return { url: data.publicUrl, error: null };
}
