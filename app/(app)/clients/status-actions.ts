"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { CLIENT_STATUSES } from "@/lib/client-status";

/**
 * Marking a client inactive is how a finished relationship stops cluttering
 * the command centre. Deliberately not a delete: their products, tasks and
 * history stay exactly where they are, and the portal keeps working, so
 * reactivating is a single click if they come back.
 */
export async function setClientStatus(
  clientId: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to change client details" };
  }
  if (!CLIENT_STATUSES.some((s) => s.id === status)) {
    return { success: false, error: `Unknown status "${status}"` };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("clients").update({ status }).eq("id", clientId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Rename a client. The slug is left alone deliberately: portal links are
 * built from the client id, but the slug appears in older shared URLs and
 * changing it would break anything already sent out.
 */
export async function renameClient(
  clientId: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to change client details" };
  }
  const clean = name.trim();
  if (!clean) return { success: false, error: "A client needs a name" };
  if (clean.length > 120) return { success: false, error: "That name is too long" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("clients").update({ name: clean }).eq("id", clientId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
