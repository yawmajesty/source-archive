"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, Circle, Flag, Trash2, X } from "lucide-react";
import type { Collection, Product } from "@/lib/brand-catalog";
import { stageLabel } from "@/lib/brand-catalog";
import {
  collectDeadlines,
  computeTimelineWindow,
  partitionDeadlines,
  positionForDate,
  type Milestone,
} from "@/lib/brand-planning";
import { StageBadge } from "@/components/brand/StageBadge";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import { cn } from "@/lib/utils";
import { createMilestone, deleteMilestone, toggleMilestoneDone } from "./actions";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  collection: Collection;
  products: Product[];
  milestones: Milestone[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function TimelineView({
  workspaceId, workspaceSlug, mode, role, collection, products, milestones,
}: Props) {
  const window = useMemo(
    () => computeTimelineWindow(collection, products, milestones),
    [collection, products, milestones],
  );
  const deadlines = useMemo(
    () => collectDeadlines(collection, products, milestones),
    [collection, products, milestones],
  );
  const digest = useMemo(() => partitionDeadlines(deadlines), [deadlines]);

  const canAddMilestone = can(role, "milestone.create", mode);
  const canDeleteMilestone = can(role, "milestone.delete", mode);
  const canToggleMilestone = can(role, "milestone.update", mode);

  const [showAdd, setShowAdd] = useState(false);

  const todayPos = positionForDate(new Date().toISOString().slice(0, 10), window);

  // Month tick positions along the window
  const monthTicks = useMemo(() => {
    const ticks: Array<{ label: string; pos: number }> = [];
    const cursor = new Date(window.start);
    cursor.setDate(1);
    while (cursor <= window.end) {
      const iso = cursor.toISOString().slice(0, 10);
      const pos = positionForDate(iso, window);
      if (pos != null) {
        ticks.push({
          label: `${MONTH_LABELS[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}`,
          pos,
        });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return ticks;
  }, [window]);

  // Collection key-date markers used as vertical lines across the chart
  const keyDates = useMemo(() => {
    return [
      { key: "kickoff",           label: "Kickoff",           date: collection.kickoff_date,      color: "sky" },
      { key: "sample_deadline",   label: "Sample deadline",   date: collection.sample_deadline,   color: "violet" },
      { key: "production_start",  label: "Production start",  date: collection.production_start,  color: "amber" },
      { key: "ex_factory_target", label: "Ex-factory target", date: collection.ex_factory_target, color: "orange" },
      { key: "launch_date",       label: "Launch",            date: collection.launch_date,       color: "emerald" },
    ].filter((k) => !!k.date).map((k) => ({ ...k, pos: positionForDate(k.date, window) }));
  }, [collection, window]);

  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-5">
      {/* Digest strip */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <DigestTile label="Overdue" tone="red" count={digest.overdue.length} items={digest.overdue.slice(0, 3)} slug={workspaceSlug} />
        <DigestTile label="This week" tone="amber" count={digest.thisWeek.length} items={digest.thisWeek.slice(0, 3)} slug={workspaceSlug} />
        <DigestTile label="Next week" tone="sky" count={digest.nextWeek.length} items={digest.nextWeek.slice(0, 3)} slug={workspaceSlug} />
        <DigestTile label="Later" tone="neutral" count={digest.later.length} items={digest.later.slice(0, 3)} slug={workspaceSlug} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--sa-text-tertiary)]">
          <LegendSwatch color="bg-[var(--sa-accent)]/60" label="Product bar" />
          <LegendSwatch color="bg-emerald-500" label="Delivery" shape="diamond" />
          <LegendSwatch color="bg-violet-500" label="Sample target" shape="diamond" />
          <LegendSwatch color="bg-red-500" label="Today" shape="line" />
        </div>
        {canAddMilestone && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-text-primary)] hover:bg-[var(--sa-hover)]"
          >
            <CalendarPlus size={13} /> Add milestone
          </button>
        )}
      </div>

      {/* Gantt-lite */}
      <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            {/* Header */}
            <div className="grid grid-cols-[220px_1fr] border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]">
                Products & milestones
              </div>
              <div className="relative h-8">
                {monthTicks.map((t, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-[var(--sa-border)] pl-1.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-[var(--sa-text-tertiary)]"
                    style={{ left: `${t.pos * 100}%` }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Key-date row */}
            <TimelineRow
              window={window}
              keyDates={keyDates}
              todayPos={todayPos}
              label="Collection dates"
              secondaryLabel={`${products.length} product${products.length !== 1 ? "s" : ""}`}
              overlay={
                <div className="absolute inset-0">
                  {keyDates.map((k) =>
                    k.pos != null ? (
                      <div
                        key={k.key}
                        className="absolute -translate-x-1/2 flex flex-col items-center gap-1"
                        style={{ left: `${k.pos * 100}%`, top: 6 }}
                      >
                        <Flag size={12} className={colorClass(k.color, "text")} />
                        <span className={cn(
                          "whitespace-nowrap text-[10px] font-medium rounded px-1 py-0.5",
                          colorClass(k.color, "bg-tint"),
                          colorClass(k.color, "text"),
                        )}>
                          {k.label}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              }
              height={64}
            />

            {/* Product rows */}
            {products.length === 0 && (
              <div className="grid grid-cols-[220px_1fr]">
                <div className="col-span-2 px-4 py-8 text-center text-[12px] text-[var(--sa-text-tertiary)]">
                  No products yet — quick-add one from the top to see it on the timeline.
                </div>
              </div>
            )}
            {products.map((p) => {
              const startDate = p.stage_entered_at?.slice(0, 10) ?? null;
              const endDate = p.target_delivery ?? p.target_sample_date ?? startDate;
              const startPos = positionForDate(startDate, window);
              const endPos = positionForDate(endDate, window);
              const samplePos = positionForDate(p.target_sample_date, window);
              const deliveryPos = positionForDate(p.target_delivery, window);

              return (
                <TimelineRow
                  key={p.id}
                  window={window}
                  keyDates={keyDates}
                  todayPos={todayPos}
                  label={p.name}
                  secondaryLabel={
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px]">{p.style_code}</span>
                      <StageBadge stage={p.stage} />
                    </span>
                  }
                  overlay={
                    <div className="absolute inset-0">
                      {startPos != null && endPos != null && endPos > startPos && (
                        <Link
                          href={`/app/${workspaceSlug}/collections/${collection.id}/products/${p.id}`}
                          className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full bg-[var(--sa-accent)]/40 hover:bg-[var(--sa-accent)]/60 transition-colors"
                          style={{ left: `${startPos * 100}%`, width: `${(endPos - startPos) * 100}%` }}
                          title={`${stageLabel(p.stage)} → ${p.target_delivery ?? "no delivery target"}`}
                        />
                      )}
                      {samplePos != null && (
                        <MarkerDiamond pos={samplePos} color="bg-violet-500" title={`Sample target: ${p.target_sample_date}`} />
                      )}
                      {deliveryPos != null && (
                        <MarkerDiamond pos={deliveryPos} color="bg-emerald-500" title={`Delivery: ${p.target_delivery}`} />
                      )}
                    </div>
                  }
                />
              );
            })}

            {/* Manual milestones row */}
            {milestones.length > 0 && (
              <TimelineRow
                window={window}
                keyDates={keyDates}
                todayPos={todayPos}
                label="Milestones"
                secondaryLabel={`${milestones.length} item${milestones.length !== 1 ? "s" : ""}`}
                overlay={
                  <div className="absolute inset-0">
                    {milestones.map((m) => {
                      const pos = positionForDate(m.date, window);
                      if (pos == null) return null;
                      const done = !!m.done_at;
                      return (
                        <div
                          key={m.id}
                          className="absolute -translate-x-1/2 flex flex-col items-center gap-1 group"
                          style={{ left: `${pos * 100}%`, top: 4 }}
                        >
                          <button
                            onClick={() => {
                              if (!canToggleMilestone) return;
                              startTransition(async () => {
                                await toggleMilestoneDone({
                                  workspace_id: workspaceId,
                                  workspace_slug: workspaceSlug,
                                  collection_id: collection.id,
                                  milestone_id: m.id,
                                  mode, role,
                                  currentlyDone: done,
                                });
                                router.refresh();
                              });
                            }}
                            className={cn(
                              "rounded-full p-0.5 transition-colors",
                              done ? "text-emerald-500" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-accent)]",
                            )}
                            title={done ? "Mark as not done" : "Mark done"}
                          >
                            {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          </button>
                          <div className="flex items-center gap-1 rounded bg-[var(--sa-bg)] border border-[var(--sa-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--sa-text-secondary)] whitespace-nowrap">
                            <span className={cn(done && "line-through text-[var(--sa-text-tertiary)]")}>{m.title}</span>
                            {canDeleteMilestone && (
                              <button
                                onClick={() => {
                                  if (!confirm(`Delete milestone "${m.title}"?`)) return;
                                  startTransition(async () => {
                                    await deleteMilestone({
                                      workspace_id: workspaceId,
                                      workspace_slug: workspaceSlug,
                                      collection_id: collection.id,
                                      milestone_id: m.id,
                                      mode, role,
                                    });
                                    router.refresh();
                                  });
                                }}
                                className="opacity-0 group-hover:opacity-100 text-[var(--sa-text-tertiary)] hover:text-red-500"
                                title="Delete milestone"
                              >
                                <Trash2 size={9} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                }
                height={54}
              />
            )}
          </div>
        </div>
      </div>

      {isPending && <p className="text-[11px] text-[var(--sa-text-tertiary)]">Saving…</p>}

      {showAdd && (
        <AddMilestoneModal
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          collectionId={collection.id}
          products={products}
          mode={mode}
          role={role}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── Row primitive ────────────────────────────────────────────────

function TimelineRow({
  window: _window,
  keyDates,
  todayPos,
  label,
  secondaryLabel,
  overlay,
  height = 36,
}: {
  window: ReturnType<typeof computeTimelineWindow>;
  keyDates: Array<{ pos: number | null; color: string; key: string }>;
  todayPos: number | null;
  label: React.ReactNode;
  secondaryLabel?: React.ReactNode;
  overlay: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="grid grid-cols-[220px_1fr] border-b border-[var(--sa-border)] last:border-b-0">
      <div className="px-4 py-2 flex flex-col justify-center gap-0.5">
        <div className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{label}</div>
        {secondaryLabel && (
          <div className="text-[10px] text-[var(--sa-text-tertiary)]">{secondaryLabel}</div>
        )}
      </div>
      <div className="relative" style={{ height }}>
        {/* Key-date vertical lines */}
        {keyDates.map((k) =>
          k.pos != null ? (
            <div
              key={k.key}
              className={cn("absolute top-0 bottom-0 w-px opacity-40", colorClass(k.color, "bg"))}
              style={{ left: `${k.pos * 100}%` }}
            />
          ) : null,
        )}
        {/* Today */}
        {todayPos != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500"
            style={{ left: `${todayPos * 100}%` }}
            title={`Today: ${new Date().toISOString().slice(0, 10)}`}
          />
        )}
        {overlay}
      </div>
    </div>
  );
}

function MarkerDiamond({ pos, color, title }: { pos: number; color: string; title: string }) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
      style={{ left: `${pos * 100}%` }}
      title={title}
    >
      <span className={cn("block w-2.5 h-2.5 rotate-45 rounded-sm", color)} />
    </div>
  );
}

// ── Digest tile ──────────────────────────────────────────────────

function DigestTile({
  label, tone, count, items, slug,
}: {
  label: string;
  tone: "red" | "amber" | "sky" | "neutral";
  count: number;
  items: ReturnType<typeof collectDeadlines>;
  slug: string;
}) {
  const toneMap = {
    red:     { text: "text-red-600 dark:text-red-400",       border: "border-red-200 dark:border-red-500/30",     bg: "bg-red-50/60 dark:bg-red-500/10"    },
    amber:   { text: "text-amber-600 dark:text-amber-400",   border: "border-amber-200 dark:border-amber-500/30", bg: "bg-amber-50/60 dark:bg-amber-500/10" },
    sky:     { text: "text-sky-600 dark:text-sky-400",       border: "border-sky-200 dark:border-sky-500/30",     bg: "bg-sky-50/60 dark:bg-sky-500/10"    },
    neutral: { text: "text-[var(--sa-text-secondary)]",       border: "border-[var(--sa-border)]",                 bg: "bg-[var(--sa-window)]"              },
  }[tone];

  return (
    <div className={cn("rounded-xl border p-3", toneMap.border, toneMap.bg)}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={cn("text-[10px] uppercase tracking-wider font-semibold", toneMap.text)}>{label}</span>
        <span className={cn("text-[18px] font-semibold font-mono", toneMap.text)}>{count}</span>
      </div>
      <ul className="space-y-0.5">
        {items.length === 0 && <li className="text-[11px] text-[var(--sa-text-tertiary)]">Nothing here.</li>}
        {items.map((d) => (
          <li key={d.id} className="text-[11px] text-[var(--sa-text-secondary)] truncate">
            {d.productId ? (
              <Link href={`/app/${slug}/collections/${d.collectionId}/products/${d.productId}`} className="hover:text-[var(--sa-accent)]">
                <span className="font-mono text-[10px] text-[var(--sa-text-tertiary)]">{d.date.slice(5)}</span> · {d.title}
              </Link>
            ) : (
              <>
                <span className="font-mono text-[10px] text-[var(--sa-text-tertiary)]">{d.date.slice(5)}</span> · {d.title}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Legend ───────────────────────────────────────────────────────

function LegendSwatch({ color, label, shape }: { color: string; label: string; shape?: "diamond" | "line" }) {
  return (
    <span className="inline-flex items-center gap-1">
      {shape === "diamond" ? (
        <span className={cn("block w-2 h-2 rotate-45 rounded-sm", color)} />
      ) : shape === "line" ? (
        <span className={cn("block w-2 h-2.5", color)} />
      ) : (
        <span className={cn("block w-4 h-1.5 rounded-full", color)} />
      )}
      {label}
    </span>
  );
}

// ── Color helper — Tailwind can't scan dynamic class names, so keep
// this as a switch. Adding a new key-date colour needs an entry here.
function colorClass(color: string, kind: "text" | "bg" | "bg-tint"): string {
  switch (color) {
    case "sky":     return kind === "text" ? "text-sky-600 dark:text-sky-400"       : kind === "bg" ? "bg-sky-500"     : "bg-sky-100/60 dark:bg-sky-500/20";
    case "violet":  return kind === "text" ? "text-violet-600 dark:text-violet-400" : kind === "bg" ? "bg-violet-500"  : "bg-violet-100/60 dark:bg-violet-500/20";
    case "amber":   return kind === "text" ? "text-amber-600 dark:text-amber-400"   : kind === "bg" ? "bg-amber-500"   : "bg-amber-100/60 dark:bg-amber-500/20";
    case "orange":  return kind === "text" ? "text-orange-600 dark:text-orange-400" : kind === "bg" ? "bg-orange-500"  : "bg-orange-100/60 dark:bg-orange-500/20";
    case "emerald": return kind === "text" ? "text-emerald-600 dark:text-emerald-400": kind === "bg" ? "bg-emerald-500" : "bg-emerald-100/60 dark:bg-emerald-500/20";
    default:        return "";
  }
}

// ── Add milestone modal ──────────────────────────────────────────

function AddMilestoneModal({
  workspaceId, workspaceSlug, collectionId, products, mode, role, onClose, onSaved,
}: {
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  products: Product[];
  mode: WorkspaceMode;
  role: Role;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [productId, setProductId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!title.trim()) { setError("Title is required"); return; }
    if (!date) { setError("Date is required"); return; }
    startTransition(async () => {
      const res = await createMilestone({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        product_id: productId || null,
        mode, role,
        title,
        date,
        notes,
      });
      if (!res.success) { setError(res.error); return; }
      onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Add milestone</h2>
          <button onClick={onClose} className="text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fabric approval, final fitting…"
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
          </Field>
          <Field label="Attach to product (optional)">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            >
              <option value="">Collection-level milestone</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.style_code} — {p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] resize-none"
            />
          </Field>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isPending}
            className="rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Add milestone"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">{label}</label>
      {children}
    </div>
  );
}

