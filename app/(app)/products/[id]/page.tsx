export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import {
  getProduct, getFactory, getMilestones, getUpdates, getSamples, getCosts,
  getProject, getClient, getFactories, getProductPriceHistory,
} from "@/lib/data";
import { ProductDetailClient } from "./ProductDetailClient";
import { ProductionLogPanel } from "./ProductionLogPanel";
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
      productionLog={
        <ProductionLogPanel
          productId={id}
          entries={logEntries}
          canRelease={ctx?.role === "admin" || ctx?.role === "team"}
        />
      }
    />
  );
}
