import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection } from "@/lib/brand-catalog";
import { CollectionViewSwitcher } from "./CollectionViewSwitcher";
import { QuickAddProduct } from "./QuickAddProduct";
import { PlanningStrip } from "./PlanningStrip";

export default async function CollectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; collection: string }>;
}) {
  const { workspace: slug, collection: collectionId } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const collection = await getCollection(ctx.workspace.id, collectionId);
  if (!collection) notFound();

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)] mb-3">
        <Link href={`/app/${slug}/collections`} className="hover:text-[var(--sa-text-primary)] transition-colors">
          Collections
        </Link>
        <ChevronRight size={11} />
        <span className="text-[var(--sa-text-primary)] font-medium">{collection.name}</span>
      </div>

      {/* Header + actions */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">
            {collection.name}
          </h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-1">
            {collection.season ?? "Season / drop label not set"}
            {" · "}
            {collection.base_currency}
            {" · "}
            <span className="capitalize">{collection.status.replace(/_/g, " ")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <QuickAddProduct
            workspaceId={ctx.workspace.id}
            workspaceSlug={slug}
            collectionId={collection.id}
            mode={ctx.workspace.mode}
            role={ctx.role}
          />
          <CollectionViewSwitcher slug={slug} collectionId={collection.id} />
        </div>
      </div>

      <PlanningStrip
        workspaceId={ctx.workspace.id}
        workspaceSlug={slug}
        collectionId={collection.id}
      />

      {children}
    </div>
  );
}
