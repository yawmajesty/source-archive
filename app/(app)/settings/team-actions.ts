"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import type { AgencyRole } from "@/lib/agency-data";
import { ROLE_DEFAULTS, type Capability } from "@/lib/permissions";

export interface TeamMember {
  user_id: string;
  role: AgencyRole;
  permissions: string[];
  created_at: string;
  email: string | null;
  name: string | null;
  /** Set when this person is currently the sole member of another agency. */
  other_agency: string | null;
}

async function adminOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  if (ctx.role !== "admin") throw new Error("Only admins can manage the team");
  return ctx;
}

export async function listTeam(): Promise<TeamMember[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];

  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("agency_members")
    .select("user_id, role, permissions, created_at")
    .eq("agency_id", ctx.agency.id)
    .order("created_at");

  const rows = (data ?? []) as Omit<TeamMember, "email" | "name" | "other_agency">[];
  const clerk = await clerkClient();

  return Promise.all(
    rows.map(async (r) => {
      let email: string | null = null;
      let name: string | null = null;
      try {
        const u = await clerk.users.getUser(r.user_id);
        email = u.emailAddresses[0]?.emailAddress ?? null;
        name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
      } catch {
        // Deleted Clerk user, or a permissions issue — show the id rather
        // than failing the whole page.
      }
      return { ...r, email, name, other_agency: null };
    }),
  );
}

/**
 * People who signed up and were handed their own empty agency by
 * /onboarding-agency, rather than joining an existing one. Surfacing them is
 * the only way an admin can find and adopt them, since there is no invite
 * flow yet.
 */
export async function listUnattachedUsers(): Promise<TeamMember[]> {
  const ctx = await adminOrThrow();

  // Service role: reading other agencies' membership is exactly what RLS
  // blocks, and is the point of this query.
  const service = getAgencyServiceSupabase();
  const { data: allMembers } = await service
    .from("agency_members")
    .select("user_id, role, permissions, created_at, agency_id, agencies(name)");

  const rows = (allMembers ?? []) as any[];
  const mine = new Set(rows.filter((r) => r.agency_id === ctx.agency.id).map((r) => r.user_id));

  // Sole member of an agency that owns nothing = almost certainly someone who
  // meant to join yours.
  const byAgency = new Map<string, any[]>();
  for (const r of rows) {
    byAgency.set(r.agency_id, [...(byAgency.get(r.agency_id) ?? []), r]);
  }

  const clerk = await clerkClient();
  const candidates = rows.filter(
    (r) => !mine.has(r.user_id) && (byAgency.get(r.agency_id)?.length ?? 0) === 1,
  );

  return Promise.all(
    candidates.map(async (r) => {
      let email: string | null = null;
      let name: string | null = null;
      try {
        const u = await clerk.users.getUser(r.user_id);
        email = u.emailAddresses[0]?.emailAddress ?? null;
        name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
      } catch { /* ignore */ }
      return {
        user_id: r.user_id,
        role: r.role as AgencyRole,
        permissions: r.permissions ?? [],
        created_at: r.created_at,
        email,
        name,
        other_agency: r.agencies?.name ?? r.agency_id,
      };
    }),
  );
}

/** Adopt a user into this agency at the given role. */
export async function addMember(
  userId: string,
  role: AgencyRole,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await adminOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("agency_members").upsert(
    {
      agency_id: ctx.agency.id,
      user_id: userId,
      role,
      permissions: ROLE_DEFAULTS[role] ?? [],
    },
    { onConflict: "agency_id,user_id" },
  );
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function setMemberRole(
  userId: string,
  role: AgencyRole,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await adminOrThrow();
  if (userId === ctx.currentUserId) {
    return { success: false, error: "You can't change your own role" };
  }
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_members")
    .update({ role })
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function setMemberPermissions(
  userId: string,
  permissions: Capability[],
): Promise<{ success: boolean; error?: string }> {
  const ctx = await adminOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_members")
    .update({ permissions })
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}

export async function removeMember(userId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await adminOrThrow();
  if (userId === ctx.currentUserId) return { success: false, error: "You can't remove yourself" };
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_members")
    .delete()
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", userId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
