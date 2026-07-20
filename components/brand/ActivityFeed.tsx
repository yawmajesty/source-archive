import Link from "next/link";
import {
  Package,
  Sparkles,
  ArrowRight,
  Coins,
  Camera,
  Flag,
  Store,
  MessageSquare,
  Layers,
} from "lucide-react";
import type { ActivityEvent, ActivityVerb } from "@/lib/brand-activity";

// Server component. Pass `userMap` to resolve actor ids to names.
// Optionally scope the feed to a collection or product by passing a
// linkPrefix — when set, target ids inside the feed become clickable.

interface Props {
  events: ActivityEvent[];
  userMap: Record<string, string>;
  workspaceSlug: string;
  empty?: string;
}

export function ActivityFeed({ events, userMap, workspaceSlug, empty }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--sa-border)] bg-[var(--sa-window)] px-6 py-10 text-center text-[12px] text-[var(--sa-text-tertiary)]">
        {empty ?? "No activity yet. Every change on this workspace will land here."}
      </div>
    );
  }

  // Group by ISO day so long feeds get visual break points.
  const groups = groupByDay(events);

  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
      {groups.map(({ day, items }) => (
        <div key={day}>
          <div className="sticky top-0 z-10 bg-[var(--sa-bg)] border-b border-[var(--sa-border)] px-5 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]">
            {formatDayLabel(day)}
          </div>
          <ul className="divide-y divide-[var(--sa-border)]">
            {items.map((e) => (
              <li key={e.id} className="px-5 py-2.5 flex items-start gap-3">
                <VerbIcon verb={e.verb} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-[var(--sa-text-primary)]">
                    <span className="font-semibold">
                      {e.actor_id ? (userMap[e.actor_id] ?? e.actor_id.slice(0, 8)) : "System"}
                    </span>
                    {" "}
                    <TargetLink event={e} workspaceSlug={workspaceSlug} />
                  </p>
                  {typeof e.meta?.excerpt === "string" && (
                    <p className="mt-0.5 text-[11.5px] text-[var(--sa-text-secondary)] italic">
                      “{e.meta.excerpt}”
                    </p>
                  )}
                </div>
                <time className="shrink-0 text-[10px] text-[var(--sa-text-tertiary)] font-mono">
                  {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </time>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TargetLink({ event: e, workspaceSlug }: { event: ActivityEvent; workspaceSlug: string }) {
  if (e.product_id && e.collection_id) {
    return (
      <>
        {e.summary}
        {" · "}
        <Link
          href={`/app/${workspaceSlug}/collections/${e.collection_id}/products/${e.product_id}`}
          className="text-[var(--sa-accent)] hover:underline"
        >
          view product
        </Link>
      </>
    );
  }
  if (e.collection_id) {
    return (
      <>
        {e.summary}
        {" · "}
        <Link
          href={`/app/${workspaceSlug}/collections/${e.collection_id}`}
          className="text-[var(--sa-accent)] hover:underline"
        >
          view collection
        </Link>
      </>
    );
  }
  return <>{e.summary}</>;
}

function VerbIcon({ verb }: { verb: ActivityVerb }) {
  const cls = "shrink-0 mt-0.5 h-5 w-5 rounded-md flex items-center justify-center";
  const iconProps = { size: 11, strokeWidth: 2 };
  switch (verb) {
    case "collection.created":
    case "collection.updated":
    case "collection.deleted":
      return <span className={`${cls} bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400`}><Layers {...iconProps} /></span>;
    case "product.created":
    case "product.updated":
    case "product.deleted":
      return <span className={`${cls} bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400`}><Package {...iconProps} /></span>;
    case "product.stage_changed":
      return <span className={`${cls} bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400`}><ArrowRight {...iconProps} /></span>;
    case "product.costing_updated":
      return <span className={`${cls} bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400`}><Coins {...iconProps} /></span>;
    case "sample.round_created":
    case "sample.round_updated":
    case "sample.status_changed":
      return <span className={`${cls} bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400`}><Camera {...iconProps} /></span>;
    case "sample.comment_added":
    case "comment.added":
      return <span className={`${cls} bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400`}><MessageSquare {...iconProps} /></span>;
    case "milestone.created":
    case "milestone.done":
    case "milestone.deleted":
      return <span className={`${cls} bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400`}><Flag {...iconProps} /></span>;
    case "supplier.created":
    case "supplier.updated":
      return <span className={`${cls} bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400`}><Store {...iconProps} /></span>;
    default:
      return <span className={`${cls} bg-[var(--sa-bg)] text-[var(--sa-text-tertiary)] border border-[var(--sa-border)]`}><Sparkles {...iconProps} /></span>;
  }
}

function groupByDay(events: ActivityEvent[]): Array<{ day: string; items: ActivityEvent[] }> {
  const byDay = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }
  return Array.from(byDay.entries()).map(([day, items]) => ({ day, items }));
}

function formatDayLabel(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

