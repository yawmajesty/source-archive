import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, listProducts } from "@/lib/brand-catalog";
import { CostingRollup } from "./CostingRollup";

export default async function CollectionCostingPage({
  params,
}: {
  params: Promise<{ workspace: string; collection: string }>;
}) {
  const { workspace: slug, collection: collectionId } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const collection = await getCollection(ctx.workspace.id, collectionId);
  if (!collection) notFound();
  const products = await listProducts(collectionId);

  return (
    <CostingRollup
      workspaceId={ctx.workspace.id}
      workspaceSlug={slug}
      mode={ctx.workspace.mode}
      role={ctx.role}
      collection={collection}
      products={products}
    />
  );
}
