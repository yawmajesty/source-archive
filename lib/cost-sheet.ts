// ─────────────────────────────────────────────────────────────
// Production cost sheet — the breakdown behind a quote.
//
// Materials and CMT are what a factory negotiates on, so they're totalled
// separately from freight, duty and overhead. A single "unit cost" hides the
// argument; this keeps it visible.
// ─────────────────────────────────────────────────────────────

export type CostSection = "shell" | "lining" | "trim" | "other";
export type CostUnit = "metre" | "yard" | "sqft" | "kg" | "piece" | "set";
export type SheetStatus = "draft" | "awaiting_factory" | "received" | "final";

export const SECTIONS: { id: CostSection; label: string; hint: string }[] = [
  { id: "shell",  label: "Shell fabric", hint: "One line per fabric. A shell using two fabrics is two lines." },
  { id: "lining", label: "Lining",       hint: "Recorded exactly like a shell fabric, price included." },
  { id: "trim",   label: "Trims",        hint: "Zips, buttons, labels, thread — each with its unit price." },
  { id: "other",  label: "Other",        hint: "Packaging, testing, anything else per garment." },
];

export const UNITS: CostUnit[] = ["metre", "yard", "sqft", "kg", "piece", "set"];

export const STATUS_LABEL: Record<SheetStatus, string> = {
  draft: "Draft",
  awaiting_factory: "With factory",
  received: "Factory replied",
  final: "Final",
};

export interface CostSheetLine {
  id: string;
  sheet_id: string;
  section: CostSection;
  label: string;
  supplier: string | null;
  item_number: string | null;
  composition: string | null;
  unit_price: number | null;
  unit: CostUnit;
  consumption: number | null;
  fabric_id: string | null;
  position: number;
  notes: string | null;
}

export interface CostSheet {
  id: string;
  agency_id: string;
  product_id: string;
  title: string;
  currency: string;
  quantity: number;
  labor_cmt: number | null;
  labor_notes: string | null;
  freight_per_unit: number | null;
  duty_pct: number | null;
  overhead_pct: number | null;
  target_margin_pct: number | null;
  status: SheetStatus;
  share_token: string | null;
  shared_at: string | null;
  share_expires_at: string | null;
  factory_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CostBreakdown {
  /** Per garment, by section. */
  shell: number;
  lining: number;
  trim: number;
  other: number;
  materials: number;
  labor: number;
  /** Materials + CMT — what the factory quotes and what you negotiate. */
  exFactory: number;
  freight: number;
  duty: number;
  overhead: number;
  /** Everything in, per garment. */
  landed: number;
  /** For the whole run. */
  runTotal: number;
  /** Only when a target margin is set. */
  suggestedRetail: number | null;
  incomplete: number;
}

const n = (v: number | null | undefined) => (typeof v === "number" && isFinite(v) ? v : 0);

/** A line's cost per garment: what it costs × how much of it each garment uses. */
export function lineCost(line: CostSheetLine): number {
  return n(line.unit_price) * n(line.consumption);
}

export function computeBreakdown(sheet: CostSheet, lines: CostSheetLine[]): CostBreakdown {
  const bySection = (s: CostSection) =>
    lines.filter((l) => l.section === s).reduce((sum, l) => sum + lineCost(l), 0);

  const shell = bySection("shell");
  const lining = bySection("lining");
  const trim = bySection("trim");
  const other = bySection("other");
  const materials = shell + lining + trim + other;
  const labor = n(sheet.labor_cmt);
  const exFactory = materials + labor;

  const freight = n(sheet.freight_per_unit);
  // Duty is charged on the goods, not on freight or your own overhead.
  const duty = exFactory * (n(sheet.duty_pct) / 100);
  const overhead = (exFactory + freight + duty) * (n(sheet.overhead_pct) / 100);
  const landed = exFactory + freight + duty + overhead;

  const margin = n(sheet.target_margin_pct);
  // Retail from margin, not markup: price = cost / (1 - margin).
  const suggestedRetail = margin > 0 && margin < 100 ? landed / (1 - margin / 100) : null;

  // A line with no price or no consumption isn't costed yet — worth surfacing
  // rather than quietly totalling to something too low.
  const incomplete = lines.filter(
    (l) => l.unit_price == null || l.consumption == null || l.unit_price === 0,
  ).length;

  return {
    shell, lining, trim, other,
    materials, labor, exFactory,
    freight, duty, overhead, landed,
    runTotal: landed * (sheet.quantity || 0),
    suggestedRetail,
    incomplete,
  };
}

export function money(v: number | null, currency = "USD"): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
}

/** Fabric lines carry enough detail to become a library entry. Trims don't. */
export function canSaveToLibrary(line: CostSheetLine): boolean {
  return (
    (line.section === "shell" || line.section === "lining") &&
    !!line.composition?.trim() &&
    !!line.label.trim()
  );
}

/**
 * The only fields that may cross to the factory's browser.
 *
 * The factory page is public, so anything handed to the client component ends
 * up in the page payload whether it's rendered or not — view-source counts as
 * disclosure. Freight, duty, overhead, target margin, agency_id, product_id
 * and the share token itself are all deliberately absent.
 */
export type FactorySheetView = Pick<
  CostSheet,
  "id" | "title" | "currency" | "quantity" | "labor_cmt" | "labor_notes" | "status" | "factory_name"
>;

export function toFactoryView(sheet: CostSheet): FactorySheetView {
  return {
    id: sheet.id,
    title: sheet.title,
    currency: sheet.currency,
    quantity: sheet.quantity,
    labor_cmt: sheet.labor_cmt,
    labor_notes: sheet.labor_notes,
    status: sheet.status,
    factory_name: sheet.factory_name,
  };
}
