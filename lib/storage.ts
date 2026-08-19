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

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<UploadResult> {
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
      cacheControl: "3600",
    });

  if (error) {
    console.error("[storage upload]", error.message);
    return { url: null, error: error.message };
  }

  const { data } = uploadClient.storage.from(bucket).getPublicUrl(key);
  return { url: data.publicUrl, error: null };
}
