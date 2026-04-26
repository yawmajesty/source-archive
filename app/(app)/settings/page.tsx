export const dynamic = "force-dynamic";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SettingsClient } from "./SettingsClient";
import { getAgencySettings } from "@/lib/data";

export const metadata = { title: "Settings — Source[Archive]" };

export interface ClerkUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: number;
}

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const client = await clerkClient();
  const currentUser = await client.users.getUser(userId);
  const role = (currentUser.publicMetadata?.role as string) ?? "team";
  const isAdmin = role === "admin";

  let team: ClerkUserProfile[] = [];
  if (isAdmin) {
    const { data: users } = await client.users.getUserList({ limit: 100 });
    team = users.map((u) => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? "",
      fullName: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.firstName ?? null),
      role: (u.publicMetadata?.role as string) ?? "team",
      createdAt: u.createdAt,
    }));
  }

  const agencySettings = await getAgencySettings();

  return (
    <SettingsClient
      currentUser={{
        id: userId,
        email: currentUser.emailAddresses[0]?.emailAddress ?? "",
        role,
      }}
      team={team}
      isAdmin={isAdmin}
      agencySettings={agencySettings}
    />
  );
}
