import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, FolderOpen } from "lucide-react";
import { getWorkspaceContext } from "@/lib/brand-data";
import { listCollections } from "@/lib/brand-catalog";
import { CreateCollectionButton } from "./CreateCollectionButton";

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const collections = await listCollections(ctx.workspace.id);

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">
            Collections
          </h1>
          <p className="text-[13px] text-[var(--sa-text-tertiary)] mt-1">
            Everything {ctx.workspace.name} has ever made, from concept to delivered.
          </p>
        </div>
        <CreateCollectionButton
          workspaceId={ctx.workspace.id}
          workspaceSlug={ctx.workspace.slug}
          mode={ctx.workspace.mode}
          role={ctx.role}
          defaultCurrency={ctx.workspace.base_currency}
        />
      </div>

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sa-border)] bg-[var(--sa-window)] px-8 py-16 text-center">
          <FolderOpen size={28} className="mx-auto text-[var(--sa-text-tertiary)] mb-3" strokeWidth={1.5} />
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-1">
            Your first collection lives here
          </h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)] mb-4 max-w-sm mx-auto">
            A collection is a season, a drop, or a capsule — anywhere you want to group a set of styles that ship together.
          </p>
          <CreateCollectionButton
            workspaceId={ctx.workspace.id}
            workspaceSlug={ctx.workspace.slug}
            mode={ctx.workspace.mode}
            role={ctx.role}
            defaultCurrency={ctx.workspace.base_currency}
            variant="primary"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/app/${slug}/collections/${c.id}`}
              className="group rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden hover:border-[var(--sa-accent)] transition-colors"
            >
              <div className="aspect-[4/3] bg-[var(--sa-bg)] overflow-hidden">
                {c.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover_image_url} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--sa-text-tertiary)] text-[11px] uppercase tracking-wider">
                    No cover
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="text-[14px] font-semibold text-[var(--sa-text-primary)] truncate">{c.name}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--sa-text-tertiary)] shrink-0">
                    {c.status.replace(/_/g, " ")}
                  </span>
                </div>
                {c.season && (
                  <p className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{c.season}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
