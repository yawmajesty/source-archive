// ─────────────────────────────────────────────────────────────
// Production log — the workshop diary.
//
// A maker documents each day's work on a product: drafting the pattern,
// cutting it, sewing the sample. Entries are written continuously and
// released to the client portal deliberately, in batches, when the agency
// decides that stretch of the story is ready to be seen.
// ─────────────────────────────────────────────────────────────

export type ProductionStage =
  | "pattern" | "cutting" | "sewing" | "fitting" | "finishing" | "qc" | "other";

export const PRODUCTION_STAGES: { id: ProductionStage; label: string; hint: string }[] = [
  { id: "pattern",   label: "Pattern",   hint: "Drafting or amending the pattern" },
  { id: "cutting",   label: "Cutting",   hint: "Laying up and cutting the pieces" },
  { id: "sewing",    label: "Sewing",    hint: "Assembling the sample" },
  { id: "fitting",   label: "Fitting",   hint: "On the stand or on a model" },
  { id: "finishing", label: "Finishing", hint: "Pressing, trims, hardware" },
  { id: "qc",        label: "QC",        hint: "Checking against the spec" },
  { id: "other",     label: "Other",     hint: "Anything else worth recording" },
];

export const STAGE_LABEL: Record<ProductionStage, string> = PRODUCTION_STAGES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.label }),
  {} as Record<ProductionStage, string>,
);

export interface ProductionLogEntry {
  id: string;
  agency_id: string;
  product_id: string;
  sample_id: string | null;
  stage: ProductionStage;
  work_date: string;
  summary: string;
  minutes_spent: number | null;
  blocked_reason: string | null;
  author_user_id: string;
  author_name: string | null;
  visible_to_client: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewLogEntry {
  product_id: string;
  stage: ProductionStage;
  work_date: string;
  summary: string;
  minutes_spent?: number | null;
  blocked_reason?: string | null;
  sample_id?: string | null;
}

/** Group a day's entries for a timeline view. Newest day first. */
export function groupByDate(entries: ProductionLogEntry[]): { date: string; entries: ProductionLogEntry[] }[] {
  const byDate = new Map<string, ProductionLogEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.work_date) ?? [];
    list.push(e);
    byDate.set(e.work_date, list);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, entries: list }));
}
