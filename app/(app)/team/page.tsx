export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { listTeam, listUnattachedUsers, type TeamMember } from "../settings/team-actions";
import { TeamClient } from "./TeamClient";

export const metadata = { title: "Team & permissions — Source[Archive]" };

export default async function TeamPage() {
  const ctx = await getAgencyContext();
  if (!ctx) redirect("/onboarding-agency");

  const members = await listTeam();
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
    />
  );
}
