// Planning helpers — deadline aggregation, overdue detection, and
// timeline layout. All pure functions so views can pre-compute at
// render time without extra round-trips.

import type { Collection, Product, Stage } from "./brand-catalog";
import { stageIndex } from "./brand-catalog";
import { getBrandSupabase } from "./supabase-brand";

// ── Milestone type ────────────────────────────────────────────────

export interface Milestone {
  id: string;
  workspace_id: string;
  collection_id: string | null;
  product_id: string | null;
  title: string;
  date: string; // YYYY-MM-DD
  done_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export async function listMilestones(workspaceId: string, collectionId?: string): Promise<Milestone[]> {
  const supabase = await getBrandSupabase();
  let q = supabase.from("milestones").select("*").eq("workspace_id", workspaceId).order("date", { ascending: true });
  if (collectionId) q = q.eq("collection_id", collectionId);
  const { data, error } = await q;
  if (error) {
    console.error("[brand-planning] listMilestones failed:", error);
    if (error.message?.includes("does not exist") || error.code === "42P01") {
      console.error("[brand-planning] Hint: run migrations/005_milestones.sql in Supabase.");
    }
  }
  return (data ?? []) as Milestone[];
}

// ── Deadline aggregation ─────────────────────────────────────────
// A DerivedDeadline is any dated item that could be upcoming or
// overdue: collection key dates, product targets, manual milestones.
// We tag each with the underlying source so the UI can render an
// appropriate link and icon.

export type DeadlineSource =
  | "collection_kickoff"
  | "collection_sample_deadline"
  | "collection_production_start"
  | "collection_ex_factory"
  | "collection_launch"
  | "product_sample"
  | "product_delivery"
  | "milestone_manual";

export interface Deadline {
  id: string;             // stable key for React
  source: DeadlineSource;
  title: string;
  date: string;            // YYYY-MM-DD
  isOverdue: boolean;
  isDone: boolean;         // true if the corresponding stage/state has passed
  collectionId: string;
  productId: string | null;
  productName?: string;
  productStyleCode?: string;
}

// A stage is "at or past" a target stage — used to detect whether a
// product-level deadline has been fulfilled by a stage transition.
function stageAtOrPast(stage: Stage, target: Stage): boolean {
  return stageIndex(stage) >= stageIndex(target);
}

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Compute every dated item associated with a collection — collection
 * key dates, product targets, manual milestones. Sorted ascending by
 * date. Each item is flagged as overdue if the date has passed AND
 * the corresponding fulfilment hasn't happened.
 */
export function collectDeadlines(
  collection: Collection,
  products: Product[],
  milestones: Milestone[],
): Deadline[] {
  const now = today();
  const out: Deadline[] = [];

  const push = (d: Omit<Deadline, "isOverdue"> & { isDone?: boolean }) => {
    const dateObj = parseDate(d.date);
    if (!dateObj) return;
    const isDone = d.isDone ?? false;
    const isOverdue = !isDone && dateObj.getTime() < now.getTime();
    out.push({ ...d, isDone, isOverdue });
  };

  // Collection-level key dates. "Done" for these is a soft concept —
  // we treat them as never done since they're planning anchors.
  const keyDates: Array<[DeadlineSource, string, string | null]> = [
    ["collection_kickoff",           "Kickoff",           collection.kickoff_date],
    ["collection_sample_deadline",   "Sample deadline",   collection.sample_deadline],
    ["collection_production_start",  "Production start",  collection.production_start],
    ["collection_ex_factory",        "Ex-factory target", collection.ex_factory_target],
    ["collection_launch",            "Launch",            collection.launch_date],
  ];
  for (const [src, title, date] of keyDates) {
    if (!date) continue;
    push({
      id: `${collection.id}:${src}`,
      source: src,
      title,
      date,
      isDone: false,
      collectionId: collection.id,
      productId: null,
    });
  }

  // Product target dates
  for (const p of products) {
    if (p.target_sample_date) {
      push({
        id: `${p.id}:sample`,
        source: "product_sample",
        title: `Sample due — ${p.name}`,
        date: p.target_sample_date,
        isDone: stageAtOrPast(p.stage, "sampling"),
        collectionId: collection.id,
        productId: p.id,
        productName: p.name,
        productStyleCode: p.style_code,
      });
    }
    if (p.target_delivery) {
      push({
        id: `${p.id}:delivery`,
        source: "product_delivery",
        title: `Delivery — ${p.name}`,
        date: p.target_delivery,
        isDone: stageAtOrPast(p.stage, "shipped"),
        collectionId: collection.id,
        productId: p.id,
        productName: p.name,
        productStyleCode: p.style_code,
      });
    }
  }

  // Manual milestones scoped to this collection or one of its products
  for (const m of milestones) {
    if (m.collection_id && m.collection_id !== collection.id) continue;
    if (m.product_id && !products.find((p) => p.id === m.product_id)) continue;
    push({
      id: m.id,
      source: "milestone_manual",
      title: m.title,
      date: m.date,
      isDone: !!m.done_at,
      collectionId: collection.id,
      productId: m.product_id,
      productName: m.product_id ? products.find((p) => p.id === m.product_id)?.name : undefined,
      productStyleCode: m.product_id ? products.find((p) => p.id === m.product_id)?.style_code : undefined,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Filter deadlines into windows for the digest.
 */
export function partitionDeadlines(deadlines: Deadline[]) {
  const now = today();
  const twoWeeks = new Date(now);
  twoWeeks.setDate(now.getDate() + 14);

  const overdue: Deadline[] = [];
  const thisWeek: Deadline[] = [];
  const nextWeek: Deadline[] = [];
  const later: Deadline[] = [];

  const endOfThisWeek = new Date(now);
  endOfThisWeek.setDate(now.getDate() + 7);

  for (const d of deadlines) {
    if (d.isDone) continue;
    const dateObj = parseDate(d.date);
    if (!dateObj) continue;
    if (d.isOverdue) { overdue.push(d); continue; }
    if (dateObj < endOfThisWeek) { thisWeek.push(d); continue; }
    if (dateObj < twoWeeks) { nextWeek.push(d); continue; }
    later.push(d);
  }
  return { overdue, thisWeek, nextWeek, later };
}

// ── Timeline layout ──────────────────────────────────────────────
// Convert dates into pixel positions for a horizontal Gantt-lite.

export interface TimelineWindow {
  start: Date;
  end: Date;
  totalDays: number;
}

export function computeTimelineWindow(
  collection: Collection,
  products: Product[],
  milestones: Milestone[],
): TimelineWindow {
  const dates: Date[] = [];
  const add = (s: string | null) => {
    const d = parseDate(s);
    if (d) dates.push(d);
  };

  add(collection.kickoff_date);
  add(collection.sample_deadline);
  add(collection.production_start);
  add(collection.ex_factory_target);
  add(collection.launch_date);
  for (const p of products) {
    add(p.target_sample_date);
    add(p.target_delivery);
    add(p.stage_entered_at?.slice(0, 10) ?? null);
  }
  for (const m of milestones) add(m.date);

  const now = today();
  if (dates.length === 0) {
    // No dates set yet — show a two-month default window.
    const end = new Date(now);
    end.setDate(now.getDate() + 60);
    return { start: now, end, totalDays: 60 };
  }

  let start = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  let end = dates.reduce((max, d) => (d > max ? d : max), dates[0]);

  // Always include today so the "you are here" marker sits on the chart.
  if (start > now) start = now;
  if (end < now) end = now;

  // Add a small padding on either side.
  const pad = 3;
  start = new Date(start); start.setDate(start.getDate() - pad);
  end = new Date(end); end.setDate(end.getDate() + pad);

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  return { start, end, totalDays };
}

/**
 * Return a 0-1 fractional position of a given date within the window.
 * Values outside the window are clamped so the caller can render an
 * arrow indicator if desired.
 */
export function positionForDate(dateStr: string | null | undefined, window: TimelineWindow): number | null {
  const d = parseDate(dateStr ?? null);
  if (!d) return null;
  const days = (d.getTime() - window.start.getTime()) / 86400000;
  return Math.max(0, Math.min(1, days / window.totalDays));
}
