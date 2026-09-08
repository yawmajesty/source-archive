"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { resolvePortalAccess } from "@/app/(app)/clients/member-actions";
import { sendAll, agencyNotificationRecipients } from "@/lib/email/send";
import { buildPublicUrl } from "@/lib/url";
import { notifySlack } from "@/lib/slack";
import type { ProductBrief, BriefMedia } from "@/lib/product-brief";

// ─────────────────────────────────────────────────────────────
// Product briefs, written from the portal.
//
// No Clerk session here, so everything runs through the service-role
// client and every call re-checks portal access for the client it
// resolves. A brief id is never trusted on its own — it is resolved
// back to a client and that client is what gets authorised.
// ─────────────────────────────────────────────────────────────

const OWNER_AGENCY = "ag-source-archive";

async function allowed(clientId: string): Promise<boolean> {
  try {
    return (await resolvePortalAccess(clientId)).allowed;
  } catch {
    return false;
  }
}

async function briefOwner(briefId: string): Promise<{ clientId: string; agencyId: string } | null> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_briefs").select("client_id, agency_id").eq("id", briefId).maybeSingle();
  const row = data as { client_id: string; agency_id: string } | null;
  return row ? { clientId: row.client_id, agencyId: row.agency_id } : null;
}

export async function listBriefs(clientId: string): Promise<ProductBrief[]> {
  if (!(await allowed(clientId))) return [];
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_briefs").select("*").eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []) as ProductBrief[];
}

export async function getBrief(
  briefId: string,
): Promise<{ brief: ProductBrief; media: BriefMedia[] } | null> {
  const owner = await briefOwner(briefId);
  if (!owner || !(await allowed(owner.clientId))) return null;

  const supabase = getAgencyServiceSupabase();
  const [{ data: brief }, { data: media }] = await Promise.all([
    supabase.from("product_briefs").select("*").eq("id", briefId).maybeSingle(),
    supabase.from("product_brief_media").select("*").eq("brief_id", briefId).order("position"),
  ]);
  if (!brief) return null;
  return { brief: brief as ProductBrief, media: (media ?? []) as BriefMedia[] };
}

export async function createBrief(input: {
  clientId: string;
  projectId: string;
  name: string;
}): Promise<{ success: true; brief: ProductBrief } | { success: false; error: string }> {
  if (!(await allowed(input.clientId))) return { success: false, error: "Not allowed" };
  if (!input.name.trim()) return { success: false, error: "Give it a working name" };

  const supabase = getAgencyServiceSupabase();

  // The collection has to belong to this client, or a crafted call could
  // file a brief against someone else's collection.
  const { data: project } = await supabase
    .from("projects").select("client_id, agency_id").eq("id", input.projectId).maybeSingle();
  const p = project as { client_id: string; agency_id: string } | null;
  if (!p || p.client_id !== input.clientId) {
    return { success: false, error: "That collection isn't yours" };
  }

  const { data, error } = await supabase
    .from("product_briefs")
    .insert({
      agency_id: p.agency_id ?? OWNER_AGENCY,
      client_id: input.clientId,
      project_id: input.projectId,
      name: input.name.trim().slice(0, 200),
      status: "draft",
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not start the brief" };
  return { success: true, brief: data as ProductBrief };
}

export async function updateBrief(
  briefId: string,
  patch: Partial<ProductBrief>,
): Promise<{ success: boolean; error?: string }> {
  const owner = await briefOwner(briefId);
  if (!owner || !(await allowed(owner.clientId))) return { success: false, error: "Not allowed" };

  // Never let the portal move a brief between clients or mark its own
  // status — status changes go through submitBrief.
  const { id, agency_id, client_id, project_id, product_id, status, ...safe } =
    patch as Record<string, unknown>;
  void id; void agency_id; void client_id; void project_id; void product_id; void status;

  const supabase = getAgencyServiceSupabase();
  const { error } = await supabase.from("product_briefs").update(safe).eq("id", briefId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function addBriefMedia(input: {
  briefId: string;
  slot: string;
  items: Array<{ image_url: string; storage_path?: string | null }>;
}): Promise<{ success: true; media: BriefMedia[] } | { success: false; error: string }> {
  const owner = await briefOwner(input.briefId);
  if (!owner || !(await allowed(owner.clientId))) return { success: false, error: "Not allowed" };
  if (input.items.length === 0 || input.items.length > 30) {
    return { success: false, error: "Add between 1 and 30 photos at a time" };
  }

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("product_brief_media")
    .insert(
      input.items.map((i, n) => ({
        agency_id: owner.agencyId,
        brief_id: input.briefId,
        slot: input.slot,
        image_url: i.image_url,
        storage_path: i.storage_path ?? null,
        position: n,
      })),
    )
    .select();

  if (error) return { success: false, error: error.message };
  return { success: true, media: (data ?? []) as BriefMedia[] };
}

export async function captionBriefMedia(id: string, note: string): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_brief_media").select("brief_id").eq("id", id).maybeSingle();
  const briefId = (data as { brief_id: string } | null)?.brief_id;
  if (!briefId) return { success: false };
  const owner = await briefOwner(briefId);
  if (!owner || !(await allowed(owner.clientId))) return { success: false };

  await supabase.from("product_brief_media")
    .update({ note: note.slice(0, 500) || null }).eq("id", id);
  return { success: true };
}

export async function removeBriefMedia(id: string): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_brief_media").select("brief_id, storage_path").eq("id", id).maybeSingle();
  const row = data as { brief_id: string; storage_path: string | null } | null;
  if (!row) return { success: false };
  const owner = await briefOwner(row.brief_id);
  if (!owner || !(await allowed(owner.clientId))) return { success: false };

  await supabase.from("product_brief_media").delete().eq("id", id);
  if (row.storage_path) {
    try { await supabase.storage.from("brief-media").remove([row.storage_path]); } catch { /* orphan */ }
  }
  return { success: true };
}

/**
 * Submit the brief, and create the product it describes.
 *
 * The garment appears in the collection immediately, at the first stage,
 * so the client sees the thing they asked for rather than a receipt. The
 * brief stays as its own record: the product is what the agency then
 * edits, and the brief is what was actually asked for, which matters
 * when the two later disagree.
 */
export async function submitBrief(
  briefId: string,
  submittedBy?: { name?: string; email?: string },
): Promise<{ success: true; productId: string } | { success: false; error: string }> {
  const owner = await briefOwner(briefId);
  if (!owner || !(await allowed(owner.clientId))) return { success: false, error: "Not allowed" };

  const supabase = getAgencyServiceSupabase();
  const { data: briefRow } = await supabase
    .from("product_briefs").select("*").eq("id", briefId).maybeSingle();
  const brief = briefRow as ProductBrief | null;
  if (!brief) return { success: false, error: "Brief not found" };
  if (brief.product_id) return { success: true, productId: brief.product_id };
  if (!brief.name?.trim()) return { success: false, error: "Give it a name first" };

  const { data: media } = await supabase
    .from("product_brief_media").select("image_url").eq("brief_id", briefId).order("position");
  const images = ((media ?? []) as Array<{ image_url: string }>).map((m) => m.image_url);

  // products.id has no database default, and the existing convention
  // ("prod-" + Date.now()) collides if two people submit in the same
  // millisecond — which is exactly what a portal makes possible.
  const productId = `prod-${Date.now()}-${randomBytes(4).toString("hex")}`;

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      id: productId,
      agency_id: owner.agencyId,
      project_id: brief.project_id,
      name: brief.name.trim(),
      category: brief.category,
      stage: "brief",
      order_qty: brief.target_quantity,
      client_unit_price_usd: brief.target_price,
      colorways: brief.colourways,
      images,
      notes: [
        brief.description,
        brief.fabric_notes ? `Fabric: ${brief.fabric_notes}` : null,
        brief.fit_notes ? `Fit: ${brief.fit_notes}` : null,
        brief.trims_notes ? `Trims: ${brief.trims_notes}` : null,
        brief.print_notes ? `Print: ${brief.print_notes}` : null,
        brief.packaging_notes ? `Packaging: ${brief.packaging_notes}` : null,
        brief.notes,
      ].filter(Boolean).join("\n\n") || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { success: false, error: error?.message ?? "Could not create the product" };
  }

  await supabase
    .from("product_briefs")
    .update({
      product_id: productId,
      status: "submitted",
      submitted_by_name: submittedBy?.name?.slice(0, 120) ?? null,
      submitted_by_email: submittedBy?.email?.slice(0, 200) ?? null,
    })
    .eq("id", briefId);

  // The reference photos become the product's media, so the agency opens
  // the product and sees what the client meant rather than a name.
  if (images.length > 0) {
    await supabase.from("product_media").insert(
      images.map((url) => ({
        agency_id: owner.agencyId,
        product_id: productId,
        url,
        kind: "image",
        uploaded_by_role: "client",
        uploaded_by_name: submittedBy?.name ?? "Client brief",
        visible_to_client: true,
      })),
    );
  }

  await notifyAgency(owner.agencyId, brief, productId);

  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true, productId };
}

async function notifyAgency(agencyId: string, brief: ProductBrief, productId: string) {
  const productUrl = buildPublicUrl(`/products/${productId}`);
  await notifySlack({
    title: `New product brief — ${brief.name}`,
    body: brief.description ?? undefined,
    fields: [
      ["Quantity", brief.target_quantity ? String(brief.target_quantity) : "—"],
      ["Needed by", brief.needed_by ?? "—"],
    ],
    url: productUrl,
    urlLabel: "Open the product",
  });

  try {
    const recipients = await agencyNotificationRecipients(agencyId);
    if (recipients.length === 0) return;

    const { esc } = await import("@/lib/email/templates");
    const url = buildPublicUrl(`/products/${productId}`);
    const subject = `New product brief — ${brief.name}`;
    const lines = [
      brief.description ? `What it is: ${brief.description}` : null,
      brief.fabric_notes ? `Fabric: ${brief.fabric_notes}` : null,
      brief.fit_notes ? `Fit: ${brief.fit_notes}` : null,
      brief.target_quantity ? `Quantity: ${brief.target_quantity}` : null,
      brief.needed_by ? `Needed by: ${brief.needed_by}` : null,
    ].filter(Boolean) as string[];

    await sendAll(
      recipients.map((to) => ({
        agencyId,
        to,
        subject,
        html:
          `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;">` +
          `<h1 style="font-size:19px;margin:0 0 12px;">${esc(brief.name)}</h1>` +
          `<p style="font-size:14px;color:#6E6E73;margin:0 0 12px;">A client has briefed a new product. It's already in their collection at the first stage.</p>` +
          lines.map((l) => `<p style="font-size:14px;color:#6E6E73;margin:0 0 6px;">${esc(l)}</p>`).join("") +
          `<p style="margin-top:16px;"><a href="${esc(url)}" style="background:#0058B0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Open the product</a></p>` +
          `</div>`,
        text: `${brief.name}\n\nA client has briefed a new product. It's already in their collection at the first stage.\n\n${lines.join("\n")}\n\nOpen: ${url}`,
        template: "brief_received_admin" as const,
        relatedType: "product" as const,
        relatedId: productId,
      })),
    );
  } catch (err) {
    // A brief that saved but didn't email is far better than the reverse.
    console.error("[product-brief] notification failed:", err);
  }
}

export async function deleteBrief(briefId: string): Promise<{ success: boolean }> {
  const owner = await briefOwner(briefId);
  if (!owner || !(await allowed(owner.clientId))) return { success: false };
  const supabase = getAgencyServiceSupabase();
  // Only an unsubmitted brief can be withdrawn — once a product exists,
  // deleting the brief would orphan the record of what was asked for.
  await supabase.from("product_briefs").delete().eq("id", briefId).is("product_id", null);
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true };
}

// ── The conversation on a brief ───────────────────────────────

export interface BriefReply {
  id: string;
  brief_id: string;
  side: "agency" | "client";
  author_name: string | null;
  body: string;
  created_at: string;
}

export async function listBriefReplies(briefId: string): Promise<BriefReply[]> {
  const owner = await briefOwner(briefId);
  if (!owner || !(await allowed(owner.clientId))) return [];
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_brief_replies").select("*").eq("brief_id", briefId).order("created_at");
  return (data ?? []) as BriefReply[];
}

/**
 * The client's side of the conversation.
 *
 * Deliberately hard-codes side = "client": this runs on a page with no
 * session, and a caller who could choose their own side could put words
 * in the agency's mouth in a thread the agency later relies on.
 */
export async function replyAsClient(input: {
  briefId: string;
  body: string;
  authorName?: string;
}): Promise<{ success: true; reply: BriefReply } | { success: false; error: string }> {
  const owner = await briefOwner(input.briefId);
  if (!owner || !(await allowed(owner.clientId))) return { success: false, error: "Not allowed" };
  if (!input.body.trim()) return { success: false, error: "Write something first" };

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("product_brief_replies")
    .insert({
      agency_id: owner.agencyId,
      brief_id: input.briefId,
      side: "client",
      author_name: input.authorName?.slice(0, 120) ?? null,
      body: input.body.trim().slice(0, 5000),
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not send" };

  await supabase
    .from("product_briefs")
    .update({ last_reply_side: "client", last_reply_at: new Date().toISOString() })
    .eq("id", input.briefId);

  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true, reply: data as BriefReply };
}
