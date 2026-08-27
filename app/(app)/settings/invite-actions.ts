"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { getPublicOrigin } from "@/lib/url";
import type { AgencyRole } from "@/lib/agency-data";
import { ROLE_DEFAULTS, type Capability } from "@/lib/permissions";

export interface AgencyInvite {
  id: string;
  agency_id: string;
  email: string;
  role: AgencyRole;
  accepted_at: string | null;
  created_at: string;
}

async function adminOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  if (ctx.role !== "admin") throw new Error("Only admins can invite people");
  return ctx;
}

export async function listInvites(): Promise<AgencyInvite[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("agency_invites")
    .select("id, agency_id, email, role, accepted_at, created_at")
    .eq("agency_id", ctx.agency.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as AgencyInvite[];
}

/**
 * Invite someone by email. The role, permissions and scoping are decided now
 * and carried onto their membership when they accept, so there is no window
 * where a new person exists with the wrong access.
 */
export async function inviteToAgency(input: {
  email: string;
  role: AgencyRole;
  client_scope?: string[];
  project_scope?: string[];
}): Promise<
  | { success: true; invite: AgencyInvite; emailed: boolean; emailError: string | null }
  | { success: false; error: string }
> {
  const ctx = await adminOrThrow();
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { success: false, error: "That doesn't look like an email address" };
  }

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("agency_invites")
    .upsert(
      {
        agency_id: ctx.agency.id,
        email,
        role: input.role,
        token: randomUUID(),
        invited_by: ctx.currentUserId,
        permissions: ROLE_DEFAULTS[input.role] ?? [],
        client_scope: input.client_scope ?? [],
        project_scope: input.project_scope ?? [],
        accepted_at: null,
      },
      { onConflict: "agency_id,email" },
    )
    .select("id, agency_id, email, role, accepted_at, created_at")
    .single();

  if (error) return { success: false, error: error.message };

  // Someone who already has an account just signs in — the invite is picked
  // up on their next visit. Everyone else gets a Clerk invitation email.
  let emailed = false;
  let emailError: string | null = null;
  try {
    const clerk = await clerkClient();
    const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    if (existing.data.length === 0) {
      await clerk.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${getPublicOrigin()}/onboarding-agency`,
        ignoreExisting: true,
      });
    }
    emailed = true;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "Could not send the invitation email";
  }

  revalidatePath("/team");
  return { success: true, invite: data as AgencyInvite, emailed, emailError };
}

export async function revokeInvite(id: string): Promise<{ success: boolean; error?: string }> {
  await adminOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("agency_invites").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/team");
  return { success: true };
}

/**
 * Claim any invitation matching the signed-in user's addresses.
 *
 * Runs service-role deliberately: the invitee is not yet a member, so RLS
 * would hide the very row that lets them in. Called from the onboarding page,
 * which is where someone lands when they have no agency yet.
 */
export async function acceptPendingInvites(): Promise<{ joined: boolean; agencyName?: string }> {
  const user = await currentUser().catch(() => null);
  if (!user) return { joined: false };

  const emails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  if (emails.length === 0) return { joined: false };

  const service = getAgencyServiceSupabase();
  const { data: invites } = await service
    .from("agency_invites")
    .select("*, agencies(name)")
    .in("email", emails)
    .is("accepted_at", null)
    .order("created_at", { ascending: true });

  const rows = (invites ?? []) as any[];
  if (rows.length === 0) return { joined: false };

  const invite = rows[0];

  // Existing memberships stop being primary — the invitation is the
  // deliberate choice, an agency from signing up is not.
  await service.from("agency_members").update({ is_primary: false }).eq("user_id", user.id);

  const { error } = await service.from("agency_members").upsert(
    {
      agency_id: invite.agency_id,
      user_id: user.id,
      role: invite.role,
      permissions: invite.permissions ?? [],
      client_scope: invite.client_scope ?? [],
      project_scope: invite.project_scope ?? [],
      is_primary: true,
    },
    { onConflict: "agency_id,user_id" },
  );
  if (error) return { joined: false };

  await service
    .from("agency_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return { joined: true, agencyName: invite.agencies?.name };
}

/** Remove an agency that holds nothing. Guarded so real data can't be lost. */
export async function deleteEmptyAgency(agencyId: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await adminOrThrow();
  if (agencyId === ctx.agency.id) return { success: false, error: "That's your own agency" };

  const service = getAgencyServiceSupabase();
  for (const table of ["products", "clients", "projects", "fabrics"] as const) {
    const { count } = await service
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyId);
    if ((count ?? 0) > 0) {
      return { success: false, error: `That agency still holds ${count} ${table} — not deleting it.` };
    }
  }

  const { error } = await service.from("agencies").delete().eq("id", agencyId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/team");
  return { success: true };
}
