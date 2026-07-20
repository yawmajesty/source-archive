import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, listProducts } from "@/lib/brand-catalog";
import { listMilestones } from "@/lib/brand-planning";
import { TimelineView } from "./TimelineView";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ workspace: string; collection: string }>;
}) {
  const { workspace: slug, collection: collectionId } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const collection = await getCollection(ctx.workspace.id, collectionId);
  if (!collection) notFound();

  const [products, milestones] = await Promise.all([
    listProducts(collection.id),
    listMilestones(ctx.workspace.id, collection.id),
  ]);

  return (
    <TimelineView
      workspaceId={ctx.workspace.id}
      workspaceSlug={slug}
      mode={ctx.workspace.mode}
      role={ctx.role}
      collection={collection}
      products={products}
      milestones={milestones}
    />
  );
}
