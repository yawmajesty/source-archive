// ─────────────────────────────────────────────────────────────
// Fabric library.
//
// Filterable by what a new brand knows — price, MOQ, lead time — not by GSM
// and construction. our_cost_usd and mill_notes are internal and must never
// reach a public surface.
// ─────────────────────────────────────────────────────────────

export type PriceUnit = "metre" | "yard" | "sqft" | "kg";
export type StockStatus = "in_stock" | "made_to_order" | "deadstock" | "discontinued";

export const FABRIC_CATEGORIES = [
  "Jersey", "French terry", "Fleece", "Rib", "Knit — other",
  "Denim", "Twill", "Canvas", "Poplin", "Woven — other",
  "Shell / technical", "Ripstop", "Wool", "Linen",
  "Leather / hide", "Lining", "Mesh", "Corduroy",
] as const;

export const SUSTAINABILITY_TAGS = [
  "GOTS", "GRS", "OEKO-TEX", "Recycled", "Organic", "Deadstock", "BCI", "Bluesign",
] as const;

export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  made_to_order: "Made to order",
  deadstock: "Deadstock",
  discontinued: "Discontinued",
};

export interface Fabric {
  id: string;
  agency_id: string;
  name: string;
  category: string;
  composition: string | null;
  gsm: number | null;
  mill: string | null;
  hand_feel: string | null;
  stretch: string | null;
  drape: string | null;
  price_per_unit_usd: number | null;
  price_unit: PriceUnit;
  price_band: string | null;
  moq: number | null;
  moq_unit: string | null;
  lead_time_days: number | null;
  stock_status: StockStatus;
  consumption_per_unit: number | null;
  sustainability: string[];
  swatch_url: string | null;
  notes: string | null;
  our_cost_usd: number | null;
  mill_notes: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Everything a client may see. Strips our cost and mill notes. */
export type PublicFabric = Omit<Fabric, "our_cost_usd" | "mill_notes" | "agency_id">;

export function toPublicFabric(f: Fabric): PublicFabric {
  const { our_cost_usd: _c, mill_notes: _m, agency_id: _a, ...rest } = f;
  return rest;
}

/** Derive the band from price when one hasn't been set by hand. */
export function priceBandFor(price: number | null, unit: PriceUnit): string | null {
  if (price == null) return null;
  const perMetre = unit === "sqft" ? price * 9 : price;
  if (perMetre < 6) return "$";
  if (perMetre < 12) return "$$";
  if (perMetre < 25) return "$$$";
  return "$$$$";
}

/** "What this costs you" — the panel that makes the library a tool. */
export function fabricCostFor(f: Fabric | PublicFabric, quantity: number): {
  perUnit: number | null; total: number | null; belowMoq: boolean; unitsNeeded: number | null;
} {
  if (f.price_per_unit_usd == null || f.consumption_per_unit == null) {
    return { perUnit: null, total: null, belowMoq: false, unitsNeeded: null };
  }
  const perUnit = f.price_per_unit_usd * f.consumption_per_unit;
  const unitsNeeded = f.consumption_per_unit * quantity;
  return {
    perUnit,
    total: perUnit * quantity,
    belowMoq: f.moq != null && unitsNeeded < f.moq,
    unitsNeeded,
  };
}
