import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { listWorkspaceActivity } from "@/lib/brand-activity";
import { resolveUserNames } from "@/lib/brand-comments";
import { ActivityFeed } from "@/components/brand/ActivityFeed";

export default async function WorkspaceActivityPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const events = await listWorkspaceActivity(ctx.workspace.id, 100);
  const actorIds = Array.from(new Set(events.map((e) => e.actor_id).filter((x): x is string => !!x)));
  const userMap = await resolveUserNames(actorIds);

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">Activity</h1>
        <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-1">
          Recent 100 events across every collection in this workspace.
        </p>
      </div>

      <ActivityFeed
        events={events}
        userMap={userMap}
        workspaceSlug={slug}
        empty="No activity yet. As collections, products and samples move, this feed will fill up."
      />
    </div>
  );
}
