"use server";

import { revalidatePath } from "next/cache";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { notifyAgency } from "@/lib/email/portal-notify";
import { buildPublicUrl } from "@/lib/url";

// ─────────────────────────────────────────────────────────────
// The client's half of a tech pack.
//
// The portal has no login — the client id in the URL is the whole
// credential — so nothing here trusts what it is handed. Every call walks
// techpack → product → project → client and checks the chain itself, the
// same way the rest of the portal's writes do.
//
// Signing is a tick and a name. It is not a legal instrument; it is a
// record of who said "build this" and when, which is the thing you need
// when a sample arrives and somebody asks why it looks like that.
// ─────────────────────────────────────────────────────────────

export interface PortalTechPack {
  id: string;
  version: number;
  title: string | null;
  change_note: string | null;
  file_url: string;
  file_name: string | null;
  uploaded_by: string;
  agency_signed_at: string | null;
  client_signed_at: string | null;
  client_signed_name: string | null;
  superseded_at: string | null;
  created_at: string;
}

/** Confirms this tech pack really belongs to this client. */
async function ownedByClient(
  techpackId: string,
  clientId: string,
): Promise<{ productId: string; agencyId: string; version: number } | null> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_techpacks")
    .select("product_id, agency_id, version, client_id")
    .eq("id", techpackId)
    .maybeSingle();
  const pack = data as
    | { product_id: string; agency_id: string; version: number; client_id: string | null }
    | null;
  if (!pack) return null;

  // client_id is denormalised onto the pack, but it is not the authority —
  // the product's own project is. Checking the chain means a pack written
  // with the wrong client_id cannot be signed by the wrong client.
  const { data: product } = await supabase
    .from("products")
    .select("project_id")
    .eq("id", pack.product_id)
    .maybeSingle();
  const projectId = (product as { project_id: string | null } | null)?.project_id;
  if (!projectId) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if ((project as { client_id: string | null } | null)?.client_id !== clientId) return null;

  return { productId: pack.product_id, agencyId: pack.agency_id, version: pack.version };
}

export async function listTechPacksForPortal(
  productId: string,
  clientId: string,
): Promise<PortalTechPack[]> {
  const supabase = getAgencyServiceSupabase();

  // Same ownership walk, from the product end.
  const { data: product } = await supabase
    .from("products")
    .select("project_id")
    .eq("id", productId)
    .maybeSingle();
  const projectId = (product as { project_id: string | null } | null)?.project_id;
  if (!projectId) return [];
  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  if ((project as { client_id: string | null } | null)?.client_id !== clientId) return [];

  const { data, error } = await supabase
    .from("product_techpacks")
    .select(
      "id, version, title, change_note, file_url, file_name, uploaded_by, " +
        "agency_signed_at, client_signed_at, client_signed_name, superseded_at, created_at",
    )
    .eq("product_id", productId)
    .order("version", { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as PortalTechPack[];
}

/**
 * "I've signed off on this."
 *
 * Only the current version can be signed. Signing a superseded pack would
 * record agreement to a specification that has already been replaced, which
 * is worse than no signature at all.
 */
export async function signTechPackAsClient(input: {
  techpackId: string;
  clientId: string;
  signedName: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const name = input.signedName.trim().slice(0, 120);
  if (!name) return { success: false, error: "Please put your name to it" };

  const owned = await ownedByClient(input.techpackId, input.clientId);
  if (!owned) return { success: false, error: "Not allowed" };

  const supabase = getAgencyServiceSupabase();

  const { data: current } = await supabase
    .from("product_techpacks")
    .select("superseded_at, agency_signed_at, client_signed_at")
    .eq("id", input.techpackId)
    .maybeSingle();
  const pack = current as
    | { superseded_at: string | null; agency_signed_at: string | null; client_signed_at: string | null }
    | null;
  if (!pack) return { success: false, error: "Tech pack not found" };
  if (pack.superseded_at) {
    return { success: false, error: "A newer version has replaced this one — sign the latest instead." };
  }
  if (pack.client_signed_at) return { success: true };
  if (!pack.agency_signed_at) {
    return { success: false, error: "We haven't finished checking this version yet. We'll let you know when it's ready." };
  }

  const { error } = await supabase
    .from("product_techpacks")
    .update({ client_signed_at: new Date().toISOString(), client_signed_name: name })
    .eq("id", input.techpackId);
  if (error) return { success: false, error: error.message };

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", owned.productId)
    .maybeSingle();
  const productName = (product as { name: string } | null)?.name ?? "a product";

  await notifyAgency({
    agencyId: owned.agencyId,
    headline: `Tech pack signed off — ${productName} v${owned.version}`,
    who: name,
    quote: "They've signed the specification. It's clear to cut a sample from this version.",
    url: buildPublicUrl(`/products/${owned.productId}`),
    linkLabel: "Open the product",
    relatedType: "product",
    relatedId: owned.productId,
  });

  revalidatePath(`/portal/${input.clientId}`);
  revalidatePath(`/products/${owned.productId}`);
  return { success: true };
}

/**
 * A client supplying their own pack.
 *
 * Lands unsigned on our side on purpose: a pack we have not read is not a
 * pack we have agreed to, and the sample gets cut from something both
 * signatures sit on.
 */
export async function uploadTechPackAsClient(input: {
  productId: string;
  clientId: string;
  fileUrl: string;
  filePath?: string | null;
  fileName?: string | null;
  uploaderName?: string | null;
  changeNote?: string | null;
}): Promise<{ success: true; version: number } | { success: false; error: string }> {
  if (!input.fileUrl) return { success: false, error: "Upload a file first" };

  const supabase = getAgencyServiceSupabase();

  const { data: product } = await supabase
    .from("products")
    .select("name, project_id, agency_id")
    .eq("id", input.productId)
    .maybeSingle();
  const prod = product as { name: string; project_id: string | null; agency_id: string } | null;
  if (!prod?.project_id) return { success: false, error: "Not allowed" };

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", prod.project_id)
    .maybeSingle();
  if ((project as { client_id: string | null } | null)?.client_id !== input.clientId) {
    return { success: false, error: "Not allowed" };
  }

  const { data: latest } = await supabase
    .from("product_techpacks")
    .select("version")
    .eq("product_id", input.productId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest as { version: number } | null)?.version ?? 0) + 1;

  const { error } = await supabase.from("product_techpacks").insert({
    agency_id: prod.agency_id,
    product_id: input.productId,
    client_id: input.clientId,
    version,
    change_note: input.changeNote?.trim() || null,
    file_url: input.fileUrl,
    file_path: input.filePath ?? null,
    file_name: input.fileName ?? null,
    uploaded_by: "client",
    uploader_name: input.uploaderName?.slice(0, 120) ?? null,
  });
  if (error) return { success: false, error: error.message };

  await supabase
    .from("product_techpacks")
    .update({ superseded_at: new Date().toISOString() })
    .eq("product_id", input.productId)
    .lt("version", version)
    .is("superseded_at", null);

  await notifyAgency({
    agencyId: prod.agency_id,
    headline: `Tech pack uploaded by the client — ${prod.name} v${version}`,
    who: input.uploaderName ?? "The client",
    quote:
      (input.changeNote?.trim() ? `${input.changeNote.trim()}\n\n` : "") +
      "Needs reading and signing on our side before they can sign it.",
    url: buildPublicUrl(`/products/${input.productId}`),
    linkLabel: "Open the product",
    relatedType: "product",
    relatedId: input.productId,
  });

  revalidatePath(`/portal/${input.clientId}`);
  revalidatePath(`/products/${input.productId}`);
  return { success: true, version };
}
