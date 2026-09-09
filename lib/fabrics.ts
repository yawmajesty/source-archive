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

// Deadstock deliberately lives on stock_status rather than here: recording it
// in two places would split the data, and half the deadstock would then miss
// the filter. It is both a sustainability credential and an availability
// fact — availability is the one that has to be reliable.
export const SUSTAINABILITY_TAGS = [
  "GOTS", "GRS", "OEKO-TEX", "Recycled", "Organic", "BCI", "Bluesign",
] as const;

export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  made_to_order: "Made to order",
  deadstock: "Deadstock",
  discontinued: "Discontinued",
};

export const STOCK_HINT: Record<StockStatus, string> = {
  in_stock: "Held by the mill, ready to ship.",
  made_to_order: "Woven or knitted to order against the MOQ.",
  deadstock: "Surplus from a previous run — limited quantity, usually no repeat.",
  discontinued: "No longer available; kept for reference.",
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
  /** Full width off the roll, in centimetres. */
  width_cm: number | null;
  /** Cuttable width once the selvedge is off. Null means nobody's measured it. */
  usable_width_cm: number | null;
  /** What this cloth actually suits. */
  suitable_for: string[];
  /** The caveat that doesn't fit in a tag. */
  use_notes: string | null;
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
  // Consumption recorded without a width is a number nobody can reuse.
  if (f.width_cm == null) gaps.push("Width");
  if (!f.category_code) gaps.push("Fabric type");
  if (!shots.includes("texture")) gaps.push("Texture close-up photo");
  if (!shots.includes("color")) gaps.push("Colour photo");
  return gaps;
}


// ── Width and consumption ────────────────────────────────────
//
// The two only mean something together. A garment taking 1.4m of 150cm
// goods needs closer to 1.9m at 110cm, because the marker gets laid out
// differently — so "1.4 metres" on its own is not a fact anyone can act
// on without knowing what it was measured against.

/** Common roll widths, for the picker. Mills cluster around these. */
export const COMMON_WIDTHS = [90, 110, 114, 140, 145, 150, 160, 180, 200];

/**
 * Roughly what the same garment costs in metres at a different width.
 *
 * Straight inverse proportion, which is right for a plain lay and
 * optimistic for anything else: a one-way nap, a stripe to match or a
 * large repeat all cost more than the arithmetic says. It is a
 * conversion for comparing quotes, never a substitute for a marker.
 */
export function consumptionAtWidth(
  consumption: number | null | undefined,
  fromWidthCm: number | null | undefined,
  toWidthCm: number | null | undefined,
): number | null {
  if (!consumption || !fromWidthCm || !toWidthCm) return null;
  if (fromWidthCm <= 0 || toWidthCm <= 0) return null;
  return Number(((consumption * fromWidthCm) / toWidthCm).toFixed(3));
}

/** What one garment costs in fabric, given width-aware consumption. */
export function fabricCostPerGarment(
  pricePerUnit: number | null | undefined,
  consumption: number | null | undefined,
): number | null {
  if (pricePerUnit == null || consumption == null) return null;
  return Number((pricePerUnit * consumption).toFixed(2));
}

export function widthLabel(f: Pick<Fabric, "width_cm" | "usable_width_cm">): string | null {
  if (f.width_cm == null) return null;
  const usable = f.usable_width_cm != null && f.usable_width_cm !== f.width_cm
    ? ` (${f.usable_width_cm} usable)`
    : "";
  return `${f.width_cm}cm${usable}`;
}


/**
 * End uses, grouped the way a designer thinks about a roll.
 *
 * Deliberately about the garment rather than the department: someone
 * standing in front of a fabric asks "could I make an overshirt out of
 * this", not "which category does this belong to".
 */
export const END_USES: { group: string; items: string[] }[] = [
  { group: "Tops",      items: ["T-shirts", "Shirts", "Overshirts", "Blouses", "Vests"] },
  { group: "Sweats",    items: ["Hoodies", "Crewnecks", "Sweatpants", "Zip-throughs"] },
  { group: "Outerwear", items: ["Jackets", "Coats", "Parkas", "Gilets", "Shells"] },
  { group: "Bottoms",   items: ["Trousers", "Shorts", "Jeans", "Skirts", "Cargos"] },
  { group: "Dresses",   items: ["Dresses", "Jumpsuits", "Sets"] },
  { group: "Knit",      items: ["Knitwear", "Cardigans", "Base layers"] },
  { group: "Technical", items: ["Activewear", "Swimwear", "Workwear", "Waterproofs"] },
  { group: "Inside",    items: ["Linings", "Pocketing", "Interlining", "Binding"] },
  { group: "Other",     items: ["Bags", "Headwear", "Accessories", "Homeware"] },
];

export const ALL_END_USES: string[] = END_USES.flatMap((g) => g.items);

/** Fabrics that would work for a given garment. */
export function fabricsFor(fabrics: Fabric[], endUse: string): Fabric[] {
  return fabrics.filter((f) => (f.suitable_for ?? []).includes(endUse));
}

/**
 * A gentle nudge, not a rule.
 *
 * Weight rules out some uses fairly reliably — nobody makes a parka from
 * 120gsm jersey — so flagging an obvious mismatch is worth doing. It
 * warns rather than blocks, because the exceptions are where the
 * interesting garments come from.
 */
export function weightWarningFor(gsm: number | null, uses: string[]): string | null {
  if (!gsm || uses.length === 0) return null;

  const heavyOnly = ["Coats", "Parkas", "Jeans", "Workwear"];
  const lightOnly = ["Blouses", "Linings", "Pocketing", "Base layers"];

  if (gsm < 180 && uses.some((u) => heavyOnly.includes(u))) {
    return `${gsm}gsm is light for ${uses.filter((u) => heavyOnly.includes(u)).join(", ").toLowerCase()}.`;
  }
  if (gsm > 320 && uses.some((u) => lightOnly.includes(u))) {
    return `${gsm}gsm is heavy for ${uses.filter((u) => lightOnly.includes(u)).join(", ").toLowerCase()}.`;
  }
  return null;
}
