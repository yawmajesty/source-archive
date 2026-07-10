import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, listProducts } from "@/lib/brand-catalog";
import { CollectionTable } from "./CollectionTable";

export default async function CollectionTablePage({
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
    <CollectionTable
      workspaceSlug={slug}
      collectionId={collection.id}
      mode={ctx.workspace.mode}
      role={ctx.role}
      products={products}
    />
  );
}
