import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import { getCollection, listProducts } from "@/lib/brand-catalog";
import { collectDeadlines, listMilestones, partitionDeadlines } from "@/lib/brand-planning";

// Server component — pulls its own data so any collection view gets the
// digest for free. Kept slim: full breakdown lives in Timeline.

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
}

export async function PlanningStrip({ workspaceId, workspaceSlug, collectionId }: Props) {
  const collection = await getCollection(workspaceId, collectionId);
  if (!collection) return null;

  const [products, milestones] = await Promise.all([
    listProducts(collectionId),
    listMilestones(workspaceId, collectionId),
  ]);

  const deadlines = collectDeadlines(collection, products, milestones);
  const { overdue, thisWeek, nextWeek } = partitionDeadlines(deadlines);
  const total = overdue.length + thisWeek.length + nextWeek.length;

  const timelineHref = `/app/${workspaceSlug}/collections/${collectionId}/timeline`;

  // Nothing pressing — surface a minimal link only if there are future
  // items to peek at; otherwise stay quiet.
  if (total === 0) {
    if (deadlines.length === 0) return null;
    return (
      <Link
        href={timelineHref}
        className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-2 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
      >
        <CalendarClock size={13} className="text-[var(--sa-text-tertiary)]" />
        <span>Nothing due in the next two weeks — timeline is quiet.</span>
        <ChevronRight size={12} className="ml-auto text-[var(--sa-text-tertiary)]" />
      </Link>
    );
  }

  return (
    <Link
      href={timelineHref}
      className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-2 text-[12px] hover:bg-[var(--sa-hover)] transition-colors"
    >
      {overdue.length > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-1.5 py-0.5 font-medium text-red-600 dark:text-red-400">
          <AlertTriangle size={11} />
          {overdue.length} overdue
        </span>
      ) : (
        <CalendarClock size={13} className="text-[var(--sa-text-tertiary)]" />
      )}

      <span className="text-[var(--sa-text-secondary)] truncate">
        {thisWeek.length > 0 && (
          <>
            <strong className="text-[var(--sa-text-primary)]">{thisWeek.length}</strong> due this week
          </>
        )}
        {thisWeek.length > 0 && nextWeek.length > 0 && <span className="text-[var(--sa-text-tertiary)]"> · </span>}
        {nextWeek.length > 0 && (
          <>
            <strong className="text-[var(--sa-text-primary)]">{nextWeek.length}</strong> next week
          </>
        )}
        {overdue.length > 0 && thisWeek.length === 0 && nextWeek.length === 0 && (
          <>Address the overdue items above.</>
        )}
      </span>

      <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--sa-accent)]">
        View timeline <ChevronRight size={12} />
      </span>
    </Link>
  );
}
