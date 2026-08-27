export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { listTeam, listUnattachedUsers, type TeamMember } from "../settings/team-actions";
import { getClients, getProjects } from "@/lib/data";
import { listInvites, type AgencyInvite } from "../settings/invite-actions";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { TeamClient } from "./TeamClient";

export const metadata = { title: "Team & permissions — Source[Archive]" };

export default async function TeamPage() {
  const ctx = await getAgencyContext();
  if (!ctx) redirect("/onboarding-agency");

  const members = await listTeam();

  let invites: AgencyInvite[] = [];
  try { invites = await listInvites(); } catch { invites = []; }

  // Agencies holding nothing: the artefacts of people signing up before an
  // invite flow existed. Surfaced so they can be cleared out.
  let emptyAgencies: { id: string; name: string; members: number }[] = [];
  if (ctx.role === "admin") {
    try {
      const service = getAgencyServiceSupabase();
      const { data: all } = await service.from("agencies").select("id, name");
      for (const a of (all ?? []) as { id: string; name: string }[]) {
        if (a.id === ctx.agency.id) continue;
        const [{ count: products }, { count: clients }] = await Promise.all([
          service.from("products").select("*", { count: "exact", head: true }).eq("agency_id", a.id),
          service.from("clients").select("*", { count: "exact", head: true }).eq("agency_id", a.id),
        ]);
        if ((products ?? 0) === 0 && (clients ?? 0) === 0) {
          const { count: members } = await service
            .from("agency_members").select("*", { count: "exact", head: true }).eq("agency_id", a.id);
          emptyAgencies.push({ id: a.id, name: a.name, members: members ?? 0 });
        }
      }
    } catch { emptyAgencies = []; }
  }
  const clients = await getClients();
  const projects = await getProjects();
  let unattached: TeamMember[] = [];
  if (ctx.role === "admin") {
    try { unattached = await listUnattachedUsers(); } catch { unattached = []; }
  }

  return (
    <TeamClient
      agencyName={ctx.agency.name}
      currentUserId={ctx.currentUserId}
      isAdmin={ctx.role === "admin"}
      members={members}
      unattached={unattached}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, client_id: p.client_id }))}
      invites={invites}
      emptyAgencies={emptyAgencies}
    />
  );
}
