export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import {
  getProduct, getFactory, getMilestones, getUpdates, getSamples, getCosts,
  getProject, getClient, getFactories, getProductPriceHistory,
} from "@/lib/data";
import { ProductDetailClient } from "./ProductDetailClient";

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
    />
  );
}
