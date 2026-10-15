"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { buildPublicUrl } from "@/lib/url";

// ─────────────────────────────────────────────────────────────
// Tech packs, and the two signatures that make them mean something.
//
// A tech pack is the specification a sample gets cut from, so it is only
// worth anything if both sides have agreed to the same version of it. Ours
// says the pack is complete; theirs says it is what they want built.
//
// Versioned rather than replaced. "We sampled from v2" is only a
// meaningful sentence if v1 is still on record with its signature, and a
// change after sign-off has to invalidate that sign-off rather than quietly
// altering what was agreed.
// ─────────────────────────────────────────────────────────────

const SETUP = "Tech packs need a one-time database step — run migrations/044_design_and_techpack_phases.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    /product_techpacks|needs_techpack|needs_design/.test(error.message)
  );
}

export interface TechPack {
  id: string;
  product_id: string;
  version: number;
  title: string | null;
  change_note: string | null;
  file_url: string;
  file_name: string | null;
  uploaded_by: string;
  uploader_name: string | null;
  agency_signed_at: string | null;
  agency_signed_by: string | null;
  client_signed_at: string | null;
  client_signed_name: string | null;
  superseded_at: string | null;
  created_at: string;
}

/** Which optional phases this product has opted into. */
export async function setProductPhases(
  productId: string,
  phases: { needs_design?: boolean; needs_techpack?: boolean },
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to change this product" };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("products").update(phases).eq("id", productId);
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/** Every version, newest first. */
export async function listTechPacks(productId: string): Promise<TechPack[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("product_techpacks")
    .select("*")
    .eq("product_id", productId)
    .order("version", { ascending: false });
  if (error) return [];
  return (data ?? []) as TechPack[];
}

/**
 * Add a version.
 *
 * Takes the next number and marks everything before it superseded, so the
 * current pack is always the highest version and the signatures on the old
 * one stay attached to the thing that was actually signed.
 */
export async function addTechPackVersion(input: {
  productId: string;
  fileUrl: string;
  filePath?: string | null;
  fileName?: string | null;
  title?: string | null;
  changeNote?: string | null;
}): Promise<{ success: true; version: number } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to change this product" };
  }
  if (!input.fileUrl) return { success: false, error: "Upload a file first" };

  const supabase = await getAgencySupabase();

  const { data: product } = await supabase
    .from("products")
    .select("name, project_id")
    .eq("id", input.productId)
    .maybeSingle();
  const prod = product as { name: string; project_id: string | null } | null;
  if (!prod) return { success: false, error: "Product not found" };

  const clientId = await clientOfProject(prod.project_id);

  const { data: latest } = await supabase
    .from("product_techpacks")
    .select("version")
    .eq("product_id", input.productId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest as { version: number } | null)?.version ?? 0) + 1;

  const { error } = await supabase.from("product_techpacks").insert({
    agency_id: ctx.agency.id,
    product_id: input.productId,
    client_id: clientId,
    version,
    title: input.title?.trim() || null,
    change_note: input.changeNote?.trim() || null,
    file_url: input.fileUrl,
    file_path: input.filePath ?? null,
    file_name: input.fileName ?? null,
    uploaded_by: "agency",
    uploader_name: ctx.agency.name ?? null,
  });
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };

  // Everything earlier is now history. Done after the insert so a failed
  // upload cannot leave a product with no current pack at all.
  await supabase
    .from("product_techpacks")
    .update({ superseded_at: new Date().toISOString() })
    .eq("product_id", input.productId)
    .lt("version", version)
    .is("superseded_at", null);

  if (clientId) {
    await notifyClientOfTechPack({
      clientId,
      productId: input.productId,
      productName: prod.name,
      version,
      changeNote: input.changeNote ?? null,
      isRevision: version > 1,
    });
  }

  revalidatePath(`/products/${input.productId}`);
  if (clientId) revalidatePath(`/portal/${clientId}`);
  return { success: true, version };
}

/** Our half of the sign-off. */
export async function signTechPackAsAgency(
  techpackId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to sign this off" };
  }

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("product_techpacks")
    .update({
      agency_signed_at: new Date().toISOString(),
      agency_signed_by: ctx.currentUserId,
    })
    .eq("id", techpackId)
    .select("product_id, client_id, version")
    .maybeSingle();

  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
  const row = data as { product_id: string; client_id: string | null; version: number } | null;
  if (!row) return { success: false, error: "Tech pack not found" };

  revalidatePath(`/products/${row.product_id}`);
  if (row.client_id) revalidatePath(`/portal/${row.client_id}`);
  return { success: true };
}

/** Undo a signature, for when something is spotted after signing. */
export async function unsignTechPackAsAgency(
  techpackId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission" };
  }
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("product_techpacks")
    .update({ agency_signed_at: null, agency_signed_by: null })
    .eq("id", techpackId)
    .select("product_id")
    .maybeSingle();
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
  const row = data as { product_id: string } | null;
  if (row) revalidatePath(`/products/${row.product_id}`);
  return { success: true };
}

// ── Helpers ──────────────────────────────────────────────────

async function clientOfProject(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  const service = getAgencyServiceSupabase();
  const { data } = await service
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();
  return (data as { client_id: string | null } | null)?.client_id ?? null;
}

async function notifyClientOfTechPack(input: {
  clientId: string;
  productId: string;
  productName: string;
  version: number;
  changeNote: string | null;
  isRevision: boolean;
}): Promise<void> {
  try {
    const { notifyPortalUpdate } = await import("@/lib/email/portal-notify");
    await notifyPortalUpdate({
      agencyId: (await getAgencyContext())?.agency.id ?? "",
      clientId: input.clientId,
      headline: input.isRevision
        ? `${input.productName} — tech pack v${input.version}, needs signing again`
        : `${input.productName} — tech pack ready to sign`,
      detail: input.isRevision
        ? `${input.changeNote ? `${input.changeNote} ` : ""}Because it has changed, the previous sign-off no longer applies — please read it through and sign v${input.version}.`
        : "Have a read through and sign it off in your portal. Once it's signed we'll cut the sample from it.",
      linkLabel: "Read and sign it",
      relatedId: input.productId,
    });
  } catch (err) {
    // A client who cannot be emailed still has the pack waiting in their portal.
    console.error("[techpack] could not notify the client:", err);
  }
}
