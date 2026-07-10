import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { clerkClient } from "@clerk/nextjs/server";
import { getWorkspaceContext } from "@/lib/brand-data";
import { getCollection, getProduct } from "@/lib/brand-catalog";
import { listSampleRounds, listSampleComments, type SampleComment } from "@/lib/brand-sampling";
import { StageBadge } from "@/components/brand/StageBadge";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { SampleRoundsPanel } from "./SampleRoundsPanel";

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

  // Load sample rounds + their comments in parallel.
  const rounds = await listSampleRounds(product.id);
  const commentLists = await Promise.all(rounds.map((r) => listSampleComments(r.id)));
  const commentsByRound: Record<string, SampleComment[]> = {};
  rounds.forEach((r, i) => { commentsByRound[r.id] = commentLists[i]; });

  // Resolve author display names (id → "First Last" or email) via Clerk.
  const authorIds = Array.from(new Set(commentLists.flat().map((c) => c.user_id)));
  const userMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    try {
      const client = await clerkClient();
      const users = await client.users.getUserList({ userId: authorIds, limit: 100 });
      users.data.forEach((u) => {
        const email = u.emailAddresses?.[0]?.emailAddress ?? "";
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
        userMap[u.id] = name || email || u.id.slice(0, 8);
      });
    } catch {
      // Fall back to raw ids — feedback thread still renders.
    }
  }

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

        <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-6 py-6 text-center">
          <p className="text-[13px] text-[var(--sa-text-secondary)] mb-1">
            Costing / Files / Activity tabs land here in Phases 4 – 6.
          </p>
        </div>
      </div>
    </div>
  );
}
