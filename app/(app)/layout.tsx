import { getClients, getMilestones, getProducts } from "@/lib/data";
import { db } from "@/lib/mock-data";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clients = await getClients();

  // Count overdue milestones across all products
  const now = new Date();
  const overdueMilestones = db.milestones.filter(
    (m) => !m.completed_at && new Date(m.due_date) < now
  ).length;

  // Count samples awaiting approval (status = received, approved_at = null)
  const pendingApprovals = db.samples.filter(
    (s) => s.status === "received" && !s.approved_at
  ).length;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--sa-bg)]">
      <Sidebar
        clients={clients}
        overdueMilestones={overdueMilestones}
        pendingApprovals={pendingApprovals}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
