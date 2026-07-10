// Costing helpers — FX conversion, per-product margin math, and
// collection-level rollups. Pure functions, no DB access; call sites
// pass in the collection so tests / server components can reuse.

import type { Collection, Product, CostBreakdown } from "./brand-catalog";

// Common currencies people quote in; used as defaults in the FX
// editor. Rates aren't shipped — brand fills them in.
export const CURRENCIES = ["USD", "GBP", "EUR", "CNY", "JPY", "AUD", "CAD"];

// Format a monetary value in a given currency. Two decimals for
// obviously-decimalised currencies; zero for JPY / KRW.
export function formatCurrency(value: number, currency: string): string {
  const isSubUnitLess = currency === "JPY" || currency === "KRW";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: isSubUnitLess ? 0 : 2,
    maximumFractionDigits: isSubUnitLess ? 0 : 2,
  }).format(value);
}

// Sum a partial breakdown into a single per-unit figure. Returns null
// when every field is undefined, so the UI can distinguish "no
// breakdown" from "breakdown that totals zero".
export function sumBreakdown(bd: CostBreakdown | null | undefined): number | null {
  if (!bd) return null;
  const entries = Object.values(bd).filter((v) => typeof v === "number") as number[];
  if (entries.length === 0) return null;
  return entries.reduce((s, v) => s + v, 0);
}

// Convert a monetary value from `fromCurrency` to the collection's
// base currency using the collection's fx_rates map. Returns null if
// no rate exists AND the currencies differ. A currency = base returns
// the value unchanged.
export function convertToBase(
  value: number,
  fromCurrency: string | null | undefined,
  collection: Pick<Collection, "base_currency" | "fx_rates">,
): number | null {
  const base = collection.base_currency;
  const from = fromCurrency ?? base;
  if (from === base) return value;
  const rate = collection.fx_rates?.[from];
  if (typeof rate !== "number" || rate <= 0) return null;
  // fx_rates[X] = value of 1 X in base currency
  return value * rate;
}

// Per-product costing summary — resolves the effective per-unit cost
// (either the explicit estimated_cost or a summed breakdown) and
// converts to the collection's base currency. Every field that can
// be missing is nullable; the UI shows an em-dash when null.
export interface ProductMargin {
  qty: number;
  costPerUnitNative: number | null;
  costCurrency: string;             // resolved currency actually used
  costPerUnitBase: number | null;   // converted, ready for rollups
  retailPerUnitBase: number | null; // already in base currency
  unitProfit: number | null;
  totalCost: number | null;
  totalRevenue: number | null;
  totalProfit: number | null;
  marginPct: number | null;         // (retail - cost) / retail
  markupMultiple: number | null;    // retail / cost
  belowTarget: boolean;             // true if marginPct < collection.target_margin_pct
}

export function computeProductMargin(
  product: Product,
  collection: Pick<Collection, "base_currency" | "fx_rates" | "target_margin_pct">,
): ProductMargin {
  const qty = product.target_quantity ?? 0;
  const explicitCost = product.estimated_cost;
  const breakdownCost = sumBreakdown(product.cost_breakdown);
  // The costing card lets the user choose either the single number
  // (fast path) or the breakdown. If both are set, breakdown wins —
  // the breakdown is more auditable.
  const costPerUnitNative = breakdownCost ?? explicitCost ?? null;
  const costCurrency = product.cost_currency ?? collection.base_currency;
  const costPerUnitBase =
    costPerUnitNative != null ? convertToBase(costPerUnitNative, costCurrency, collection) : null;

  const retailPerUnitBase = product.sale_price_retail;

  const unitProfit =
    costPerUnitBase != null && retailPerUnitBase != null ? retailPerUnitBase - costPerUnitBase : null;
  const totalCost = costPerUnitBase != null && qty > 0 ? costPerUnitBase * qty : null;
  const totalRevenue = retailPerUnitBase != null && qty > 0 ? retailPerUnitBase * qty : null;
  const totalProfit =
    totalCost != null && totalRevenue != null ? totalRevenue - totalCost : null;
  const marginPct =
    retailPerUnitBase != null && costPerUnitBase != null && retailPerUnitBase > 0
      ? ((retailPerUnitBase - costPerUnitBase) / retailPerUnitBase) * 100
      : null;
  const markupMultiple =
    retailPerUnitBase != null && costPerUnitBase != null && costPerUnitBase > 0
      ? retailPerUnitBase / costPerUnitBase
      : null;

  const belowTarget = marginPct != null && marginPct < collection.target_margin_pct;

  return {
    qty,
    costPerUnitNative,
    costCurrency,
    costPerUnitBase,
    retailPerUnitBase,
    unitProfit,
    totalCost,
    totalRevenue,
    totalProfit,
    marginPct,
    markupMultiple,
    belowTarget,
  };
}

// Aggregate a set of products into a collection-level rollup.
export interface CollectionRollup {
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  blendedMarginPct: number | null;
  productCount: number;
  productsPricedCount: number;   // products with retail + cost both set
  productsBelowTarget: number;
  byCategory: Array<{
    category: string;
    productCount: number;
    totalSpend: number;
    totalRevenue: number;
    totalProfit: number;
    blendedMarginPct: number | null;
  }>;
}

export function computeCollectionRollup(
  products: Product[],
  collection: Pick<Collection, "base_currency" | "fx_rates" | "target_margin_pct">,
): CollectionRollup {
  let totalSpend = 0;
  let totalRevenue = 0;
  let productsPricedCount = 0;
  let productsBelowTarget = 0;
  const catBuckets = new Map<string, { productCount: number; spend: number; revenue: number }>();

  for (const p of products) {
    const m = computeProductMargin(p, collection);
    if (m.totalCost != null) totalSpend += m.totalCost;
    if (m.totalRevenue != null) totalRevenue += m.totalRevenue;
    if (m.totalCost != null && m.totalRevenue != null) productsPricedCount++;
    if (m.belowTarget) productsBelowTarget++;

    const bucket = catBuckets.get(p.category) ?? { productCount: 0, spend: 0, revenue: 0 };
    bucket.productCount += 1;
    if (m.totalCost != null) bucket.spend += m.totalCost;
    if (m.totalRevenue != null) bucket.revenue += m.totalRevenue;
    catBuckets.set(p.category, bucket);
  }

  const totalProfit = totalRevenue - totalSpend;
  const blendedMarginPct = totalRevenue > 0 ? ((totalRevenue - totalSpend) / totalRevenue) * 100 : null;

  return {
    totalSpend,
    totalRevenue,
    totalProfit,
    blendedMarginPct,
    productCount: products.length,
    productsPricedCount,
    productsBelowTarget,
    byCategory: Array.from(catBuckets.entries()).map(([category, b]) => ({
      category,
      productCount: b.productCount,
      totalSpend: b.spend,
      totalRevenue: b.revenue,
      totalProfit: b.revenue - b.spend,
      blendedMarginPct: b.revenue > 0 ? ((b.revenue - b.spend) / b.revenue) * 100 : null,
    })),
  };
}
