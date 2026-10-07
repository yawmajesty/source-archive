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
}

/** The message shown when migration 040 has not been applied yet. */
const SETUP = "Priorities need a one-time database step — run migrations/040_priorities_and_rfq.sql.";

function notSetUp(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    /agency_priorities/.test(error.message)
  );
}

export async function listPriorities(): Promise<{ items: Priority[]; setupNeeded: boolean }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { items: [], setupNeeded: false };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("agency_priorities")
    .select("id, body, done, position")
    .order("done")
    .order("position")
    .order("created_at");

  if (error) return { items: [], setupNeeded: notSetUp(error) };
  return { items: (data ?? []) as Priority[], setupNeeded: false };
}

export async function addPriority(
  body: string,
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
    .insert({ agency_id: ctx.agency.id, body: text, position })
    .select("id, body, done, position")
    .single();

  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
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

  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
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
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
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
  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
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

  if (error) return { success: false, error: notSetUp(error) ? SETUP : error.message };
  revalidatePath("/dashboard");
  return { success: true, removed: (data ?? []).length };
}
