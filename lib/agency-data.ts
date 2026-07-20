import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { getAgencySupabase } from "./supabase-agency";

// ── Types ───────────────────────────────────────────────────────

export interface Agency {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export type AgencyRole = "admin" | "team";

export interface AgencyMember {
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  created_at: string;
}

export interface AgencyContext {
  agency: Agency;
  role: AgencyRole;
  currentUserId: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Every agency the current user belongs to. Empty array when signed
 * out or not a member of anything.
 */
export const listUserAgencies = cache(async (): Promise<Agency[]> => {
  const { userId } = await auth();
  if (!userId) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("agency_members")
    .select("agency:agencies(*)")
    .eq("user_id", userId);
  return ((data ?? []) as unknown as Array<{ agency: Agency }>).map((r) => r.agency).filter(Boolean);
});

/**
 * Resolve the current user's active agency context. For now we assume
 * a user belongs to exactly one agency (the first row wins). Later we
 * can add an agency switcher and thread the selection through here.
 */
export const getAgencyContext = cache(async (): Promise<AgencyContext | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("agency_members")
    .select("role, agency:agencies(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const row = data as unknown as { role: AgencyRole; agency: Agency } | null;
  if (!row?.agency) return null;

  return {
    agency: row.agency,
    role: row.role,
    currentUserId: userId,
  };
});

/**
 * Convenience: pull the agency id or null. Common enough to warrant its
 * own cached call.
 */
export const getCurrentAgencyId = cache(async (): Promise<string | null> => {
  const ctx = await getAgencyContext();
  return ctx?.agency.id ?? null;
});

/**
 * Create a new agency and assign the current user as owner. Slug is
 * uniqued client-side (we retry with -2, -3 suffixes if it collides).
 * Uses the SECURITY DEFINER RPC so the new user can insert into
 * agency_members even though they're not yet an admin.
 */
export async function createAgencyForCurrentUser(input: {
  name: string;
  slug: string;
}): Promise<{ success: true; agency_id: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = await getAgencySupabase();

  // Try the requested slug first; if it collides, append -2, -3, …
  let slug = input.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.rpc("create_agency_with_owner", {
      p_name: input.name,
      p_slug: slug,
    });
    if (!error && data) {
      return { success: true, agency_id: data as string };
    }
    if (error?.message?.includes("agencies_slug_key") || error?.code === "23505") {
      // Unique violation on slug — try the next candidate
      slug = `${input.slug}-${attempt + 2}`;
      continue;
    }
    return { success: false, error: error?.message ?? "Failed to create agency" };
  }
  return { success: false, error: "Slug is taken" };
}
