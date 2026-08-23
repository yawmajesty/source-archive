"use server";

import { revalidatePath } from "next/cache";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { getPublicOrigin } from "@/lib/url";
import { getAgencySupabase, getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";

export interface ClientMember {
  id: string;
  client_id: string;
  email: string;
  user_id: string | null;
  role: "owner" | "member";
  claimed_at: string | null;
  created_at: string;
}

export async function listClientMembers(clientId: string): Promise<ClientMember[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("client_members")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at");
  return (data ?? []) as ClientMember[];
}

export async function addClientMember(
  clientId: string,
  email: string,
  role: "owner" | "member",
): Promise<
  | { success: true; member: ClientMember; invited: "sent" | "already_registered" | "failed"; inviteError: string | null }
  | { success: false; error: string }
> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to manage this client's people" };
  }

  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return { success: false, error: "That doesn't look like an email address" };
  }

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("client_members")
    .upsert(
      {
        agency_id: ctx.agency.id,
        client_id: clientId,
        email: clean,
        role,
        invited_by: ctx.currentUserId,
      },
      { onConflict: "client_id,email" },
    )
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Send a real invitation. Clerk mails it and hands them a sign-up link that
  // lands on the portal, so being added actually tells them something.
  let invited: "sent" | "already_registered" | "failed" = "failed";
  let inviteError: string | null = null;
  try {
    const clerk = await clerkClient();
    const existing = await clerk.users.getUserList({ emailAddress: [clean], limit: 1 });
    if (existing.data.length > 0) {
      // Already has an account — no invitation to send; signing in is enough.
      invited = "already_registered";
      await supabase
        .from("client_members")
        .update({ user_id: existing.data[0].id })
        .eq("id", (data as ClientMember).id);
    } else {
      await clerk.invitations.createInvitation({
        emailAddress: clean,
        redirectUrl: `${getPublicOrigin()}/portal/${clientId}`,
        ignoreExisting: true,
      });
      invited = "sent";
    }
  } catch (e) {
    inviteError = e instanceof Error ? e.message : "Could not send the invitation";
  }

  revalidatePath(`/clients/${clientId}`);
  return { success: true, member: data as ClientMember, invited, inviteError };
}

export async function removeClientMember(
  id: string,
  clientId: string,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not signed in" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to manage this client's people" };
  }
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("client_members").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

/**
 * Decide whether the person viewing a portal may see it.
 *
 * A client with no members is open to anyone holding the link — that is how
 * every portal has worked until now, and changing it silently would lock out
 * existing clients. The moment a client has members, the portal becomes
 * sign-in only for that client.
 *
 * Uses the service-role client because the viewer is not an agency member and
 * RLS would otherwise hide the very rows we need to check.
 */
export async function resolvePortalAccess(clientId: string): Promise<{
  allowed: boolean;
  gated: boolean;
  signedIn: boolean;
  memberRole: "owner" | "member" | null;
}> {
  const service = getAgencyServiceSupabase();
  const { data: members } = await service
    .from("client_members")
    .select("id, email, user_id, role")
    .eq("client_id", clientId);

  const rows = (members ?? []) as { id: string; email: string; user_id: string | null; role: "owner" | "member" }[];
  if (rows.length === 0) {
    return { allowed: true, gated: false, signedIn: false, memberRole: null };
  }

  const user = await currentUser().catch(() => null);
  if (!user) return { allowed: false, gated: true, signedIn: false, memberRole: null };

  // Agency staff always get through — they support these clients.
  const ctx = await getAgencyContext();
  if (ctx) return { allowed: true, gated: true, signedIn: true, memberRole: null };

  const emails = user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
  const match =
    rows.find((r) => r.user_id === user.id) ??
    rows.find((r) => emails.includes(r.email.toLowerCase()));

  if (!match) return { allowed: false, gated: true, signedIn: true, memberRole: null };

  // Claim the invite on first sign-in so later checks are by id.
  if (!match.user_id) {
    await service
      .from("client_members")
      .update({ user_id: user.id, claimed_at: new Date().toISOString() })
      .eq("id", match.id);
  }

  return { allowed: true, gated: true, signedIn: true, memberRole: match.role };
}

/**
 * Re-send an invitation to someone already on the list.
 *
 * Deliberately a manual action rather than something that fires on deploy:
 * these are the client's people, and emailing them is the agency's call to
 * make, not a side effect of a code change.
 */
export async function resendClientInvite(
  memberId: string,
  clientId: string,
): Promise<{ success: boolean; error?: string; state?: "sent" | "already_registered" }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not signed in" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to manage this client's people" };
  }

  const supabase = await getAgencySupabase();
  const { data: member } = await supabase
    .from("client_members")
    .select("id, email, client_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return { success: false, error: "That person is no longer on the list" };

  const email = (member as { email: string }).email;

  try {
    const clerk = await clerkClient();
    const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    if (existing.data.length > 0) {
      await supabase.from("client_members").update({ user_id: existing.data[0].id }).eq("id", memberId);
      return { success: true, state: "already_registered" };
    }
    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${getPublicOrigin()}/portal/${clientId}`,
      ignoreExisting: true,
    });
    return { success: true, state: "sent" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not send the invitation" };
  }
}
