import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, listProducts } from "@/lib/brand-catalog";
import { listCommentsForCollection, resolveUserNames } from "@/lib/brand-comments";
import { listCollectionActivity } from "@/lib/brand-activity";
import { StageBadge } from "@/components/brand/StageBadge";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { CommentThread } from "@/components/brand/CommentThread";
import { ActivityFeed } from "@/components/brand/ActivityFeed";

export default async function CollectionGalleryPage({
  params,
}: {
  params: Promise<{ workspace: string; collection: string }>;
}) {
  const { workspace: slug, collection: collectionId } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();
  const collection = await getCollection(ctx.workspace.id, collectionId);
  if (!collection) notFound();

  const { userId: currentUserId } = await auth();
  const [products, collectionComments, collectionEvents] = await Promise.all([
    listProducts(collectionId),
    listCommentsForCollection(collectionId),
    listCollectionActivity(collectionId, 25),
  ]);

  const commenterIds = new Set<string>();
  collectionComments.forEach((c) => commenterIds.add(c.user_id));
  collectionEvents.forEach((e) => { if (e.actor_id) commenterIds.add(e.actor_id); });
  const userMap = await resolveUserNames(Array.from(commenterIds));

  const threadAndFeed = (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CommentThread
        workspaceId={ctx.workspace.id}
        workspaceSlug={slug}
        mode={ctx.workspace.mode}
        role={ctx.role}
        currentUserId={currentUserId}
        collectionId={collection.id}
        productId={null}
        comments={collectionComments}
        userMap={userMap}
      />
      <div>
        <header className="px-1 pb-2">
          <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Recent activity</h2>
          <p className="text-[11px] text-[var(--sa-text-tertiary)]">Everything that happened in this collection.</p>
        </header>
        <ActivityFeed
          events={collectionEvents}
          userMap={userMap}
          workspaceSlug={slug}
          empty="No activity in this collection yet."
        />
      </div>
    </div>
  );

  if (products.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-dashed border-[var(--sa-border)] bg-[var(--sa-window)] px-8 py-20 text-center">
          <Package size={28} className="mx-auto text-[var(--sa-text-tertiary)] mb-3" strokeWidth={1.5} />
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-1">
            No products in this collection yet
          </h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)] max-w-sm mx-auto">
            Click <strong>New product</strong> above to quick-add your first style. Just a name and category is enough to get started — everything else fills in later.
          </p>
        </div>
        {threadAndFeed}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/app/${slug}/collections/${collection.id}/products/${p.id}`}
            className="group rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden hover:border-[var(--sa-accent)] transition-colors"
          >
            <div className="aspect-square bg-[var(--sa-bg)] overflow-hidden">
              {p.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">
                  Sketch pending
                </div>
              )}
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-[var(--sa-text-primary)] truncate">
                  {p.name}
                </h3>
                <span className="text-[10px] font-mono text-[var(--sa-text-tertiary)] shrink-0">
                  {p.style_code}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <CategoryChip category={p.category} />
                <StageBadge stage={p.stage} size="xs" />
              </div>
            </div>
          </Link>
        ))}
      </div>
      {threadAndFeed}
    </>
  );
}
