"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { getWorkspaceContext } from "@/lib/brand-data";
import { canUseShootPlanner } from "@/lib/plan-limits";
import { anglesFor, LAUNCH_PLAN, ALWAYS_ON_PLAN, phaseDate, type ShootType, type Phase } from "@/lib/shoots";

/**
 * Shoot planning for brand workspaces.
 *
 * Gated on the plan, and checked here rather than only in the page: a
 * Server Function takes a direct POST, so hiding the button is a hint,
 * not a gate. Every write re-checks.
 */
async function gate(slug: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) throw new Error("Workspace not found");
  if (!canUseShootPlanner(ctx.subscription?.plan)) {
    throw new Error("Shoot planning isn't on your plan");
  }
  return ctx;
}

export interface WsShoot {
  id: string; workspace_id: string | null; title: string;
  shoot_type: string; status: string; shoot_date: string | null; location: string | null;
  [k: string]: unknown;
}

export async function listWorkspaceShoots(slug: string): Promise<WsShoot[]> {
  const ctx = await getWorkspaceContext(slug);
  if (!ctx || !canUseShootPlanner(ctx.subscription?.plan)) return [];
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("shoots").select("*").eq("workspace_id", ctx.workspace.id)
    .order("shoot_date", { ascending: false, nullsFirst: false });
  return (data ?? []) as WsShoot[];
}

export async function createWorkspaceShoot(input: {
  slug: string; title: string; shootType: ShootType;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  let ctx;
  try { ctx = await gate(input.slug); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("shoots")
    .insert({
      // agency_id is NOT NULL on the table and meaningless for a brand
      // workspace; the owning agency is the one that runs the platform.
      agency_id: "ag-source-archive",
      workspace_id: ctx.workspace.id,
      client_id: null,
      title: input.title.trim() || "Untitled shoot",
      shoot_type: input.shootType,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not create the shoot" };
  const id = (data as { id: string }).id;

  await supabase.from("shoot_shots").insert(
    anglesFor(input.shootType).map((a, i) => ({
      agency_id: "ag-source-archive",
      shoot_id: id, angle: a.angle, medium: a.medium, description: a.description, position: i,
    })),
  );

  revalidatePath(`/app/${input.slug}/shoots`);
  return { success: true, id };
}

export async function listWorkspaceCampaigns(slug: string) {
  const ctx = await getWorkspaceContext(slug);
  if (!ctx || !canUseShootPlanner(ctx.subscription?.plan)) return [];
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("campaigns").select("*").eq("workspace_id", ctx.workspace.id)
    .order("launch_date", { ascending: false, nullsFirst: false });
  return data ?? [];
}

export async function createWorkspaceCampaign(input: {
  slug: string; name: string; kind: "collection" | "always_on"; launchDate?: string | null;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  let ctx;
  try { ctx = await gate(input.slug); } catch (e) { return { success: false, error: (e as Error).message }; }

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      agency_id: "ag-source-archive",
      workspace_id: ctx.workspace.id,
      client_id: null,
      name: input.name.trim() || "Untitled campaign",
      kind: input.kind,
      launch_date: input.launchDate || null,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not create the campaign" };
  const id = (data as { id: string }).id;

  const rows =
    input.kind === "always_on"
      ? ALWAYS_ON_PLAN.map((p, i) => ({
          agency_id: "ag-source-archive", campaign_id: id,
          phase: "always_on" as Phase, channel: p.channel, title: p.title, brief: p.brief, position: i,
        }))
      : LAUNCH_PLAN.map((p, i) => ({
          agency_id: "ag-source-archive", campaign_id: id,
          phase: p.phase, channel: p.channel, title: p.title, brief: p.brief, position: i,
          due_date: phaseDate(input.launchDate ?? null, p.phase),
        }));
  await supabase.from("campaign_items").insert(rows);

  revalidatePath(`/app/${input.slug}/shoots`);
  return { success: true, id };
}
