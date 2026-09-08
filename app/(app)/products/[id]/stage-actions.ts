"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { PRODUCT_STAGES } from "@/lib/stages";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { sendAll, clientRecipients } from "@/lib/email/send";
import { stageUpdateClient } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";

export interface StageEvent {
  id: string;
  product_id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  changed_by_name: string | null;
  visible_to_client: boolean;
  created_at: string;
}

export async function listStageEvents(productId: string): Promise<StageEvent[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("product_stage_events")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return (data ?? []) as StageEvent[];
}

/**
 * Move a product to a new stage and record who moved it and why.
 *
 * Permission is checked here and again in the database: has_agency_permission
 * gates the history insert, and a trigger on products blocks the stage column
 * changing without it. Belt and braces, because this is the one write we hand
 * to people who aren't admins.
 */
export async function changeProductStage(
  productId: string,
  toStage: string,
  note?: string,
): Promise<{ success: true; from: string | null; to: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "stage.change")) {
    return { success: false, error: "You don't have permission to move products between stages" };
  }
  if (!PRODUCT_STAGES.some((s) => s.id === toStage)) {
    return { success: false, error: `Unknown stage "${toStage}"` };
  }

  const supabase = await getAgencySupabase();
  const { data: product } = await supabase
    .from("products")
    .select("id, name, stage, agency_id, project_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { success: false, error: "Product not found" };

  const from = (product as { stage: string | null }).stage ?? null;
  if (from === toStage) return { success: true, from, to: toStage };

  const { error: updateError } = await supabase
    .from("products")
    .update({ stage: toStage })
    .eq("id", productId);
  if (updateError) return { success: false, error: updateError.message };

  const { error: eventError } = await supabase.from("product_stage_events").insert({
    agency_id: (product as { agency_id: string }).agency_id,
    product_id: productId,
    from_stage: from,
    to_stage: toStage,
    note: note?.trim() || null,
    changed_by: ctx.currentUserId,
    changed_by_name: ctx.agency.name ?? null,
  });
  // The move itself succeeded; a missing history row shouldn't fail the call,
  // but it should be visible rather than swallowed.
  if (eventError) console.error("[stage] history insert failed:", eventError.message);

  revalidatePath(`/products/${productId}`);
  revalidatePath("/workshop");

  // Tell the client. Deliberately after every write and every
  // revalidate: the move is what matters, and notifyClientOfStage
  // swallows its own failures so a mail outage can never undo it or
  // surface to the person who pressed the button.
  await notifyClientOfStage({
    agencyId: (product as { agency_id: string }).agency_id,
    productId,
    productName: (product as { name: string | null }).name ?? "Your product",
    projectId: (product as { project_id: string | null }).project_id,
    toStage,
    note: note?.trim() || null,
  });

  return { success: true, from, to: toStage };
}

/**
 * Email the client that their garment has moved.
 *
 * Uses the service-role client to resolve the recipients: the person who
 * moved the stage may be a workshop maker who cannot see the clients
 * table at all, and RLS would hand back nothing.
 */
async function notifyClientOfStage(input: {
  agencyId: string;
  productId: string;
  productName: string;
  projectId: string | null;
  toStage: string;
  note: string | null;
}): Promise<void> {
  try {
    if (!input.projectId) return;

    const service = getAgencyServiceSupabase();
    const { data: project } = await service
      .from("projects")
      .select("client_id")
      .eq("id", input.projectId)
      .maybeSingle();

    const clientId = (project as { client_id: string | null } | null)?.client_id;
    if (!clientId) return;

    const { emails, clientName, enabled } = await clientRecipients(clientId);
    // A client who asked to be left alone, or one with no address on file.
    if (!enabled || emails.length === 0) return;

    const built = stageUpdateClient({
      productName: input.productName,
      clientName,
      toStage: input.toStage,
      note: input.note,
      portalUrl: buildPublicUrl(`/portal/${clientId}`),
    });

    await sendAll(
      emails.map((to) => ({
        agencyId: input.agencyId,
        to,
        subject: built.subject,
        html: built.html,
        text: built.text,
        template: "stage_update_client" as const,
        relatedType: "product" as const,
        relatedId: input.productId,
      })),
    );
  } catch (err) {
    // Never let a notification failure look like a failed stage change.
    console.error("[stage] client notification failed:", err);
  }
}
