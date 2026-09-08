"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sendEmail } from "@/lib/email/send";
import { STAGE_LABEL } from "@/lib/stages";
import {
  assessClient, sortByAttention, daysBetween,
  type ClientContact, type Touchpoint, type TimelineItem, type ClientCrmSummary,
  type TouchpointKind, type TouchpointDirection,
} from "@/lib/crm";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

// ── The list ──────────────────────────────────────────────────

export async function listCrmClients(): Promise<ClientCrmSummary[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, contact_email, next_follow_up_at, follow_up_note")
    .order("name");

  const rows = (clients ?? []) as Array<{
    id: string; name: string; status: string | null; contact_email: string | null;
    next_follow_up_at: string | null; follow_up_note: string | null;
  }>;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Last contact is the most recent of anything that counts as talking to
  // them. Three cheap queries beat a view we'd have to keep in step.
  const [touch, mail, projects] = await Promise.all([
    supabase.from("client_touchpoints").select("client_id, occurred_at").in("client_id", ids),
    supabase.from("email_messages").select("related_id, related_type, created_at").eq("related_type", "client"),
    supabase.from("projects").select("id, client_id"),
  ]);

  const latest = new Map<string, string>();
  const note = (clientId: string, at: string | null) => {
    if (!at) return;
    const seen = latest.get(clientId);
    if (!seen || new Date(at) > new Date(seen)) latest.set(clientId, at);
  };

  for (const t of (touch.data ?? []) as Array<{ client_id: string; occurred_at: string }>) {
    note(t.client_id, t.occurred_at);
  }
  for (const m of (mail.data ?? []) as Array<{ related_id: string | null; created_at: string }>) {
    if (m.related_id) note(m.related_id, m.created_at);
  }

  const productCounts = new Map<string, number>();
  const projectToClient = new Map<string, string>();
  for (const p of (projects.data ?? []) as Array<{ id: string; client_id: string }>) {
    projectToClient.set(p.id, p.client_id);
  }
  const { data: products } = await supabase.from("products").select("project_id");
  for (const p of (products ?? []) as Array<{ project_id: string | null }>) {
    const clientId = p.project_id ? projectToClient.get(p.project_id) : null;
    if (clientId) productCounts.set(clientId, (productCounts.get(clientId) ?? 0) + 1);
  }

  const summaries = rows.map((r) => {
    const lastContactAt = latest.get(r.id) ?? null;
    const { level, reason, overdue } = assessClient({
      status: r.status,
      lastContactAt,
      nextFollowUpAt: r.next_follow_up_at,
    });
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      contactEmail: r.contact_email,
      productCount: productCounts.get(r.id) ?? 0,
      lastContactAt,
      daysSinceContact: daysBetween(lastContactAt),
      nextFollowUpAt: r.next_follow_up_at,
      followUpNote: r.follow_up_note,
      followUpOverdue: overdue,
      attention: level,
      reason,
    } satisfies ClientCrmSummary;
  });

  return summaries.sort(sortByAttention);
}

// ── One client ────────────────────────────────────────────────

export async function getClientContacts(clientId: string): Promise<ClientContact[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("client_contacts")
    .select("*")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("name");
  return (data ?? []) as ClientContact[];
}

/** The merged relationship feed. */
export async function getClientTimeline(clientId: string, limit = 80): Promise<TimelineItem[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();

  const { data: projects } = await supabase.from("projects").select("id").eq("client_id", clientId);
  const projectIds = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);

  let productIds: string[] = [];
  let productNames = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: products } = await supabase
      .from("products").select("id, name").in("project_id", projectIds);
    const rows = (products ?? []) as Array<{ id: string; name: string | null }>;
    productIds = rows.map((p) => p.id);
    productNames = new Map(rows.map((p) => [p.id, p.name ?? "A product"]));
  }

  const [touch, mail, stages, visits] = await Promise.all([
    supabase.from("client_touchpoints").select("*").eq("client_id", clientId)
      .order("occurred_at", { ascending: false }).limit(limit),
    supabase.from("email_messages").select("id, subject, to_email, status, created_at, template, related_id")
      .eq("related_type", "client").eq("related_id", clientId)
      .order("created_at", { ascending: false }).limit(limit),
    productIds.length
      ? supabase.from("product_stage_events").select("id, product_id, to_stage, note, created_at")
          .in("product_id", productIds).order("created_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    supabase.from("portal_visits").select("id, created_at").eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(12),
  ]);

  const items: TimelineItem[] = [];

  for (const t of (touch.data ?? []) as Touchpoint[]) {
    items.push({
      id: `tp-${t.id}`, source: "touchpoint", kind: t.kind, direction: t.direction,
      title: t.summary, detail: t.detail, at: t.occurred_at, touchpointId: t.id,
    });
  }

  for (const m of (mail.data ?? []) as Array<{
    id: string; subject: string; to_email: string; status: string; created_at: string;
  }>) {
    items.push({
      id: `em-${m.id}`, source: "email", kind: "email", direction: "outbound",
      title: m.subject, detail: `To ${m.to_email}`, at: m.created_at, status: m.status,
    });
  }

  for (const s of (stages.data ?? []) as Array<{
    id: string; product_id: string; to_stage: string; note: string | null; created_at: string;
  }>) {
    items.push({
      id: `st-${s.id}`, source: "stage", kind: "stage", direction: "internal",
      title: `${productNames.get(s.product_id) ?? "A product"} → ${STAGE_LABEL[s.to_stage] ?? s.to_stage}`,
      detail: s.note, at: s.created_at,
    });
  }

  // Visits are noise one at a time, so they're rolled into a single row
  // per day: "they looked at the portal" is the useful signal, not how
  // many times they refreshed it.
  const byDay = new Map<string, number>();
  for (const v of (visits.data ?? []) as Array<{ created_at: string }>) {
    const day = v.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  for (const [day, count] of byDay) {
    items.push({
      id: `pv-${day}`, source: "portal", kind: "portal", direction: "inbound",
      title: count === 1 ? "Opened their portal" : `Opened their portal ${count} times`,
      detail: null, at: `${day}T12:00:00Z`,
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}

// ── Writes ────────────────────────────────────────────────────

export async function logTouchpoint(input: {
  clientId: string;
  kind: TouchpointKind;
  direction: TouchpointDirection;
  summary: string;
  detail?: string | null;
  occurredAt?: string | null;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to update clients" };
  }
  if (!input.summary.trim()) return { success: false, error: "Say what happened" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("client_touchpoints").insert({
    agency_id: ctx.agency.id,
    client_id: input.clientId,
    kind: input.kind,
    direction: input.direction,
    summary: input.summary.trim(),
    detail: input.detail?.trim() || null,
    occurred_at: input.occurredAt || new Date().toISOString(),
    created_by: ctx.currentUserId,
    created_by_name: ctx.agency.name ?? null,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

export async function deleteTouchpoint(id: string): Promise<{ success: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx || !can(ctx.role, ctx.permissions, "client.edit")) return { success: false };
  const supabase = await getAgencySupabase();
  await supabase.from("client_touchpoints").delete().eq("id", id);
  revalidatePath("/crm");
  return { success: true };
}

export async function setFollowUp(
  clientId: string,
  date: string | null,
  note: string | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to update clients" };
  }
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("clients")
    .update({ next_follow_up_at: date || null, follow_up_note: note?.trim() || null })
    .eq("id", clientId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

export async function saveContact(input: {
  id?: string;
  clientId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}): Promise<{ success: true; contact: ClientContact } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to update clients" };
  }
  if (!input.name.trim()) return { success: false, error: "A name is needed" };

  const supabase = await getAgencySupabase();
  const row = {
    agency_id: ctx.agency.id,
    client_id: input.clientId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    role: input.role?.trim() || null,
  };

  const query = input.id
    ? supabase.from("client_contacts").update(row).eq("id", input.id).select().single()
    : supabase.from("client_contacts").insert(row).select().single();

  const { data, error } = await query;
  if (error || !data) return { success: false, error: error?.message ?? "Could not save" };
  revalidatePath("/crm");
  return { success: true, contact: data as ClientContact };
}

export async function deleteContact(id: string): Promise<{ success: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx || !can(ctx.role, ctx.permissions, "client.edit")) return { success: false };
  const supabase = await getAgencySupabase();
  await supabase.from("client_contacts").delete().eq("id", id);
  revalidatePath("/crm");
  return { success: true };
}

/**
 * Write to a client from inside the app.
 *
 * Goes out through the same pipeline as the automations, so it lands in
 * the Emails log next to everything else and the timeline picks it up
 * without a second record being written here.
 */
export async function emailClient(input: {
  clientId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ success: true; status: string } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to contact clients" };
  }
  if (!input.subject.trim()) return { success: false, error: "The email needs a subject" };
  if (!input.body.trim()) return { success: false, error: "The email is empty" };

  const { crmMessage } = await import("@/lib/email/templates");
  const built = crmMessage({ body: input.body, subject: input.subject.trim() });

  const res = await sendEmail({
    agencyId: ctx.agency.id,
    to: input.to,
    subject: built.subject,
    html: built.html,
    text: built.text,
    template: "crm_message",
    relatedType: "client",
    relatedId: input.clientId,
  });

  revalidatePath("/crm");
  if (res.status === "failed") return { success: false, error: res.error ?? "Send failed" };
  return { success: true, status: res.status };
}

/** Notes that live on the client rather than on a single conversation. */
export async function saveCrmNotes(
  clientId: string,
  notes: string,
): Promise<{ success: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx || !can(ctx.role, ctx.permissions, "client.edit")) return { success: false };
  const supabase = await getAgencySupabase();
  await supabase.from("clients").update({ crm_notes: notes }).eq("id", clientId);
  revalidatePath("/crm");
  return { success: true };
}
