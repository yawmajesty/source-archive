export const dynamic = 'force-dynamic';

import { getDashboardStats, getRecentActivity, getClientSummaries } from "@/lib/data";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const [stats, activity, clients] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(10),
    getClientSummaries(),
  ]);

  return <DashboardClient stats={stats} activity={activity} clients={clients} />;
}
