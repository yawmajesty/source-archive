export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import {
  getProduct, getFactory, getMilestones, getUpdates, getSamples, getCosts,
  getProject, getClient, getFactories, getProductPriceHistory,
} from "@/lib/data";
import { ProductDetailClient } from "./ProductDetailClient";
import { ProductionLogPanel } from "./ProductionLogPanel";
import { StageSelector } from "./StageSelector";
import { CostSheetPanel } from "./CostSheetPanel";
import { listCostSheets, getCostSheetLines } from "./cost-sheet-actions";
import type { CostSheet, CostSheetLine } from "@/lib/cost-sheet";
import { can } from "@/lib/permissions";
import { listProductionLog } from "./production-log-actions";
import { getAgencyContext } from "@/lib/agency-data";
import type { ProductionLogEntry } from "@/lib/production-log";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  const [factory, milestones, updates, samples, costs, project, factories, priceHistory] = await Promise.all([
    getFactory(product.factory_id ?? ""),
    getMilestones(id),
    getUpdates(id),
    getSamples(id),
    getCosts({ productId: id }),
    getProject(product.project_id),
    getFactories(),
    getProductPriceHistory(id),
  ]);

  const client = project
    ? (await getClient(project.client_id))
    : null;

  const ctx = await getAgencyContext();
  // production_log_entries arrives with migration 012; until then the panel
  // simply has nothing to show.
  let logEntries: ProductionLogEntry[] = [];
  try { logEntries = await listProductionLog(id); } catch { logEntries = []; }

  // Newest sheet only — older ones stay as history and can be surfaced later.
  let costSheet: CostSheet | null = null;
  let costLines: CostSheetLine[] = [];
  try {
    const sheets = await listCostSheets(id);
    costSheet = sheets[0] ?? null;
    if (costSheet) costLines = await getCostSheetLines(costSheet.id);
  } catch { costSheet = null; }

  return (
    <ProductDetailClient
      product={product}
      factory={factory ?? null}
      milestones={milestones}
      updates={updates}
      samples={samples}
      costs={costs}
      project={project}
      client={client}
      factories={factories}
      priceHistory={priceHistory}
      stageSelector={
        <StageSelector
          productId={id}
          stage={(product as { stage?: string }).stage ?? "brief"}
          canChange={ctx ? can(ctx.role, ctx.permissions, "stage.change") : false}
        />
      }
      productionLog={
        <div className="flex flex-col gap-4">
        <CostSheetPanel
          productId={id}
          sheet={costSheet}
          lines={costLines}
          canEdit={ctx ? can(ctx.role, ctx.permissions, "cost.view") : false}
        />
        <ProductionLogPanel
          productId={id}
          entries={logEntries}
          canRelease={ctx?.role === "admin" || ctx?.role === "team"}
        />
        </div>
      }
    />
  );
}
