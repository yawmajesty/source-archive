import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, getProduct } from "@/lib/brand-catalog";
import { listSampleRounds, listSampleComments, type SampleComment } from "@/lib/brand-sampling";
import { listCommentsForProduct, resolveUserNames } from "@/lib/brand-comments";
import { listProductActivity } from "@/lib/brand-activity";
import { StageBadge } from "@/components/brand/StageBadge";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { CommentThread } from "@/components/brand/CommentThread";
import { ActivityFeed } from "@/components/brand/ActivityFeed";
import { SampleRoundsPanel } from "./SampleRoundsPanel";
import { CostingPanel } from "./CostingPanel";

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

  // Fan out all the reads for this page in parallel.
  const { userId: currentUserId } = await auth();
  const [rounds, productComments, productEvents] = await Promise.all([
    listSampleRounds(product.id),
    listCommentsForProduct(product.id),
    listProductActivity(product.id, 30),
  ]);
  const commentLists = await Promise.all(rounds.map((r) => listSampleComments(r.id)));
  const commentsByRound: Record<string, SampleComment[]> = {};
  rounds.forEach((r, i) => { commentsByRound[r.id] = commentLists[i]; });

  // One display-name resolution for every user id that appears in any
  // feed on this page (sample comments, product comments, activity).
  const allIds = new Set<string>();
  commentLists.flat().forEach((c) => allIds.add(c.user_id));
  productComments.forEach((c) => allIds.add(c.user_id));
  productEvents.forEach((e) => { if (e.actor_id) allIds.add(e.actor_id); });
  const userMap = await resolveUserNames(Array.from(allIds));

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

      <div className="space-y-6">
        <CostingPanel
          product={product}
          collection={collection}
          workspaceId={ctx.workspace.id}
          workspaceSlug={slug}
          mode={ctx.workspace.mode}
          role={ctx.role}
        />

        <SampleRoundsPanel
          workspaceId={ctx.workspace.id}
          workspaceSlug={slug}
          collectionId={collection.id}
          productId={product.id}
          mode={ctx.workspace.mode}
          role={ctx.role}
          rounds={rounds}
          commentsByRound={commentsByRound}
          userMap={userMap}
        />

        <CommentThread
          workspaceId={ctx.workspace.id}
          workspaceSlug={slug}
          mode={ctx.workspace.mode}
          role={ctx.role}
          currentUserId={currentUserId}
          collectionId={collection.id}
          productId={product.id}
          comments={productComments}
          userMap={userMap}
        />

        <section className="rounded-xl border border-[var(--sa-border)] bg-transparent">
          <header className="px-1 py-2">
            <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Activity</h2>
            <p className="text-[11px] text-[var(--sa-text-tertiary)]">Everything that happened on this product.</p>
          </header>
          <ActivityFeed
            events={productEvents}
            userMap={userMap}
            workspaceSlug={slug}
            empty="Nothing yet. Stage changes, sample updates, and costing edits will show up here."
          />
        </section>
      </div>
    </div>
  );
}
