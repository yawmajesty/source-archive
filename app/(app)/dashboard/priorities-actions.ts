"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";

// ─────────────────────────────────────────────────────────────
// What we're on this week.
//
// The dashboard is good at telling you what is wrong and has nowhere to
// say what you have decided to do about it. This is that: a few lines
// somebody types, ticked off as they go.
//
// Shared across the agency, like pinned clients, for the same reason —
// "our priorities" is one list or it is not priorities.
// ─────────────────────────────────────────────────────────────

export interface Priority {
  id: string;
  body: string;
  done: boolean;
  position: number;
  assignee_user_id: string | null;
  /** Snapshotted, so a task still reads "Sam" after Sam leaves. */
  assignee_name: string | null;
  client_id: string | null;
  product_id: string | null;
}

/** Who and what a task can be pinned to. */
export interface PriorityOptions {
  people: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  /** Grouped by client, because picking a product only makes sense after one. */
  products: Array<{ id: string; name: string; client_id: string }>;
}

/** The message shown when migration 040 has not been applied yet. */
const SETUP = "Priorities need a one-time database step — run migrations/040_priorities_and_rfq.sql.";
const ASSIGN_SETUP = "Assigning tasks needs a one-time database step — run migrations/045_priority_assignment.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    /agency_priorities/.test(error.message)
  );
}

/** Distinguishes "no table" from "no assignment columns", so the message is useful. */
function message(error: { code?: string; message: string }): string {
  if (!notSetUp(error)) return error.message;
  return /assignee|client_id|product_id/.test(error.message) ? ASSIGN_SETUP : SETUP;
}

const COLUMNS = "id, body, done, position, assignee_user_id, assignee_name, client_id, product_id";

export async function listPriorities(): Promise<{ items: Priority[]; setupNeeded: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { items: [], setupNeeded: false };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("agency_priorities")
    .select(COLUMNS)
    .order("done")
    .order("position")
    .order("created_at");

  if (error) return { items: [], setupNeeded: notSetUp(error) };
  return { items: (data ?? []) as Priority[], setupNeeded: false };
}

export async function addPriority(
  body: string,
  pin?: {
    assigneeUserId?: string | null;
    assigneeName?: string | null;
    clientId?: string | null;
    productId?: string | null;
  },
): Promise<{ success: true; item: Priority } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const text = body.trim().slice(0, 500);
  if (!text) return { success: false, error: "Type something first" };

  const supabase = await getAgencySupabase();

  // Appended to the end of the open items rather than the very end, so a new
  // line does not land underneath things already ticked off.
  const { data: last } = await supabase
    .from("agency_priorities")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position: number } | null)?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("agency_priorities")
    .insert({
      agency_id: ctx.agency.id,
      body: text,
      position,
      assignee_user_id: pin?.assigneeUserId ?? null,
      assignee_name: pin?.assigneeName ?? null,
      client_id: pin?.clientId ?? null,
      // A product without its client would be a task you cannot file.
      product_id: pin?.clientId ? pin?.productId ?? null : null,
    })
    .select(COLUMNS)
    .single();

  if (error) return { success: false, error: message(error) };
  revalidatePath("/dashboard");
  return { success: true, item: data as Priority };
}

export async function setPriorityDone(
  id: string,
  done: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_priorities")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return { success: false, error: message(error) };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updatePriority(
  id: string,
  body: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const text = body.trim().slice(0, 500);
  if (!text) return { success: false, error: "A priority can't be empty — delete it instead" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("agency_priorities").update({ body: text }).eq("id", id);
  if (error) return { success: false, error: message(error) };
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePriority(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("agency_priorities").delete().eq("id", id);
  if (error) return { success: false, error: message(error) };
  revalidatePath("/dashboard");
  return { success: true };
}

/** Clear everything already ticked off, for the start of a new week. */
export async function clearDonePriorities(): Promise<{ success: true; removed: number } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("agency_priorities")
    .delete()
    .eq("done", true)
    .select("id");

  if (error) return { success: false, error: message(error) };
  revalidatePath("/dashboard");
  return { success: true, removed: (data ?? []).length };
}

/** Change who owns a task, or what it is about. */
export async function assignPriority(
  id: string,
  pin: {
    assigneeUserId?: string | null;
    assigneeName?: string | null;
    clientId?: string | null;
    productId?: string | null;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const supabase = await getAgencySupabase();
  const patch: Record<string, unknown> = {};
  if ("assigneeUserId" in pin) {
    patch.assignee_user_id = pin.assigneeUserId ?? null;
    patch.assignee_name = pin.assigneeName ?? null;
  }
  if ("clientId" in pin) {
    patch.client_id = pin.clientId ?? null;
    // Changing the client orphans any product chosen under the old one.
    if (!pin.clientId) patch.product_id = null;
  }
  if ("productId" in pin) patch.product_id = pin.productId ?? null;

  const { error } = await supabase.from("agency_priorities").update(patch).eq("id", id);
  if (error) return { success: false, error: message(error) };
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * The people, clients and products a task can be pinned to.
 *
 * One call rather than three, because the board needs all of it before the
 * first picker can open and three round trips to fill one dropdown is a
 * dashboard that arrives in pieces.
 */
export async function getPriorityOptions(): Promise<PriorityOptions> {
  const ctx = await getAgencyContext();
  if (!ctx) return { people: [], clients: [], products: [] };

  const supabase = await getAgencySupabase();
  const [clientsRes, projectsRes, productsRes] = await Promise.all([
    supabase.from("clients").select("id, name, status").order("name"),
    supabase.from("projects").select("id, client_id"),
    supabase.from("products").select("id, name, project_id").neq("stage", "shipped"),
  ]);

  const clients = ((clientsRes.data ?? []) as Array<{ id: string; name: string; status: string | null }>)
    .filter((c) => c.status !== "inactive")
    .map((c) => ({ id: c.id, name: c.name }));

  const clientOfProject = new Map(
    ((projectsRes.data ?? []) as Array<{ id: string; client_id: string }>).map((p) => [p.id, p.client_id]),
  );

  // Only products whose client is in the picker. Without this the payload
  // carries products belonging to inactive clients that can never be
  // reached, because the client has to be chosen first.
  const offered = new Set(clients.map((c) => c.id));
  const products = ((productsRes.data ?? []) as Array<{ id: string; name: string; project_id: string | null }>)
    .map((p) => ({
      id: p.id,
      name: p.name,
      client_id: p.project_id ? clientOfProject.get(p.project_id) ?? "" : "",
    }))
    .filter((p) => p.client_id && offered.has(p.client_id));

  // Team names come from Clerk, which the team page already resolves.
  let people: Array<{ id: string; name: string }> = [];
  try {
    const { listTeam } = await import("@/app/(app)/settings/team-actions");
    const team = await listTeam();
    people = team.map((m) => ({
      id: m.user_id,
      name: m.name || m.email || "Someone",
    }));
  } catch {
    // A task with no assignee is still a task.
  }

  return { people, clients, products };
}
