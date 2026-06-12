"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, AlertTriangle, Clock,
  Package, CheckSquare, ArrowRight, Check, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CollectionActionItem, CollectionProduct, DashboardTask } from "@/lib/data";
import type { Stage } from "@/lib/mock-data";

interface Props {
  collections: CollectionActionItem[];
  tasks: DashboardTask[];
  stats: { overdue: number; stalled: number; inSampling: number; tasksToday: number };
}

// ── Stage config ─────────────────────────────────────
const STAGE_CFG: Record<Stage, { label: string; bg: string; fg: string }> = {
  brief:      { label: "Brief",      bg: "#F1EFE8", fg: "#444441" },
  sourcing:   { label: "Sourcing",   bg: "#DBEAFE", fg: "#1E40AF" },
  sampling:   { label: "Sampling",   bg: "#EDE9FE", fg: "#5B21B6" },
  approved:   { label: "Approved",   bg: "#D1FAE5", fg: "#065F46" },
  production: { label: "Production", bg: "#FEF3C7", fg: "#92400E" },
  qc:         { label: "QC",         bg: "#FEF3C7", fg: "#92400E" },
  shipped:    { label: "Shipped",    bg: "#F3F4F6", fg: "#6B7280" },
};

function StagePill({ stage }: { stage: Stage }) {
  const c = STAGE_CFG[stage];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
}

// ── Urgency helpers ───────────────────────────────────
type UrgencyLevel = "red" | "amber" | "blue" | "gray";

function collectionUrgencyLevel(c: CollectionActionItem): UrgencyLevel {
  if (c.overdue_count > 0) return "red";
  if (c.stalled_count > 0) return c.stalled_count >= 2 ? "red" : "amber";
  if (c.products.some((p) => p.product_stage === "sampling" || p.product_stage === "production" || p.product_stage === "qc")) return "blue";
  return "gray";
}

const URGENCY_STYLES: Record<UrgencyLevel, { bar: string; badge: string; badgeFg: string; label: string }> = {
  red:   { bar: "#EF4444", badge: "#FEE2E2", badgeFg: "#B91C1C", label: "Needs action" },
  amber: { bar: "#F59E0B", badge: "#FEF3C7", badgeFg: "#92400E", label: "Follow up" },
  blue:  { bar: "#6366F1", badge: "#EDE9FE", badgeFg: "#4C1D95", label: "In progress" },
  gray:  { bar: "var(--sa-accent)", badge: "var(--sa-accent-light)", badgeFg: "var(--sa-accent)", label: "Active" },
};

function getCollectionReminder(c: CollectionActionItem): string {
  if (c.overdue_count > 0) {
    const affected = c.products.filter((p) => p.overdue_milestones.length > 0);
    if (c.overdue_count === 1 && affected[0]) {
      return `"${affected[0].overdue_milestones[0].title}" on ${affected[0].product_name} is overdue — follow up now.`;
    }
    return `${c.overdue_count} milestones across ${affected.length} product${affected.length > 1 ? "s" : ""} are overdue.`;
  }
  if (c.stalled_count > 0) {
    const worst = c.products.find((p) => p.days_since_update === null || (p.days_since_update ?? 0) > 7);
    if (worst) {
      const days = worst.days_since_update === null ? "a long time" : `${worst.days_since_update} days`;
      return `${worst.product_name} hasn't had an update in ${days} — chase your supplier.`;
    }
  }
  const sampling = c.products.filter((p) => p.product_stage === "sampling").length;
  if (sampling > 0) return `${sampling} product${sampling > 1 ? "s" : ""} in sampling — confirm timelines with your factory.`;
  const prod = c.products.filter((p) => p.product_stage === "production").length;
  if (prod > 0) return `${prod} product${prod > 1 ? "s" : ""} in production — request a progress update.`;
  return "Keep this collection moving — check in with your contacts.";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDue(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  return `due ${formatDate(dateStr)}`;
}

// ── Product row within a collection card ─────────────
function ProductRow({
  product, onMilestoneDone,
}: {
  product: CollectionProduct;
  onMilestoneDone: (id: string) => void;
}) {
  const isProblematic = product.overdue_milestones.length > 0 || product.days_since_update === null || (product.days_since_update ?? 0) > 7;

  return (
    <div className={`rounded-lg px-3 py-2.5 flex flex-col gap-2 ${isProblematic ? "" : "opacity-60"}`}
      style={{ background: isProblematic ? "var(--sa-bg)" : "transparent", border: isProblematic ? "1px solid var(--sa-border)" : "none" }}>
      {/* Product header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${product.overdue_milestones.length > 0 ? "bg-red-400" : (product.days_since_update === null || (product.days_since_update ?? 0) > 7) ? "bg-amber-400" : "bg-green-400"}`} />
          <Link
            href={`/products/${product.product_id}`}
            className="text-[12px] font-medium text-[var(--sa-text-primary)] hover:text-[var(--sa-accent)] transition-colors truncate"
          >
            {product.product_name}
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {product.days_since_update !== null && product.days_since_update > 7 && product.overdue_milestones.length === 0 && (
            <span className="text-[10px] font-medium" style={{ color: "#F59E0B" }}>{product.days_since_update}d stalled</span>
          )}
          {product.days_since_update === null && product.overdue_milestones.length === 0 && (
            <span className="text-[10px] font-medium" style={{ color: "#EF4444" }}>never updated</span>
          )}
          <StagePill stage={product.product_stage} />
        </div>
      </div>

      {/* Overdue milestones */}
      {product.overdue_milestones.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 pl-3.5">
          <div className="min-w-0">
            <span className="text-[11px] text-red-600 font-medium truncate block">{m.title}</span>
            <span className="text-[10px] text-red-400">was due {formatDate(m.due_date)}</span>
          </div>
          <button
            onClick={() => onMilestoneDone(m.id)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium shrink-0 transition-colors"
            style={{ border: "1px solid #BBF7D0", color: "#065F46", background: "#F0FDF4" }}
          >
            <Check size={10} /> Done
          </button>
        </div>
      ))}

      {/* Next milestone */}
      {product.overdue_milestones.length === 0 && product.next_milestone && isProblematic && (
        <div className="pl-3.5 text-[10px] text-[var(--sa-text-tertiary)]">
          Next: <strong className="text-[var(--sa-text-secondary)]">{product.next_milestone.title}</strong> — {formatDue(product.next_milestone.due_date)}
        </div>
      )}
    </div>
  );
}

// ── Collection spotlight card ────────────────────────
function CollectionCard({
  collection, tickKey, idx, total, onPrev, onNext, onMilestoneDone,
}: {
  collection: CollectionActionItem;
  tickKey: number;
  idx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onMilestoneDone: (id: string) => void;
}) {
  const urg = collectionUrgencyLevel(collection);
  const styles = URGENCY_STYLES[urg];
  const reminder = getCollectionReminder(collection);

  return (
    <div className="flex flex-col h-full">
      <AnimatePresence mode="wait">
        <motion.div
          key={collection.project_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {/* Card header */}
          <div className="px-6 pt-6 pb-4 shrink-0">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold text-white" style={{ background: styles.bar }}>
                  {collection.client_initial}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--sa-text-tertiary)]">{collection.client_name}</p>
                  <p className="text-[19px] font-semibold text-[var(--sa-text-primary)] leading-tight">{collection.project_name}</p>
                  <p className="text-[11px] text-[var(--sa-text-tertiary)] mt-0.5">
                    {collection.project_season && <span>{collection.project_season} · </span>}
                    {collection.products.length} product{collection.products.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold leading-none" style={{ background: styles.badge, color: styles.badgeFg }}>
                {styles.label}
              </span>
            </div>

            {/* Reminder */}
            <div className="rounded-xl px-4 py-3" style={{ background: styles.badge }}>
              <p className="text-[12px] leading-relaxed font-medium" style={{ color: styles.badgeFg }}>{reminder}</p>
            </div>
          </div>

          {/* Product list — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-1">Products</p>
            {collection.products.map((product) => (
              <ProductRow key={product.product_id} product={product} onMilestoneDone={onMilestoneDone} />
            ))}
          </div>

          {/* View collection link */}
          <div className="px-6 pb-4 shrink-0">
            <Link
              href={`/projects/${collection.project_id}`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-medium transition-opacity bg-[var(--sa-accent)] text-white hover:opacity-90"
            >
              View collection <ArrowRight size={12} />
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress + nav + queue peek */}
      <div className="px-6 pb-5 pt-3 flex flex-col gap-3 shrink-0" style={{ borderTop: "1px solid var(--sa-border)" }}>
        <div className="h-0.5 w-full rounded-full overflow-hidden" style={{ background: "var(--sa-border-strong)" }}>
          <motion.div
            key={tickKey}
            className="h-full rounded-full"
            style={{ background: styles.bar }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 8, ease: "linear" }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--sa-text-tertiary)]">{idx + 1} of {total} collections</span>
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--sa-hover)] transition-colors" style={{ border: "1px solid var(--sa-border)" }}>
              <ChevronLeft size={13} className="text-[var(--sa-text-secondary)]" />
            </button>
            <button onClick={onNext} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--sa-hover)] transition-colors" style={{ border: "1px solid var(--sa-border)" }}>
              <ChevronRight size={13} className="text-[var(--sa-text-secondary)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task row ─────────────────────────────────────────
function TaskRow({ task, onDone }: { task: DashboardTask; onDone: (id: string) => void }) {
  const [done, setDone] = useState(false);

  async function handle() {
    setDone(true);
    // Persist first so we know the DB update succeeded before we drop it from the local list.
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", task.id);
    if (error) {
      // Roll back the visual checkmark if the persist failed.
      setDone(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
    onDone(task.id);
  }

  return (
    <motion.div
      animate={{ opacity: done ? 0 : 1, height: done ? 0 : "auto" }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2.5 overflow-hidden"
    >
      <button
        onClick={handle}
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors"
        style={{ border: `1.5px solid ${task.is_overdue ? "#EF4444" : "var(--sa-border-strong)"}` }}
      >
        {done && <Check size={10} className="text-green-600" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--sa-text-primary)] leading-snug">{task.title}</p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="text-[10px] text-[var(--sa-text-tertiary)]">{task.client_name} · {task.project_name}</span>
          {task.due_date && (
            <span className={`text-[10px] font-medium ${task.is_overdue ? "text-red-500" : "text-[var(--sa-text-tertiary)]"}`}>
              · {formatDue(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Action queue ─────────────────────────────────────
function ActionQueue({
  collections, tasks, onTaskDone,
}: {
  collections: CollectionActionItem[];
  tasks: DashboardTask[];
  onTaskDone: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.is_overdue);
  const upcomingTasks = tasks.filter((t) => !t.is_overdue);

  // Flat list of all problem products across collections
  const overdueProducts = collections.flatMap((c) =>
    c.products
      .filter((p) => p.overdue_milestones.length > 0)
      .map((p) => ({ ...p, client_name: c.client_name, project_id: c.project_id, project_name: c.project_name }))
  );
  const stalledProducts = collections.flatMap((c) =>
    c.products
      .filter((p) => p.overdue_milestones.length === 0 && (p.days_since_update === null || p.days_since_update > 7))
      .map((p) => ({ ...p, client_name: c.client_name, project_id: c.project_id, project_name: c.project_name }))
  );

  const empty = tasks.length === 0 && overdueProducts.length === 0 && stalledProducts.length === 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Tasks */}
      {tasks.length > 0 && (
        <section className="px-5 py-4" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-3 flex items-center gap-1.5">
            <CheckSquare size={11} /> Tasks due soon ({tasks.length})
          </p>
          <div className="flex flex-col gap-2.5">
            {overdueTasks.length > 0 && <p className="text-[9px] font-semibold uppercase tracking-wider text-red-500">Overdue</p>}
            {overdueTasks.map((t) => <TaskRow key={t.id} task={t} onDone={onTaskDone} />)}
            {upcomingTasks.length > 0 && overdueTasks.length > 0 && <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mt-1">Upcoming</p>}
            {upcomingTasks.map((t) => <TaskRow key={t.id} task={t} onDone={onTaskDone} />)}
          </div>
        </section>
      )}

      {/* Overdue milestones */}
      {overdueProducts.length > 0 && (
        <section className="px-5 py-4" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-3 flex items-center gap-1.5">
            <AlertTriangle size={11} /> Overdue milestones
          </p>
          <div className="flex flex-col gap-3">
            {overdueProducts.map((p) =>
              p.overdue_milestones.map((m) => (
                <div key={m.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{m.title}</p>
                    <span className="text-[10px] text-red-500 shrink-0">{formatDue(m.due_date)}</span>
                  </div>
                  <Link href={`/products/${p.product_id}`} className="text-[11px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-accent)] transition-colors flex items-center gap-1.5">
                    {p.product_name} · {p.client_name}
                    <StagePill stage={p.product_stage} />
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Stalled */}
      {stalledProducts.length > 0 && (
        <section className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-3 flex items-center gap-1.5">
            <Clock size={11} /> Stalled ({stalledProducts.length})
          </p>
          <div className="flex flex-col gap-2.5">
            {stalledProducts.map((p) => (
              <div key={p.product_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/products/${p.product_id}`} className="text-[12px] font-medium text-[var(--sa-text-primary)] hover:text-[var(--sa-accent)] transition-colors truncate block">
                    {p.product_name}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-[var(--sa-text-tertiary)]">{p.client_name}</span>
                    <StagePill stage={p.product_stage} />
                  </div>
                </div>
                <span className="text-[10px] font-medium shrink-0" style={{ color: "#F59E0B" }}>
                  {p.days_since_update === null ? "never updated" : `${p.days_since_update}d stalled`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {empty && (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">All clear</p>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">No overdue items or stalled products.</p>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────
export function DashboardClient({ collections: initialCollections, tasks: initialTasks, stats }: Props) {
  const router = useRouter();
  const [collections, setCollections] = useState(initialCollections);
  const [tasks, setTasks] = useState(initialTasks);
  const [idx, setIdx] = useState(0);
  const [tickKey, setTickKey] = useState(0);

  const total = collections.length;

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % total);
      setTickKey((k) => k + 1);
    }, 8000);
    return () => clearInterval(timer);
  }, [total]);

  function goTo(n: number) {
    setIdx(((n % total) + total) % total);
    setTickKey((k) => k + 1);
  }

  async function handleMilestoneDone(milestoneId: string) {
    setCollections((prev) =>
      prev.map((c) => ({
        ...c,
        products: c.products.map((p) => ({
          ...p,
          overdue_milestones: p.overdue_milestones.filter((m) => m.id !== milestoneId),
        })),
        overdue_count: c.products.reduce((s, p) => s + p.overdue_milestones.filter((m) => m.id !== milestoneId).length, 0),
      }))
    );
    await supabase.from("milestones").update({ completed_at: new Date().toISOString() }).eq("id", milestoneId);
    router.refresh();
  }

  function handleTaskDone(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  const current = collections[idx] ?? null;

  const statStrip = [
    { icon: AlertTriangle, label: "Collections overdue", value: stats.overdue,    color: "#EF4444" },
    { icon: Clock,         label: "Products stalled",    value: stats.stalled,    color: "#F59E0B" },
    { icon: Package,       label: "In sampling",         value: stats.inSampling, color: "#6366F1" },
    { icon: CheckSquare,   label: "Tasks today",         value: stats.tasksToday, color: "var(--sa-accent)" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Command Centre</h1>
          <p className="text-[11px] text-[var(--sa-text-tertiary)]">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statStrip.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px]" style={{ border: "1px solid var(--sa-border)", background: "var(--sa-bg)" }} title={label}>
              <Icon size={11} style={{ color }} />
              <span className="font-semibold text-[var(--sa-text-primary)]">{value}</span>
              <span className="text-[var(--sa-text-tertiary)] hidden lg:inline">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex">
        {/* Spotlight */}
        <div className="flex flex-col overflow-hidden bg-[var(--sa-window)] border-b md:border-b-0 md:w-[58%]" style={{ borderRight: "1px solid var(--sa-border)" }}>
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-10">
              <p className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Everything is on track</p>
              <p className="text-[13px] text-[var(--sa-text-tertiary)]">No active collections need attention right now.</p>
            </div>
          ) : current ? (
            <CollectionCard
              collection={current}
              tickKey={tickKey}
              idx={idx}
              total={total}
              onPrev={() => goTo(idx - 1)}
              onNext={() => goTo(idx + 1)}
              onMilestoneDone={handleMilestoneDone}
            />
          ) : null}
        </div>

        {/* Action queue */}
        <div className="flex-1 md:overflow-hidden flex flex-col bg-[var(--sa-bg)]">
          <div className="px-5 py-3 shrink-0 bg-[var(--sa-window)]" style={{ borderBottom: "1px solid var(--sa-border)" }}>
            <p className="text-[11px] font-semibold text-[var(--sa-text-secondary)]">Action queue</p>
          </div>
          <ActionQueue collections={collections} tasks={tasks} onTaskDone={handleTaskDone} />
        </div>
      </div>
    </div>
  );
}
