export const dynamic = "force-dynamic";

import { getDashboardCollections, getDashboardTasks } from "@/lib/data";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const [collections, tasks] = await Promise.all([
    getDashboardCollections(),
    getDashboardTasks(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const stats = {
    overdue: collections.filter((c) => c.overdue_count > 0).length,
    stalled: collections.reduce((s, c) => s + c.stalled_count, 0),
    inSampling: collections.reduce((s, c) => s + c.products.filter((p) => p.product_stage === "sampling").length, 0),
    tasksToday: tasks.filter((t) => t.due_date && t.due_date <= today).length,
  };

  return <DashboardClient collections={collections} tasks={tasks} stats={stats} />;
}
