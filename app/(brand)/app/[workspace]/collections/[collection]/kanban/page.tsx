import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, listProducts } from "@/lib/brand-catalog";
import { KanbanBoard } from "./KanbanBoard";

export default async function CollectionKanbanPage({
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
    <KanbanBoard
      workspaceId={ctx.workspace.id}
      workspaceSlug={slug}
      collectionId={collection.id}
      mode={ctx.workspace.mode}
      role={ctx.role}
      products={products}
    />
  );
}
