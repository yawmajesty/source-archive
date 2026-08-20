import { getProducts } from "@/lib/data";
import { getAgencyContext } from "@/lib/agency-data";
import { listProductionLog } from "@/app/(app)/products/[id]/production-log-actions";
import { WorkshopClient } from "./WorkshopClient";
import type { ProductionLogEntry } from "@/lib/production-log";
import { can } from "@/lib/permissions";
import { listWorkshopTasks, type WorkshopTask } from "./tasks-actions";

export const dynamic = "force-dynamic";

export default async function WorkshopPage() {
  const ctx = await getAgencyContext();
  const products = await getProducts();

  // Anything already finished isn't work in progress.
  const active = products.filter((p) => p.stage !== "shipped");

  // Recent entries across the whole workshop, so the maker can see what was
  // logged yesterday without opening each product.
  let tasks: WorkshopTask[] = [];
  try { tasks = await listWorkshopTasks(); } catch { tasks = []; }

  let recent: ProductionLogEntry[] = [];
  try {
    const lists = await Promise.all(active.slice(0, 20).map((p) => listProductionLog(p.id)));
    recent = lists.flat().slice(0, 12);
  } catch {
    // production_log_entries not migrated yet — the form still renders and
    // will start working the moment migration 012 is applied.
    recent = [];
  }

  return (
    <WorkshopClient
      products={active.map((p) => ({ id: p.id, name: p.name, category: p.category, stage: p.stage }))}
      recent={recent}
      authorName={ctx?.agency.name ?? null}
      canChangeStage={ctx ? can(ctx.role, ctx.permissions, "stage.change") : false}
      tasks={tasks}
    />
  );
}
