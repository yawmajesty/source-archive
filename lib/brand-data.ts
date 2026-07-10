// Read-side helpers for the brand dashboard. All go through the RLS-aware
// Clerk↔Supabase bridge — a misconfigured JWT template surfaces as "no
// data" here, which the layout translates to notFound() / redirect.

import { auth } from "@clerk/nextjs/server";
import { getBrandSupabase } from "./supabase-brand";
import type { Role, WorkspaceMode } from "./mode-policy";

export interface Workspace {
  id: string;
  mode: WorkspaceMode;
  name: string;
  slug: string;
  base_currency: string;
  logo_url: string | null;
  created_at: string;
  created_by: string | null;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: Role;
  invited_by: string | null;
  joined_at: string;
}

export interface Subscription {
  workspace_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
}

export interface WorkspaceContext {
  workspace: Workspace;
  role: Role;
  subscription: Subscription | null;
  isReadOnly: boolean;    // true if subscription is canceled / expired
  isGracePeriod: boolean; // true if past_due but within grace window
}

// ── Workspace listing ─────────────────────────────────────────────

/**
 * Returns every workspace the current Clerk user is a member of, most
 * recently created first. Used by the workspace switcher / home redirect.
 */
export async function getUserWorkspaces(): Promise<Array<Workspace & { role: Role }>> {
  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*, workspace_members!inner(role)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    mode: row.mode,
    name: row.name,
    slug: row.slug,
    base_currency: row.base_currency,
    logo_url: row.logo_url,
    created_at: row.created_at,
    created_by: row.created_by,
    role: row.workspace_members[0]?.role as Role,
  }));
}

// ── Full workspace context ────────────────────────────────────────

/**
 * Resolves the workspace by slug, confirms the current user is a member,
 * and attaches the subscription state. Returns null when the workspace
 * doesn't exist OR the user isn't a member (RLS returns no rows in both
 * cases, and we don't distinguish so we can't leak existence).
 */
export async function getWorkspaceContext(slug: string): Promise<WorkspaceContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await getBrandSupabase();

  const { data: workspaceRow } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!workspaceRow) return null;

  const { data: memberRow } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceRow.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!memberRow) return null;

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceRow.id)
    .maybeSingle();

  const workspace = workspaceRow as Workspace;
  const subscription = (subRow as Subscription | null) ?? null;

  const now = Date.now();
  const trialActive =
    subscription?.status === "trialing" &&
    subscription.trial_ends_at != null &&
    Date.parse(subscription.trial_ends_at) > now;
  const paidActive = subscription?.status === "active";
  const gracePeriod = subscription?.status === "past_due";

  // Managed workspaces never gate on subscription — they're billed outside the app.
  const requiresSubscription = workspace.mode === "independent";
  const bypass = process.env.NEXT_PUBLIC_BILLING_DEV_BYPASS === "true";

  const isReadOnly =
    requiresSubscription && !bypass && !trialActive && !paidActive && !gracePeriod;

  return {
    workspace,
    role: memberRow.role as Role,
    subscription,
    isReadOnly,
    isGracePeriod: gracePeriod,
  };
}
