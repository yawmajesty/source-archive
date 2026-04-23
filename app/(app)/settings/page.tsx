export const dynamic = "force-dynamic";

import { getUser, createSupabaseServerClient } from "@/lib/supabase-server";
import { SettingsClient } from "./SettingsClient";
import { redirect } from "next/navigation";

export const metadata = { title: "Settings — Source[Archive]" };

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "agency_admin" | "agency_member";
  created_at: string;
}

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();

  // Fetch current user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "agency_admin";

  // Admins can see all team members
  let team: Profile[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at");
    team = (data ?? []) as Profile[];
  }

  return (
    <SettingsClient
      currentUser={{ id: user.id, email: user.email ?? "", profile }}
      team={team}
      isAdmin={isAdmin}
    />
  );
}
