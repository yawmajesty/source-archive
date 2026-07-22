"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function createClient(input: {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  country: string | null;
  status: string;
  logo_initial: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("clients").insert({
    agency_id: ctx.agency.id,
    ...input,
    has_new_activity: false,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/clients");
  return { success: true };
}

export async function createProjectForClient(input: {
  client_id: string;
  name: string;
  season: string | null;
  start_date: string | null;
  target_completion: string | null;
  notes: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("projects").insert({
    agency_id: ctx.agency.id,
    id: "proj-" + Date.now(),
    client_id: input.client_id,
    name: input.name,
    season: input.season,
    status: "active",
    start_date: input.start_date ?? new Date().toISOString().slice(0, 10),
    target_completion: input.target_completion,
    portal_unlocked_at: null,
    notes: input.notes,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath("/clients");
  return { success: true };
}

export async function deleteClientCascade(clientId: string): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { data: clientProjects } = await supabase.from("projects").select("id").eq("client_id", clientId);
  const projectIds = (clientProjects ?? []).map((p: any) => p.id);
  if (projectIds.length > 0) {
    await supabase.from("products").delete().in("project_id", projectIds);
    await supabase.from("projects").delete().in("id", projectIds);
  }
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/clients");
  return { success: true };
}

export async function toggleClientPortal(clientId: string, enabled: boolean): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("clients").update({ portal_enabled: enabled }).eq("id", clientId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
