"use server";

// Brand-dashboard write actions. Guarded by mode-policy at the call site
// AND by Postgres RLS / SECURITY DEFINER functions at the DB layer — so
// even a forged request from an authenticated user still can't touch
// data outside their workspaces.

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, isSARole, type Role } from "@/lib/mode-policy";

// ── Helpers ────────────────────────────────────────────────────────

function slugify(source: string): string {
  return source
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const supabase = await getBrandSupabase();
  let slug = baseSlug || "workspace";
  let attempt = 0;
  while (attempt < 10) {
    const { data } = await supabase.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt + 1}`;
  }
  return `${baseSlug}-${Math.floor(Math.random() * 100000)}`;
}

// ── Create workspace (independent — self-signup) ──────────────────

/**
 * Called from onboarding after Clerk sign-up. Creates an independent
 * workspace and enrolls the caller as brand_owner, plus a 14-day trial
 * subscription record. Uses a SECURITY DEFINER RPC so both inserts happen
 * atomically without needing loose RLS INSERT policies.
 */
export async function createIndependentWorkspace(input: {
  name: string;
  base_currency?: string;
}): Promise<
  | { success: true; workspace_id: string; slug: string }
  | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!input.name.trim()) return { success: false, error: "Workspace name is required" };

  const supabase = await getBrandSupabase();
  const slug = await ensureUniqueSlug(slugify(input.name));

  const { data, error } = await supabase.rpc("create_workspace_with_owner", {
    p_mode: "independent",
    p_name: input.name.trim(),
    p_slug: slug,
    p_currency: input.base_currency ?? "USD",
  });

  if (error || !data) return { success: false, error: error?.message ?? "Failed to create workspace" };

  revalidatePath("/");
  return { success: true, workspace_id: data as string, slug };
}

// ── Create workspace (managed — SA team invites a brand) ──────────

/**
 * Called from the agency backend when SA onboards a new brand as a
 * managed client. Only SA roles may call this (checked in the RPC).
 */
export async function createManagedWorkspace(input: {
  name: string;
  base_currency?: string;
  invite_email?: string; // brand_owner invite target
}): Promise<
  | { success: true; workspace_id: string; slug: string }
  | { success: false; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!input.name.trim()) return { success: false, error: "Workspace name is required" };

  const supabase = await getBrandSupabase();
  const slug = await ensureUniqueSlug(slugify(input.name));

  const { data, error } = await supabase.rpc("create_workspace_with_owner", {
    p_mode: "managed",
    p_name: input.name.trim(),
    p_slug: slug,
    p_currency: input.base_currency ?? "USD",
  });
  if (error || !data) return { success: false, error: error?.message ?? "Failed to create workspace" };

  // Invite is stored as an outbound event for the invite email flow.
  // (Actual email dispatch is a later phase.)
  if (input.invite_email?.trim()) {
    await supabase.from("workspace_invites").insert({
      workspace_id: data as string,
      email: input.invite_email.trim().toLowerCase(),
      role: "brand_owner",
      invited_by: userId,
    });
  }

  revalidatePath("/");
  return { success: true, workspace_id: data as string, slug };
}

// ── Invite a member ───────────────────────────────────────────────

export async function inviteMember(input: {
  workspace_id: string;
  email: string;
  role: Role;
  mode: "managed" | "independent";
  caller_role: Role;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  if (!can(input.caller_role, "member.invite", input.mode)) {
    return { success: false, error: "You don't have permission to invite members" };
  }

  // Enforce mode-role legality (no sa_* roles in independent workspaces)
  if (input.mode === "independent" && isSARole(input.role)) {
    return { success: false, error: "SA roles cannot be added to independent workspaces" };
  }

  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("workspace_invites").insert({
    workspace_id: input.workspace_id,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    invited_by: userId,
  });
  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true };
}

// ── Remove a member ───────────────────────────────────────────────

export async function removeMember(input: {
  workspace_id: string;
  user_id: string;
  mode: "managed" | "independent";
  caller_role: Role;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  if (!can(input.caller_role, "member.remove", input.mode)) {
    return { success: false, error: "You don't have permission to remove members" };
  }

  if (input.user_id === userId) {
    return { success: false, error: "You can't remove yourself — leave the workspace from Settings instead" };
  }

  const supabase = await getBrandSupabase();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", input.workspace_id)
    .eq("user_id", input.user_id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/");
  return { success: true };
}
