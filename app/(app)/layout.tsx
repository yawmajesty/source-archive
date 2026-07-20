import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getClients } from "@/lib/data";
import { getAgencyContext } from "@/lib/agency-data";
import { db } from "@/lib/mock-data";
import { Sidebar } from "@/components/layout/Sidebar";

export const revalidate = 30;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Agency membership is now the auth gate — publicMetadata.role is
  // legacy and only used inside individual actions. A user with no
  // agency goes through /onboarding-agency to create one.
  const agencyCtx = await getAgencyContext();
  if (!agencyCtx) redirect("/onboarding-agency");

  const [clients, user] = await Promise.all([getClients(), currentUser()]);

  const now = new Date();
  const overdueMilestones = db.milestones.filter(
    (m) => !m.completed_at && new Date(m.due_date) < now
  ).length;

  const pendingApprovals = db.samples.filter(
    (s) => s.status === "received" && !s.approved_at
  ).length;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--sa-bg)]">
      <Sidebar
        clients={clients}
        overdueMilestones={overdueMilestones}
        pendingApprovals={pendingApprovals}
        userEmail={user?.emailAddresses[0]?.emailAddress ?? null}
      />
      <main className="flex flex-1 flex-col overflow-hidden pt-12 md:pt-0">
        {children}
      </main>
    </div>
  );
}
