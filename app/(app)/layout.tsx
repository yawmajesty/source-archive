import { getClients } from "@/lib/data";
import { db } from "@/lib/mock-data";
import { Sidebar } from "@/components/layout/Sidebar";
import { getUser } from "@/lib/supabase-server";

export const revalidate = 30; // revalidate cached data every 30s

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clients, user] = await Promise.all([getClients(), getUser()]);

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
        userEmail={user?.email ?? null}
      />
      <main className="flex flex-1 flex-col overflow-hidden pt-12 md:pt-0">
        {children}
      </main>
    </div>
  );
}
