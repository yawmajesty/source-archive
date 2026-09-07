// ─────────────────────────────────────────────────────────────
// Retail pricing engine for brand owners.
//
// The costing already in lib/brand-costing.ts answers "what margin do I
// get at this price?". This answers the question a brand owner actually
// starts with: "what should I sell it for?" — which is the same sum run
// backwards, and it is the direction people get wrong.
//
// The reason a 2× markup loses money is that the naive formula prices
// against the factory cost and ignores everything between the warehouse
// and the bank: discounting, returns, card fees, shipping. All of those
// come out of the same revenue the margin is measured on, so they have
// to sit inside the solve, not be subtracted afterwards.
//
// Pure functions, no DB access — the page, the server action and any
// future test all call the same maths.
// ─────────────────────────────────────────────────────────────

export interface PricingInputs {
  currency: string;
  /** Units in the production run. Development costs are spread across it. */
  quantity: number;

  // ── What one garment costs to make ──
  materials: number | null;
  trims: number | null;
  labour: number | null;
  packaging: number | null;
  otherPerUnit: number | null;

  // ── Getting it here ──
  freight: number | null; // per unit, inbound
  dutyPct: number | null; // % of the ex-factory value of the goods

  // ── One-off costs, spread across the run ──
  sampling: number | null; // development, pattern, sample rounds
  tooling: number | null;  // moulds, custom trims, screens, plates

  // ── What selling it costs ──
  discountPct: number | null;   // blended markdown across the season
  paymentFeePct: number | null; // card / platform fee
  returnsPct: number | null;    // share of revenue refunded
  fulfilmentPerUnit: number | null; // pick, pack and outbound postage

  // ── How you want to price ──
  targetMarginPct: number | null;
  wholesaleMultiple: number | null; // × true cost
  retailMultiple: number | null;    // × wholesale
}

export const PRICING_DEFAULTS: PricingInputs = {
  currency: "USD",
  quantity: 100,
  materials: null,
  trims: null,
  labour: null,
  packaging: null,
  otherPerUnit: null,
  freight: null,
  dutyPct: null,
  sampling: null,
  tooling: null,
  // Sane starting points a brand owner can argue with, not invented precision.
  discountPct: 15,
  paymentFeePct: 2.9,
  returnsPct: 8,
  fulfilmentPerUnit: null,
  targetMarginPct: 60,
  wholesaleMultiple: 2,
  retailMultiple: 2.2,
};

export interface CostBuildUp {
  exFactory: number;          // what the factory charges you
  duty: number;
  landed: number;             // ex-factory + freight + duty
  developmentPerUnit: number; // sampling + tooling, spread across the run
  trueCost: number;           // what one garment has really cost you
}

/** A price, and everything that happens to it on the way to the bank. */
export interface PriceOutcome {
  price: number;
  revenue: number;      // after discounting
  discountGiven: number;
  paymentFees: number;
  returnsAllowance: number;
  fulfilment: number;
  unitCost: number;
  contribution: number; // what's left per garment
  marginPct: number | null;
  markupMultiple: number | null;
  runContribution: number; // contribution × quantity
  viable: boolean;         // false when the price loses money
}

const n = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const pct = (v: number | null | undefined): number => n(v) / 100;

export function buildCost(input: PricingInputs): CostBuildUp {
  const exFactory =
    n(input.materials) + n(input.trims) + n(input.labour) + n(input.packaging) + n(input.otherPerUnit);
  // Duty is charged on the value of the goods, not on the freight.
  const duty = exFactory * pct(input.dutyPct);
  const landed = exFactory + n(input.freight) + duty;
  const qty = Math.max(1, Math.floor(n(input.quantity)) || 1);
  const developmentPerUnit = (n(input.sampling) + n(input.tooling)) / qty;
  return { exFactory, duty, landed, developmentPerUnit, trueCost: landed + developmentPerUnit };
}

/**
 * Run a specific asking price through everything that erodes it.
 *
 * Returns are treated the way a P&L treats them — an allowance against
 * revenue — rather than as a stock loss, which assumes a returned garment
 * is resellable. For most apparel it is; for underwear and swim it isn't,
 * and those brands should raise the returns figure to compensate.
 */
export function priceOutcome(price: number, input: PricingInputs, cost?: CostBuildUp): PriceOutcome {
  const c = cost ?? buildCost(input);
  const discountGiven = price * pct(input.discountPct);
  const revenue = price - discountGiven;
  const paymentFees = revenue * pct(input.paymentFeePct);
  const returnsAllowance = revenue * pct(input.returnsPct);
  const fulfilment = n(input.fulfilmentPerUnit);
  const contribution = revenue - paymentFees - returnsAllowance - fulfilment - c.trueCost;
  const qty = Math.max(0, Math.floor(n(input.quantity)));

  return {
    price,
    revenue,
    discountGiven,
    paymentFees,
    returnsAllowance,
    fulfilment,
    unitCost: c.trueCost,
    contribution,
    marginPct: revenue > 0 ? (contribution / revenue) * 100 : null,
    markupMultiple: c.trueCost > 0 ? price / c.trueCost : null,
    runContribution: contribution * qty,
    viable: contribution > 0,
  };
}

/**
 * The reverse solve: the asking price that leaves the target margin once
 * discounting, fees and returns have taken their cut.
 *
 * With m the target margin, d discount, f fee rate and r returns rate:
 *
 *   revenue      = price × (1 − d)
 *   contribution = revenue × (1 − f − r) − fulfilment − cost
 *   want           contribution = m × revenue
 *   so           revenue × (1 − f − r − m) = fulfilment + cost
 *
 * Returns null when the erosion rates leave nothing to price against —
 * a 70% margin is unreachable if fees and returns already take 35%.
 */
export function priceForTargetMargin(input: PricingInputs, cost?: CostBuildUp): number | null {
  const c = cost ?? buildCost(input);
  const m = pct(input.targetMarginPct);
  const headroom = 1 - pct(input.paymentFeePct) - pct(input.returnsPct) - m;
  if (headroom <= 0) return null;
  const revenue = (n(input.fulfilmentPerUnit) + c.trueCost) / headroom;
  const d = pct(input.discountPct);
  if (d >= 1) return null;
  return revenue / (1 - d);
}

/** The naive answer, kept so the page can show what the shortcut misses. */
export function naiveTargetPrice(input: PricingInputs, cost?: CostBuildUp): number | null {
  const c = cost ?? buildCost(input);
  const m = pct(input.targetMarginPct);
  if (m <= 0 || m >= 1) return null;
  return c.trueCost / (1 - m);
}

export interface PriceRecommendation {
  wholesale: number | null;
  /** Recommended retail when you sell through stockists — wholesale × the retail multiple. */
  rrp: number | null;
  /** What to charge on your own site to hit the target margin. */
  direct: number | null;
  naiveDirect: number | null;
  /** The gap the erosion rates open up between the two. */
  naiveShortfall: number | null;
}

export function recommend(input: PricingInputs, cost?: CostBuildUp): PriceRecommendation {
  const c = cost ?? buildCost(input);
  const wm = n(input.wholesaleMultiple);
  const rm = n(input.retailMultiple);
  const wholesale = wm > 0 && c.trueCost > 0 ? c.trueCost * wm : null;
  const rrp = wholesale != null && rm > 0 ? wholesale * rm : null;
  const direct = priceForTargetMargin(input, c);
  const naiveDirect = naiveTargetPrice(input, c);
  return {
    wholesale,
    rrp,
    direct,
    naiveDirect,
    naiveShortfall: direct != null && naiveDirect != null ? direct - naiveDirect : null,
  };
}

/** Units that have to sell before the run has paid for itself. */
export function breakEvenUnits(outcome: PriceOutcome, fixedCosts: number): number | null {
  if (outcome.contribution <= 0) return null;
  return Math.ceil(fixedCosts / outcome.contribution);
}

// ── Presentation ──────────────────────────────────────────────

export const PRICING_CURRENCIES = ["USD", "GBP", "EUR", "CNY", "JPY", "AUD", "CAD"];

export function money(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const whole = currency === "JPY" || currency === "KRW";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value);
}

export function percent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

/** How a margin reads at a glance. Apparel wholesale lives around 50–60%. */
export function marginVerdict(marginPct: number | null): {
  tone: "good" | "thin" | "loss" | "unknown";
  label: string;
} {
  if (marginPct == null) return { tone: "unknown", label: "Needs a price" };
  if (marginPct < 0) return { tone: "loss", label: "Loses money" };
  if (marginPct < 40) return { tone: "thin", label: "Thin" };
  return { tone: "good", label: "Healthy" };
}

/** The cost lines, in the order a garment actually accumulates them. */
export const COST_FIELDS: Array<{ key: keyof PricingInputs; label: string; hint: string }> = [
  { key: "materials",    label: "Fabric",        hint: "Shell and lining, at the price per garment" },
  { key: "trims",        label: "Trims",         hint: "Zips, buttons, labels, thread" },
  { key: "labour",       label: "Labour (CMT)",  hint: "What the factory charges to cut, make and trim" },
  { key: "packaging",    label: "Packaging",     hint: "Polybag, hangtag, box" },
  { key: "otherPerUnit", label: "Other",         hint: "Wash, print, embroidery, anything else per garment" },
];

export const LANDING_FIELDS: Array<{ key: keyof PricingInputs; label: string; hint: string; suffix?: string }> = [
  { key: "freight", label: "Freight per unit", hint: "Shipping from the factory, divided by the run" },
  { key: "dutyPct", label: "Import duty",      hint: "Charged on the value of the goods, not the freight", suffix: "%" },
];

export const DEVELOPMENT_FIELDS: Array<{ key: keyof PricingInputs; label: string; hint: string }> = [
  { key: "sampling", label: "Development", hint: "Patterns and sample rounds for this style" },
  { key: "tooling",  label: "Tooling",     hint: "Moulds, custom trims, screens — one-offs" },
];

export const SELLING_FIELDS: Array<{ key: keyof PricingInputs; label: string; hint: string; suffix?: string }> = [
  { key: "discountPct",       label: "Average discount", hint: "What share of the price you give away across a season, blended", suffix: "%" },
  { key: "paymentFeePct",     label: "Payment fees",     hint: "Card and platform fees on what you take", suffix: "%" },
  { key: "returnsPct",        label: "Returns",          hint: "Share of revenue refunded. Raise it for swim and underwear", suffix: "%" },
  { key: "fulfilmentPerUnit", label: "Fulfilment",       hint: "Pick, pack and postage on one order" },
];
