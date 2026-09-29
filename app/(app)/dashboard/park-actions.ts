"use server";

import { revalidatePath } from "next/cache";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/command-centre";

// ─────────────────────────────────────────────────────────────
// Making something stop.
//
// A digest you cannot act on becomes a digest you stop reading. The
// queues that recur every morning — stalled products, samples waiting,
// margin drifting — all belong to a project, so putting the project aside
// is the one move that silences them together.
//
// Nothing here deletes or hides anything. The project keeps its products,
// its portal and its invoices; it simply stops competing for attention,
// which is the difference between a list you read and one you skim.
// ─────────────────────────────────────────────────────────────

const ALLOWED: ProjectStatus[] = ["active", "on_ice", "done"];

export async function setProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<{ success: true; label: string; name: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return { success: false, error: "You don't have permission to change a project" };
  }
  // The value reaches the database as written, so it is checked against a
  // known set rather than trusted — there is no constraint behind it.
  if (!ALLOWED.includes(status)) return { success: false, error: "Unknown status" };

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .select("name")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Project not found" };

  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
  return {
    success: true,
    label: PROJECT_STATUS_LABEL[status],
    name: (data as { name: string }).name,
  };
}

/**
 * What a project on ice is for an invoice.
 *
 * Invoices belong to a client, not a project, so parking the project does
 * nothing for them. This is the equivalent move: the money is still owed
 * and the record is unchanged, it just stops being chased. Deliberately
 * not "paid" — marking something paid that nobody paid is how the books
 * quietly stop matching the bank.
 */
export async function setInvoiceAside(
  invoiceId: string,
  aside: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "cost.view")) {
    return { success: false, error: "You don't have permission" };
  }

  const supabase = await getAgencySupabase();
  const { data: current } = await supabase
    .from("sampling_invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();
  const status = (current as { status: string } | null)?.status;
  if (!status) return { success: false, error: "Invoice not found" };
  if (status === "paid") return { success: false, error: "This invoice is already paid" };

  const { error } = await supabase
    .from("sampling_invoices")
    .update({ status: aside ? "parked" : "sent" })
    .eq("id", invoiceId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  return { success: true };
}
