"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { STAGE_LABEL } from "@/lib/stages";
import { sumInvoice } from "@/lib/invoice-total";
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
  const empty: CommandCentre = {
    queues: [],
    totals: { needsYou: 0, owed: 0, owedCurrency: "USD", activeProducts: 0, activeClients: 0 },
  };

  const ctx = await getAgencyContext();
  if (!ctx) return empty;

  // What someone sees is scoped to what they do. A workshop maker has no
  // business seeing what a client owes, and a member scoped to one brand
  // shouldn't be reading another's follow-ups — RLS already filters the
  // rows, this keeps whole queues off the screen rather than showing
  // empty ones.
  const seesMoney = can(ctx.role, ctx.permissions, "cost.view");
  const seesClients = ctx.role !== "maker";

  const supabase = await getAgencySupabase();
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const inSeven = new Date(now + 7 * 86_400_000).toISOString().slice(0, 10);
  const inThree = new Date(now + 3 * 86_400_000).toISOString().slice(0, 10);

  const [
    clients, projects, products, briefs, replies, leads,
    invoices, tasks, shoots, shootProducts, campaignItems, campaigns, stageEvents,
    visits, costRows, costedProducts,
  ] = await Promise.all([
    supabase.from("clients").select("id, name, status, next_follow_up_at, follow_up_note"),
    supabase.from("projects").select("id, name, client_id"),
    supabase.from("products").select("id, name, stage, project_id").neq("stage", "shipped"),
    supabase.from("product_briefs").select("id, name, product_id, client_id, status, created_at, last_reply_side, last_reply_at"),
    supabase.from("product_brief_replies").select("brief_id, side, created_at"),
    supabase.from("leads").select("id, company_name, contact_name, status, created_at, source"),
    supabase.from("sampling_invoices").select("id, client_id, title, round, status, created_at, line_items"),
    supabase.from("tasks").select("id, title, due_date, status, project_id, product_id").neq("status", "done"),
    supabase.from("shoots").select("id, title, shoot_date, status, client_id").gte("shoot_date", today).lte("shoot_date", inSeven),
    supabase.from("shoot_products").select("shoot_id, product_id"),
    supabase.from("campaign_items").select("id, title, due_date, status, campaign_id").lt("due_date", today).not("status", "in", '("done","live")'),
    supabase.from("campaigns").select("id, name, client_id"),
    supabase.from("product_stage_events").select("product_id, created_at").order("created_at", { ascending: false }).limit(1000),
    supabase.from("portal_visits").select("client_id, created_at").order("created_at", { ascending: false }).limit(2000),
    supabase.from("costs").select("product_id, amount, project_id").is("deleted_at", null),
    supabase.from("products").select("id, name, quoted_cost_usd, target_cost_usd, project_id, stage"),
  ]);

  const clientRows = (clients.data ?? []) as Array<{
    id: string; name: string; status: string | null;
    next_follow_up_at: string | null; follow_up_note: string | null;
  }>;
  const activeClients = clientRows.filter((c) => c.status !== "inactive");
  const activeIds = new Set(activeClients.map((c) => c.id));
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  const projectRows = (projects.data ?? []) as Array<{ id: string; name: string; client_id: string }>;
  const projectById = new Map(projectRows.map((p) => [p.id, p]));
  // Everything downstream is filtered to active clients: an inactive
  // client keeps their data and their portal, they just stop competing
  // for attention here.
  const clientOfProject = (projectId: string | null) =>
    projectId ? projectById.get(projectId)?.client_id ?? null : null;

  const productRows = (products.data ?? []) as Array<{
    id: string; name: string | null; stage: string | null; project_id: string | null;
  }>;
  const liveProducts = productRows.filter((p) => {
    const cid = clientOfProject(p.project_id);
    return cid ? activeIds.has(cid) : false;
  });

  const queues = new Map<QueueKind, QueueItem[]>();
  const push = (item: QueueItem) => {
    const list = queues.get(item.kind) ?? [];
    list.push(item);
    queues.set(item.kind, list);
  };

  // ── Money owed ──
  let owed = 0;
  for (const inv of (seesMoney ?  (invoices.data ?? []) as Array<{
    id: string; client_id: string; title: string | null; round: number | null;
    status: string; created_at: string; line_items: unknown;
  }> : [])) {
    if (inv.status !== "sent") continue;
    if (!activeIds.has(inv.client_id)) continue;
    const amount = sumInvoice(inv.line_items);
    owed += amount;
    push({
      id: `inv-${inv.id}`, kind: "invoice",
      title: inv.title || `Invoice · round ${inv.round ?? 1}`,
      subtitle: `${clientName.get(inv.client_id) ?? "A client"}${amount ? ` · ${amount.toFixed(2)}` : ""}`,
      age: ageOf(inv.created_at, now),
      // Sent and unpaid is overdue the moment it's been a fortnight.
      urgency: now - new Date(inv.created_at).getTime() > 14 * 86_400_000 ? "overdue" : "waiting",
      href: `/invoices#inv-${inv.id}`,
      rank: new Date(inv.created_at).getTime(),
    });
  }

  // ── Briefs waiting on us ──
  const lastSide = new Map<string, { side: string; at: string }>();
  for (const r of (replies.data ?? []) as Array<{ brief_id: string; side: string; created_at: string }>) {
    const seen = lastSide.get(r.brief_id);
    if (!seen || r.created_at > seen.at) lastSide.set(r.brief_id, { side: r.side, at: r.created_at });
  }

  for (const b of (briefs.data ?? []) as Array<{
    id: string; name: string; product_id: string | null; client_id: string;
    status: string; created_at: string;
  }>) {
    if (b.status !== "submitted") continue;
    if (!activeIds.has(b.client_id)) continue;
    const last = lastSide.get(b.id);
    if (last?.side === "agency") continue;   // ball is in their court
    const since = last?.at ?? b.created_at;
    push({
      id: `brief-${b.id}`, kind: "brief",
      title: b.name,
      subtitle: clientName.get(b.client_id) ?? null,
      age: ageOf(since, now),
      urgency: now - new Date(since).getTime() > 2 * 86_400_000 ? "overdue" : "today",
      href: b.product_id ? `/products/${b.product_id}` : `/clients/${b.client_id}`,
      rank: new Date(since).getTime(),
    });
  }

  // ── New enquiries ──
  for (const l of (leads.data ?? []) as Array<{
    id: string; company_name: string | null; contact_name: string | null;
    status: string; created_at: string; source: string | null;
  }>) {
    if (l.status !== "new") continue;
    push({
      id: `lead-${l.id}`, kind: "lead",
      title: l.company_name || l.contact_name || "New enquiry",
      subtitle: l.source === "brief_form" ? "Brief form" : l.source === "enquiry_form" ? "Enquiry form" : "Added by hand",
      age: ageOf(l.created_at, now),
      urgency: now - new Date(l.created_at).getTime() > 2 * 86_400_000 ? "overdue" : "today",
      href: "/leads",
      rank: new Date(l.created_at).getTime(),
    });
  }

  // ── Follow-ups you set ──
  for (const c of activeClients) {
    if (!c.next_follow_up_at) continue;
    const urgency = urgencyFor(c.next_follow_up_at, now);
    if (urgency === "waiting") continue;   // still in the future
    push({
      id: `fu-${c.id}`, kind: "followup",
      title: c.name,
      subtitle: c.follow_up_note || "Follow up",
      age: null,
      urgency,
      href: "/crm",
      rank: new Date(c.next_follow_up_at).getTime(),
    });
  }

  // ── Samples with the client ──
  for (const p of liveProducts) {
    if (p.stage !== "review") continue;
    const cid = clientOfProject(p.project_id);
    push({
      id: `apr-${p.id}`, kind: "approval",
      title: p.name ?? "A product",
      subtitle: cid ? clientName.get(cid) ?? null : null,
      age: null,
      urgency: "waiting",
      href: `/products/${p.id}`,
      rank: 0,
    });
  }

  // ── Shoots in the next week, and whether the samples exist ──
  const READY = new Set(["review", "approved", "revision", "production", "shipped", "qc"]);
  const productById = new Map(productRows.map((p) => [p.id, p]));
  const shootLinks = (shootProducts.data ?? []) as Array<{ shoot_id: string; product_id: string }>;

  for (const s of (shoots.data ?? []) as Array<{
    id: string; title: string; shoot_date: string; status: string; client_id: string | null;
  }>) {
    if (s.status === "cancelled") continue;
    const onCall = shootLinks.filter((l) => l.shoot_id === s.id);
    const notReady = onCall.filter((l) => {
      const prod = productById.get(l.product_id);
      // A product already shipped isn't in productRows; treat unknown as ready.
      return prod ? !READY.has(prod.stage ?? "") : false;
    }).length;

    push({
      id: `shoot-${s.id}`, kind: "shoot",
      title: s.title,
      subtitle: notReady > 0
        ? `${notReady} sample${notReady === 1 ? "" : "s"} may not be ready`
        : s.client_id ? clientName.get(s.client_id) ?? null : null,
      age: null,
      urgency: notReady > 0 ? "overdue" : urgencyFor(s.shoot_date, now),
      href: "/studio-plan",
      rank: new Date(s.shoot_date).getTime(),
    });
  }

  // ── Marketing past its date ──
  const campaignName = new Map(
    ((campaigns.data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );
  for (const i of (campaignItems.data ?? []) as Array<{
    id: string; title: string; due_date: string | null; campaign_id: string;
  }>) {
    push({
      id: `mkt-${i.id}`, kind: "marketing",
      title: i.title,
      subtitle: campaignName.get(i.campaign_id) ?? null,
      age: ageOf(i.due_date, now),
      urgency: "overdue",
      href: "/studio-plan",
      rank: i.due_date ? new Date(i.due_date).getTime() : 0,
    });
  }

  // ── Products that have gone quiet ──
  const lastMove = new Map<string, string>();
  for (const e of (stageEvents.data ?? []) as Array<{ product_id: string; created_at: string }>) {
    if (!lastMove.has(e.product_id)) lastMove.set(e.product_id, e.created_at);
  }
  const stallCutoff = now - STALL_DAYS * 86_400_000;
  for (const p of liveProducts) {
    // Concept-stage products haven't started, so they aren't stalled.
    if (p.stage === "brief") continue;
    const moved = lastMove.get(p.id);
    if (moved && new Date(moved).getTime() > stallCutoff) continue;
    const cid = clientOfProject(p.project_id);
    push({
      id: `stall-${p.id}`, kind: "stalled",
      title: p.name ?? "A product",
      subtitle: `${cid ? `${clientName.get(cid)} · ` : ""}${STAGE_LABEL[p.stage ?? ""] ?? p.stage ?? "no stage"}`,
      age: moved ? ageOf(moved, now) : "never moved",
      urgency: "waiting",
      href: `/products/${p.id}`,
      rank: moved ? new Date(moved).getTime() : 0,
    });
  }

  // ── Margin slipping ──
  // Costs recorded against a product, compared with what was quoted for
  // it. A garment quietly costing more than it was sold for is the
  // failure nobody notices until the collection is finished.
  if (seesMoney) {
    const spendByProduct = new Map<string, number>();
    for (const c of (costRows.data ?? []) as Array<{ product_id: string | null; amount: number | null }>) {
      if (!c.product_id) continue;
      spendByProduct.set(c.product_id, (spendByProduct.get(c.product_id) ?? 0) + Number(c.amount ?? 0));
    }
    for (const p of (costedProducts.data ?? []) as Array<{
      id: string; name: string | null; quoted_cost_usd: number | null;
      target_cost_usd: number | null; project_id: string | null; stage: string | null;
    }>) {
      if (p.stage === "shipped") continue;
      const cid = clientOfProject(p.project_id);
      if (!cid || !activeIds.has(cid)) continue;
      const budget = Number(p.quoted_cost_usd ?? p.target_cost_usd ?? 0);
      if (!budget) continue;
      const spent = spendByProduct.get(p.id) ?? 0;
      if (spent <= budget) continue;
      const over = spent - budget;
      push({
        id: `margin-${p.id}`, kind: "margin",
        title: p.name ?? "A product",
        subtitle: `${clientName.get(cid)} · $${spent.toFixed(0)} spent against $${budget.toFixed(0)} quoted`,
        age: null,
        urgency: over > budget * 0.25 ? "overdue" : "today",
        href: `/products/${p.id}`,
        rank: -over,
      });
    }
  }

  // ── Clients who have gone quiet ──
  if (seesClients) {
    const lastVisit = new Map<string, string>();
    for (const v of (visits.data ?? []) as Array<{ client_id: string; created_at: string }>) {
      if (!lastVisit.has(v.client_id)) lastVisit.set(v.client_id, v.created_at);
    }
    const quietCutoff = now - QUIET_PORTAL_DAYS * 86_400_000;
    for (const c of activeClients) {
      // Onboarding clients haven't been given anything to look at yet.
      if (c.status === "onboarding") continue;
      const seen = lastVisit.get(c.id);
      if (seen && new Date(seen).getTime() > quietCutoff) continue;
      push({
        id: `quiet-${c.id}`, kind: "quiet",
        title: c.name,
        subtitle: seen ? "Hasn't opened the portal" : "Has never opened the portal",
        age: seen ? ageOf(seen, now) : null,
        urgency: "waiting",
        href: "/crm",
        rank: seen ? new Date(seen).getTime() : 0,
      });
    }
  }

  // ── Tasks ──
  for (const t of (tasks.data ?? []) as Array<{
    id: string; title: string; due_date: string | null; project_id: string | null; product_id: string | null;
  }>) {
    if (t.due_date && t.due_date > inThree) continue;
    const cid = clientOfProject(t.project_id);
    if (t.project_id && cid && !activeIds.has(cid)) continue;
    push({
      id: `task-${t.id}`, kind: "task",
      title: t.title,
      subtitle: cid ? clientName.get(cid) ?? null : null,
      age: null,
      urgency: urgencyFor(t.due_date, now),
      href: t.product_id ? `/products/${t.product_id}` : "/tasks",
      rank: t.due_date ? new Date(t.due_date).getTime() : Number.MAX_SAFE_INTEGER,
    });
  }

  const built: Queue[] = Array.from(queues.entries())
    .filter(([, items]) => items.length > 0)
    .map(([kind, items]) => ({
      kind,
      label: QUEUE_META[kind].label,
      stake: QUEUE_META[kind].stake,
      // The real number is kept separately from the shown one: a queue of
      // forty stalled products is a report rather than a to-do list, so
      // eight are shown and the header says how many there actually are.
      total: items.length,
      items: items.sort(sortQueue).slice(0, 8),
    }))
    .sort(sortQueues);

  // The headline number excludes the passive queues — things you're
  // waiting on someone else for shouldn't read as your backlog.
  const passive = new Set<QueueKind>(["approval", "stalled", "quiet"]);
  const needsYou = Array.from(queues.entries())
    .filter(([kind]) => !passive.has(kind))
    .reduce((n, [, items]) => n + items.length, 0);

  return {
    queues: built,
    totals: {
      needsYou,
      owed,
      owedCurrency: "USD",
      activeProducts: liveProducts.length,
      activeClients: activeClients.length,
    },
  };
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
