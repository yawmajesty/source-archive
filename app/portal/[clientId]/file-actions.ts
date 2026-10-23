"use server";

import { revalidatePath } from "next/cache";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { notifyAgency } from "@/lib/email/portal-notify";
import { buildPublicUrl } from "@/lib/url";
import { FILE_TAGS, FILE_TAG_LABEL } from "@/lib/portal-file-tags";

// ─────────────────────────────────────────────────────────────
// A client putting a file in their own portal.
//
// The portal has no login, so the client id in the URL is the whole
// credential and nothing here trusts anything else: the client is looked up
// and must have its portal switched on before a row is written. A link
// holder for a disabled portal cannot use this as an open file drop.
// ─────────────────────────────────────────────────────────────

const SETUP = "File sharing needs a one-time database step — run migrations/047_portal_file_sharing.sql.";
const TAG_SETUP = "File tagging needs a one-time database step — run migrations/048_portal_file_tags.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /file_url|file_path|content_type|uploaded_by_name/.test(error.message)
  );
}

export async function uploadPortalFile(input: {
  clientId: string;
  fileUrl: string;
  filePath: string;
  filename: string;
  sizeBytes: number;
  contentType?: string | null;
  uploaderName?: string | null;
  note?: string | null;
  tag?: string | null;
  productId?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!input.fileUrl) return { success: false, error: "Upload failed — nothing to record" };

  const supabase = getAgencyServiceSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("agency_id, name, portal_enabled")
    .eq("id", input.clientId)
    .maybeSingle();
  const row = client as { agency_id: string; name: string; portal_enabled: boolean | null } | null;
  if (!row || row.portal_enabled === false) return { success: false, error: "Not allowed" };

  // A product can only be attached if it really belongs to this client.
  // The picker only offers their own, but the picker is not the authority.
  let productId: string | null = null;
  if (input.productId) {
    const { data: owned } = await supabase
      .from("products")
      .select("id, project_id")
      .eq("id", input.productId)
      .maybeSingle();
    const projectId = (owned as { project_id: string | null } | null)?.project_id;
    if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", projectId)
        .maybeSingle();
      if ((project as { client_id: string | null } | null)?.client_id === input.clientId) {
        productId = input.productId;
      }
    }
  }

  const tag = FILE_TAGS.some((t) => t.id === input.tag) ? input.tag : null;

  const { error } = await supabase.from("portal_files").insert({
    agency_id: row.agency_id,
    client_id: input.clientId,
    project_id: null,
    tag,
    product_id: productId,
    filename: input.filename.slice(0, 240),
    // Kept in KB because that is what the column has always been, and the
    // existing rows and the UI both read it that way.
    size_kb: Math.max(1, Math.round(input.sizeBytes / 1024)),
    source: "client",
    file_url: input.fileUrl,
    file_path: input.filePath,
    content_type: input.contentType ?? null,
    uploaded_by_name: input.uploaderName?.slice(0, 120) ?? null,
    note: input.note?.trim()?.slice(0, 500) || null,
  });
  if (error) {
    if (/\btag\b|product_id/.test(error.message)) return { success: false, error: TAG_SETUP };
    return { success: false, error: notSetUp(error) ? SETUP : error.message };
  }

  await notifyAgency({
    agencyId: row.agency_id,
    headline: `File uploaded — ${row.name}`,
    who: input.uploaderName ?? row.name,
    quote:
      `${input.filename}` +
      `${tag ? ` · ${FILE_TAG_LABEL[tag]}` : ""}` +
      `${productId ? " · attached to a product" : ""}` +
      `${input.note ? `\n\n${input.note}` : ""}`,
    url: buildPublicUrl(`/clients/${input.clientId}`),
    linkLabel: "Open the client",
    relatedType: "client",
    relatedId: input.clientId,
  });

  revalidatePath(`/portal/${input.clientId}`);
  revalidatePath(`/clients/${input.clientId}`);
  return { success: true };
}

/** A client removing something they put there themselves. */
export async function deletePortalFileAsClient(input: {
  fileId: string;
  clientId: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = getAgencyServiceSupabase();

  const { data } = await supabase
    .from("portal_files")
    .select("client_id, source, file_path")
    .eq("id", input.fileId)
    .maybeSingle();
  const file = data as { client_id: string; source: string; file_path: string | null } | null;
  if (!file || file.client_id !== input.clientId) return { success: false, error: "Not allowed" };
  // Their own uploads only. A client cannot delete what the agency shared
  // with them — that is the agency's record of what it sent.
  if (file.source !== "client") {
    return { success: false, error: "Only files you uploaded can be removed here" };
  }

  const { error } = await supabase.from("portal_files").delete().eq("id", input.fileId);
  if (error) return { success: false, error: error.message };

  if (file.file_path) {
    try {
      await supabase.storage.from("portal-files").remove([file.file_path]);
    } catch {
      // The row is gone, which is what the client asked for. An orphaned
      // object shows up in Settings → Storage rather than failing this.
    }
  }

  revalidatePath(`/portal/${input.clientId}`);
  return { success: true };
}
