"use server";

import { revalidatePath } from "next/cache";

import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { STAGE_LABEL } from "@/lib/stages";
import { buildCommandCentre, EMPTY_CENTRE } from "@/lib/command-centre-build";
import {
  QUEUE_META, ageOf, urgencyFor, sortQueue, sortQueues, STALL_DAYS, QUIET_PORTAL_DAYS,
  type Happening,
  type CommandCentre, type Queue, type QueueItem, type QueueKind,
} from "@/lib/command-centre";

/**
 * Assemble the command centre.
 *
 * One pass, everything in parallel: this is the first screen after
 * sign-in and it must not feel like a report being compiled.
 */
export async function getCommandCentre(): Promise<CommandCentre> {
  const ctx = await getAgencyContext();
  if (!ctx) return EMPTY_CENTRE;

  // What someone sees is scoped to what they do. A workshop maker has no
  // business seeing what a client owes, and a member scoped to one brand
  // shouldn't be reading another's follow-ups — RLS already filters the
  // rows, this keeps whole queues off the screen rather than showing
  // empty ones.
  const seesMoney = can(ctx.role, ctx.permissions, "cost.view");
  const seesClients = ctx.role !== "maker";
  return buildCommandCentre(await getAgencySupabase(), { seesMoney, seesClients });
}


/**
 * What just happened, for the strip along the top.
 *
 * The rest of this screen is a list of things that are wrong. This is
 * the other half: a client approved something at 2am and you'd never
 * know unless you went looking.
 */
export async function recentHappenings(limit = 8): Promise<Happening[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];

  const supabase = await getAgencySupabase();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [stages, updates, briefs, visits, clients, products] = await Promise.all([
    supabase.from("product_stage_events").select("id, product_id, to_stage, created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    supabase.from("updates").select("id, product_id, created_at, body")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    supabase.from("product_briefs").select("id, name, product_id, client_id, created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(limit),
    supabase.from("portal_visits").select("id, client_id, created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(60),
    supabase.from("clients").select("id, name"),
    supabase.from("products").select("id, name"),
  ]);

  const clientName = new Map(((clients.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]));
  const productName = new Map(
    ((products.data ?? []) as Array<{ id: string; name: string | null }>).map((p) => [p.id, p.name ?? "A product"]),
  );

  const out: Happening[] = [];

  for (const e of (stages.data ?? []) as Array<{ id: string; product_id: string; to_stage: string; created_at: string }>) {
    out.push({
      id: `h-stage-${e.id}`,
      text: `${productName.get(e.product_id) ?? "A product"} → ${STAGE_LABEL[e.to_stage] ?? e.to_stage}`,
      detail: null, at: e.created_at, href: `/products/${e.product_id}`,
    });
  }

  for (const u of (updates.data ?? []) as Array<{ id: string; product_id: string; created_at: string; body: string | null }>) {
    out.push({
      id: `h-upd-${u.id}`,
      text: `Update on ${productName.get(u.product_id) ?? "a product"}`,
      detail: u.body ? u.body.slice(0, 60) : null,
      at: u.created_at, href: `/products/${u.product_id}`,
    });
  }

  for (const b of (briefs.data ?? []) as Array<{ id: string; name: string; product_id: string | null; client_id: string; created_at: string }>) {
    out.push({
      id: `h-brief-${b.id}`,
      text: `New brief: ${b.name}`,
      detail: clientName.get(b.client_id) ?? null,
      at: b.created_at,
      href: b.product_id ? `/products/${b.product_id}` : "/dashboard",
    });
  }

  // One entry per client per day: forty page views is not forty events.
  const seenVisit = new Set<string>();
  for (const v of (visits.data ?? []) as Array<{ id: string; client_id: string; created_at: string }>) {
    const key = `${v.client_id}-${v.created_at.slice(0, 10)}`;
    if (seenVisit.has(key)) continue;
    seenVisit.add(key);
    out.push({
      id: `h-visit-${key}`,
      text: `${clientName.get(v.client_id) ?? "A client"} opened their portal`,
      detail: null, at: v.created_at, href: `/clients/${v.client_id}`,
    });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ── Quick actions ─────────────────────────────────────────────
// Every queue row can be dealt with without leaving the screen. A
// dashboard you can only read is a list of chores; one you can act on is
// a place work actually gets closed.

export async function quickAction(
  kind: QueueKind,
  id: string,
  action: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  const supabase = await getAgencySupabase();

  switch (`${kind}:${action}`) {
    case "lead:contacted":
      if (!can(ctx.role, ctx.permissions, "client.edit")) return { success: false, error: "No permission" };
      await supabase.from("leads").update({ status: "contacted" }).eq("id", id);
      break;

    case "lead:lost":
      if (!can(ctx.role, ctx.permissions, "client.edit")) return { success: false, error: "No permission" };
      await supabase.from("leads").update({ status: "lost" }).eq("id", id);
      break;

    case "followup:done":
      if (!can(ctx.role, ctx.permissions, "client.edit")) return { success: false, error: "No permission" };
      await supabase.from("clients")
        .update({ next_follow_up_at: null, follow_up_note: null }).eq("id", id);
      break;

    case "followup:snooze": {
      if (!can(ctx.role, ctx.permissions, "client.edit")) return { success: false, error: "No permission" };
      const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      await supabase.from("clients").update({ next_follow_up_at: week }).eq("id", id);
      break;
    }

    case "invoice:paid":
      if (!can(ctx.role, ctx.permissions, "cost.view")) return { success: false, error: "No permission" };
      await supabase.from("sampling_invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      break;

    case "task:done":
      await supabase.from("tasks").update({ status: "done" }).eq("id", id);
      break;

    case "marketing:done":
      if (!can(ctx.role, ctx.permissions, "client.edit")) return { success: false, error: "No permission" };
      await supabase.from("campaign_items").update({ status: "done" }).eq("id", id);
      break;

    case "stalled:complete":
      // The commonest cause of a stalled product is finished work nobody
      // moved on, so closing it out is the likeliest right answer.
      if (!can(ctx.role, ctx.permissions, "stage.change")) return { success: false, error: "No permission" };
      await supabase.from("products").update({ stage: "shipped" }).eq("id", id);
      break;

    default:
      return { success: false, error: "Unknown action" };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
