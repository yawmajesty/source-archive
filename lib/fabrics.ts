// ─────────────────────────────────────────────────────────────
// Fabric library.
//
// Filterable by what a new brand knows — price, MOQ, lead time — not by GSM
// and construction. our_cost_usd and mill_notes are internal and must never
// reach a public surface.
// ─────────────────────────────────────────────────────────────

export type PriceUnit = "metre" | "yard" | "sqft" | "kg";
export type StockStatus = "in_stock" | "made_to_order" | "deadstock" | "discontinued";

export type FabricTier = "premium" | "standard";

export const FABRIC_TIERS: { id: FabricTier; label: string; prefix: string }[] = [
  { id: "premium",  label: "Premium",  prefix: "P" },
  { id: "standard", label: "Standard", prefix: "S" },
];

/**
 * The fabric taxonomy. `code` is the short form baked into every fabric code
 * (P-CLW-001), so these must never be renamed once fabrics exist — relabel
 * `en`/`zh` freely, but leave `code` alone.
 */
export interface FabricCategory {
  code: string;
  en: string;
  zh: string;
}

export const FABRIC_CATEGORIES: FabricCategory[] = [
  { code: "CLW", en: "Cotton / Linen Base Woven",   zh: "棉麻底梭织面料" },
  { code: "SYW", en: "Synthetic Woven (Outdoor)",   zh: "合成纤维梭织面料 / 户外类" },
  { code: "KJS", en: "Knit Jersey",                 zh: "针织汗布" },
  { code: "FTY", en: "French Terry",                zh: "法式毛圈布 / 卫衣布" },
  { code: "YDC", en: "Yarn-dyed Checks & Stripes",  zh: "色织格纹与条纹面料" },
  { code: "WFL", en: "Wool / Fleece",               zh: "毛呢 / 羊羔绒" },
  { code: "PUL", en: "PU Leather",                  zh: "PU 聚氨酯皮革" },
  { code: "GLR", en: "Genuine Leather",             zh: "真皮 / 皮革" },
  { code: "DNM", en: "Denim",                       zh: "牛仔布" },
  { code: "SLK", en: "Silk / Satin",                zh: "真丝 / 缎面" },
  { code: "MSH", en: "Mesh / Netting",              zh: "网眼布" },
  { code: "RIB", en: "Rib Knit",                    zh: "罗纹针织布" },
];

export function categoryByCode(code: string | null | undefined): FabricCategory | undefined {
  return FABRIC_CATEGORIES.find((c) => c.code === code);
}

/**
 * The two photos a fabric is actually judged on. Everything else is optional
 * extra; these two are the standard.
 */
export const REQUIRED_SHOTS = [
  { id: "texture", label: "Texture close-up", hint: "Fill the frame with the surface — weave, pile, grain." },
  { id: "color",   label: "Colour",           hint: "The fabric as the colour reads, in even light." },
] as const;

export type FabricShot = "texture" | "color" | "swatch" | "drape" | "detail" | "garment" | "other";

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
  code: string | null;
  tier: FabricTier;
  category: string;
  category_code: string | null;
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

/** A fabric is ready to publish once it has the standard template filled in. */
export function templateGaps(f: Partial<Fabric>, shots: string[]): string[] {
  const gaps: string[] = [];
  if (!f.name?.trim()) gaps.push("Name");
  if (!f.composition?.trim()) gaps.push("Composition");
  if (f.gsm == null) gaps.push("Weight (GSM)");
  if (!f.category_code) gaps.push("Fabric type");
  if (!shots.includes("texture")) gaps.push("Texture close-up photo");
  if (!shots.includes("color")) gaps.push("Colour photo");
  return gaps;
}
