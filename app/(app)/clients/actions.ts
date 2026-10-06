"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/permissions";
import { sendAll, clientRecipients, agencyNotificationRecipients } from "@/lib/email/send";
import { portalInvite } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";
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

export async function toggleClientPortal(
  clientId: string,
  enabled: boolean,
): Promise<{ success: true; invited?: string[] } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();

  const { data: before } = await supabase
    .from("clients")
    .select("name, contact_name, portal_enabled")
    .eq("id", clientId)
    .maybeSingle();
  const prior = before as { name: string; contact_name: string | null; portal_enabled: boolean | null } | null;

  const { error } = await supabase.from("clients").update({ portal_enabled: enabled }).eq("id", clientId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/clients/${clientId}`);

  // Turning it on used to flip a flag and tell nobody, so a client only
  // learned their portal existed if someone remembered to send the link by
  // hand. Only on the transition: re-saving a client who already had it on
  // should not invite them again.
  if (!enabled || prior?.portal_enabled) return { success: true };

  const { emails, clientName, enabled: wantsEmail } = await clientRecipients(clientId);
  if (!wantsEmail || emails.length === 0) return { success: true };

  const built = portalInvite({
    contactName: prior?.contact_name ?? "",
    clientName: clientName || prior?.name || "your",
    portalUrl: buildPublicUrl(`/portal/${clientId}`),
  });

  // Copied to us rather than sent separately: one thread showing exactly
  // what the client was told, which is the thing you want when they reply
  // asking where their portal is.
  const copyTo = await agencyNotificationRecipients(ctx.agency.id);

  await sendAll(
    emails.map((to) => ({
      agencyId: ctx.agency.id,
      to,
      cc: copyTo,
      subject: built.subject,
      html: built.html,
      text: built.text,
      template: "portal_invite" as const,
      relatedType: "client" as const,
      relatedId: clientId,
    })),
  );

  return { success: true, invited: emails };
}

/**
 * Pin a client to the top of the sidebar, or unpin it.
 *
 * Shared across the agency rather than per-person: "the clients we're on
 * this month" is a fact about the work, not a preference, and two people
 * keeping separate lists of it would be two people disagreeing.
 *
 * Stores a timestamp so pins keep the order they were made in.
 */
export async function toggleClientPin(
  clientId: string,
  pinned: boolean,
): Promise<{ success: true; pinned: boolean } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to change clients" };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("clients")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", clientId);

  if (error) {
    // Until migration 039 is applied the column is not there. PostgREST
    // answers PGRST204 from its schema cache rather than letting Postgres
    // raise 42703, so both are checked — and neither is any use to whoever
    // just clicked a star.
    const missingColumn =
      error.code === "PGRST204" || error.code === "42703" || /pinned_at/.test(error.message);
    if (missingColumn) {
      return {
        success: false,
        error: "Pinning needs a one-time database step — run migrations/039_client_pins.sql.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  // The sidebar is rendered by the layout, so every page needs refreshing.
  revalidatePath("/", "layout");
  return { success: true, pinned };
}
