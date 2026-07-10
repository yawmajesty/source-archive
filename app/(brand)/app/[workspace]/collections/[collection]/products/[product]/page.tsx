import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, getProduct } from "@/lib/brand-catalog";
import { StageBadge } from "@/components/brand/StageBadge";
import { CategoryChip } from "@/components/brand/CategoryChip";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; collection: string; product: string }>;
}) {
  const { workspace: slug, collection: collectionId, product: productId } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const collection = await getCollection(ctx.workspace.id, collectionId);
  if (!collection) notFound();
  const product = await getProduct(productId);
  if (!product || product.collection_id !== collection.id) notFound();

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)] mb-3">
        <Link href={`/app/${slug}/collections`} className="hover:text-[var(--sa-text-primary)]">Collections</Link>
        <ChevronRight size={11} />
        <Link href={`/app/${slug}/collections/${collection.id}`} className="hover:text-[var(--sa-text-primary)]">{collection.name}</Link>
        <ChevronRight size={11} />
        <span className="text-[var(--sa-text-primary)] font-medium">{product.name}</span>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">{product.name}</h1>
          <span className="text-[13px] font-mono text-[var(--sa-text-tertiary)]">{product.style_code}</span>
        </div>
        <div className="flex items-center gap-2">
          <CategoryChip category={product.category} />
          <StageBadge stage={product.stage} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-6 py-10 text-center">
        <p className="text-[13px] text-[var(--sa-text-secondary)] mb-1">
          Overview / Specs / Samples / Costing / Files / Activity tabs land here in Phases 3 – 6.
        </p>
        <p className="text-[11px] text-[var(--sa-text-tertiary)]">
          Style code, category, and stage are already editable from the collection Table view.
        </p>
      </div>
    </div>
  );
}
