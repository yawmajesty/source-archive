"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";

export const CLIENT_STATUSES = [
  { id: "onboarding", label: "Onboarding", hint: "Signed up, work not started." },
  { id: "active",     label: "Active",     hint: "Currently working with us." },
  { id: "inactive",   label: "Inactive",   hint: "No longer working with us. Their products and tasks drop out of the command centre; nothing is deleted." },
] as const;

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
