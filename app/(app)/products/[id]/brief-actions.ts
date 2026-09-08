"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendAll, clientRecipients } from "@/lib/email/send";
import { esc } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
import type { ProductBrief, BriefMedia } from "@/lib/product-brief";
import type { BriefReply } from "@/app/portal/[clientId]/product-brief-actions";

/**
 * The agency's side of a product brief.
 *
 * A brief that arrives and can only be answered by email is a brief that
 * gets answered by email, and then the record of what was agreed lives
 * in someone's inbox instead of against the garment.
 */

export async function getBriefForProduct(productId: string): Promise<
  { brief: ProductBrief; media: BriefMedia[]; replies: BriefReply[] } | null
> {
  const ctx = await getAgencyContext();
  if (!ctx) return null;

  const supabase = await getAgencySupabase();
  const { data: briefRow } = await supabase
    .from("product_briefs").select("*").eq("product_id", productId).maybeSingle();
  if (!briefRow) return null;
  const brief = briefRow as ProductBrief;

  const [{ data: media }, { data: replies }] = await Promise.all([
    supabase.from("product_brief_media").select("*").eq("brief_id", brief.id).order("position"),
    supabase.from("product_brief_replies").select("*").eq("brief_id", brief.id).order("created_at"),
  ]);

  return {
    brief,
    media: (media ?? []) as BriefMedia[],
    replies: (replies ?? []) as BriefReply[],
  };
}

export async function replyToBrief(input: {
  briefId: string;
  body: string;
}): Promise<{ success: true; reply: BriefReply; emailed: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to reply" };
  }
  if (!input.body.trim()) return { success: false, error: "Write something first" };

  const supabase = await getAgencySupabase();
  const { data: briefRow } = await supabase
    .from("product_briefs").select("id, name, client_id").eq("id", input.briefId).maybeSingle();
  const brief = briefRow as { id: string; name: string; client_id: string } | null;
  if (!brief) return { success: false, error: "Brief not found" };

  const { data, error } = await supabase
    .from("product_brief_replies")
    .insert({
      agency_id: ctx.agency.id,
      brief_id: input.briefId,
      side: "agency",
      author_name: ctx.agency.name ?? null,
      body: input.body.trim().slice(0, 5000),
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not reply" };

  await supabase
    .from("product_briefs")
    .update({ last_reply_side: "agency", last_reply_at: new Date().toISOString() })
    .eq("id", input.briefId);

  // Tell them there's an answer waiting. The reply itself lives in the
  // portal rather than the email, so the thread stays in one place.
  let emailed = "skipped";
  try {
    const { emails, enabled } = await clientRecipients(brief.client_id);
    if (enabled && emails.length > 0) {
      const url = buildPublicUrl(`/portal/${brief.client_id}`);
      const results = await sendAll(
        emails.map((to) => ({
          agencyId: ctx.agency.id,
          to,
          subject: `Re: ${brief.name}`,
          html:
            `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;">` +
            `<h1 style="font-size:19px;margin:0 0 12px;">${esc(brief.name)}</h1>` +
            `<p style="font-size:14px;color:#6E6E73;line-height:1.6;margin:0 0 12px;">We've replied to your brief.</p>` +
            `<div style="border-left:2px solid #E5E5E7;padding-left:12px;font-size:14px;color:#6E6E73;line-height:1.6;">${esc(input.body.slice(0, 400))}</div>` +
            `<p style="margin-top:16px;"><a href="${esc(url)}" style="background:#0058B0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Read and reply</a></p>` +
            `</div>`,
          text: `${brief.name}\n\nWe've replied to your brief.\n\n${input.body.slice(0, 400)}\n\nRead and reply: ${url}`,
          template: "crm_message" as const,
          relatedType: "client" as const,
          relatedId: brief.client_id,
        })),
      );
      emailed = results[0]?.status ?? "sent";
    }
  } catch {
    // A reply that saved but didn't email is far better than the reverse.
  }

  revalidatePath(`/products/${input.briefId}`);
  return { success: true, reply: data as BriefReply, emailed };
}

/** Briefs still waiting on us, for the dashboard. */
export async function briefsAwaitingReply(): Promise<
  Array<{ id: string; name: string; product_id: string | null; client_id: string; at: string }>
> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("product_briefs")
    .select("id, name, product_id, client_id, created_at, last_reply_side, last_reply_at")
    .eq("agency_id", ctx.agency.id)
    .eq("status", "submitted");

  return ((data ?? []) as Array<{
    id: string; name: string; product_id: string | null; client_id: string;
    created_at: string; last_reply_side: string | null; last_reply_at: string | null;
  }>)
    // Never answered, or the client spoke last.
    .filter((b) => b.last_reply_side !== "agency")
    .map((b) => ({
      id: b.id, name: b.name, product_id: b.product_id,
      client_id: b.client_id, at: b.last_reply_at ?? b.created_at,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Accept or decline a brief.
 *
 * Declining deletes the product that was auto-created on submission —
 * but only when nothing has happened to it yet. A garment someone has
 * already photographed, costed or moved along is not a stray record to
 * tidy away, so in that case it stays and the caller is told.
 */
export async function decideBrief(input: {
  briefId: string;
  decision: "accepted" | "declined";
  body: string;
}): Promise<
  { success: true; emailed: string; productRemoved: boolean } | { success: false; error: string }
> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to answer briefs" };
  }
  if (!input.body.trim()) return { success: false, error: "Write the message first" };

  const supabase = await getAgencySupabase();
  const { data: row } = await supabase
    .from("product_briefs").select("*").eq("id", input.briefId).maybeSingle();
  const brief = row as ProductBrief | null;
  if (!brief) return { success: false, error: "Brief not found" };

  let productRemoved = false;

  if (input.decision === "declined" && brief.product_id) {
    const [{ data: events }, { data: updates }, { data: media }] = await Promise.all([
      supabase.from("product_stage_events").select("id").eq("product_id", brief.product_id).limit(1),
      supabase.from("updates").select("id").eq("product_id", brief.product_id).limit(1),
      supabase.from("product_media").select("id").eq("product_id", brief.product_id)
        .neq("uploaded_by_role", "client").limit(1),
    ]);
    const untouched =
      (events ?? []).length === 0 && (updates ?? []).length === 0 && (media ?? []).length === 0;

    if (untouched) {
      await supabase.from("products").delete().eq("id", brief.product_id);
      await supabase.from("product_briefs").update({ product_id: null }).eq("id", input.briefId);
      productRemoved = true;
    }
  }

  await supabase
    .from("product_briefs")
    .update({
      status: input.decision,
      last_reply_side: "agency",
      last_reply_at: new Date().toISOString(),
    })
    .eq("id", input.briefId);

  // The decision itself goes into the thread, so the record of what was
  // said lives with the brief and not only in an inbox.
  await supabase.from("product_brief_replies").insert({
    agency_id: ctx.agency.id,
    brief_id: input.briefId,
    side: "agency",
    author_name: ctx.agency.name ?? null,
    body: input.body.trim().slice(0, 5000),
  });

  let emailed = "skipped";
  try {
    const { emails, enabled } = await clientRecipients(brief.client_id);
    if (enabled && emails.length > 0) {
      const { briefDecision } = await import("@/lib/email/templates");
      const built = briefDecision({
        productName: brief.name,
        body: input.body,
        portalUrl: buildPublicUrl(`/portal/${brief.client_id}`),
        accepted: input.decision === "accepted",
      });
      const results = await sendAll(
        emails.map((to) => ({
          agencyId: ctx.agency.id,
          to,
          subject: built.subject,
          html: built.html,
          text: built.text,
          template: input.decision === "accepted" ? ("brief_accepted" as const) : ("brief_declined" as const),
          relatedType: "client" as const,
          relatedId: brief.client_id,
        })),
      );
      emailed = results[0]?.status ?? "sent";
    }
  } catch {
    // A decision that saved but didn't email beats the reverse.
  }

  revalidatePath("/dashboard");
  revalidatePath("/clients");
  return { success: true, emailed, productRemoved };
}

/** The full brief, for previewing before deciding. */
export async function getBriefById(briefId: string): Promise<
  { brief: ProductBrief; media: BriefMedia[]; replies: BriefReply[]; clientName: string } | null
> {
  const ctx = await getAgencyContext();
  if (!ctx) return null;

  const supabase = await getAgencySupabase();
  const { data: row } = await supabase
    .from("product_briefs").select("*").eq("id", briefId).maybeSingle();
  if (!row) return null;
  const brief = row as ProductBrief;

  const [{ data: media }, { data: replies }, { data: client }] = await Promise.all([
    supabase.from("product_brief_media").select("*").eq("brief_id", briefId).order("position"),
    supabase.from("product_brief_replies").select("*").eq("brief_id", briefId).order("created_at"),
    supabase.from("clients").select("name").eq("id", brief.client_id).maybeSingle(),
  ]);

  return {
    brief,
    media: (media ?? []) as BriefMedia[],
    replies: (replies ?? []) as BriefReply[],
    clientName: (client as { name: string } | null)?.name ?? "A client",
  };
}
