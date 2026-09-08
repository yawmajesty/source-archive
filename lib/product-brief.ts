// ─────────────────────────────────────────────────────────────
// The brief a client fills in to add a garment to their collection.
//
// Adding a product used to be an agency-only act, so a client who
// wanted something new sent an email and someone retyped it. The
// questions here are the ones that email always failed to answer.
// ─────────────────────────────────────────────────────────────

export type BriefStatus = "draft" | "submitted" | "accepted" | "declined";

export interface ProductBrief {
  id: string;
  client_id: string;
  project_id: string;
  product_id: string | null;
  name: string;
  category: string | null;
  description: string | null;
  fabric_notes: string | null;
  fit_notes: string | null;
  fit_type: string[];
  size_range: string | null;
  colourways: string | null;
  trims_notes: string | null;
  print_notes: string | null;
  packaging_notes: string | null;
  target_quantity: number | null;
  target_price: number | null;
  currency: string;
  needed_by: string | null;
  reference_urls: string[];
  notes: string | null;
  status: BriefStatus;
  submitted_by_name: string | null;
  created_at: string;
}

export interface BriefMedia {
  id: string;
  brief_id: string;
  slot: string;
  image_url: string;
  note: string | null;
  position: number;
}

/**
 * Where a reference photo belongs.
 *
 * Same shape as the shoot brief, for the same reason: one pile of
 * images makes the reader guess which part each is about, and a guess
 * about fit when you meant fabric is an expensive sample.
 */
export const BRIEF_MEDIA_SLOTS: { id: string; label: string; hint: string }[] = [
  { id: "reference", label: "The garment",  hint: "Something close to what you want made" },
  { id: "fabric",    label: "Fabric",       hint: "The cloth, or something with the right handle" },
  { id: "fit",       label: "Fit",          hint: "How it should sit — length, volume, where it breaks" },
  { id: "colour",    label: "Colour",       hint: "The shade to match" },
  { id: "detail",    label: "Details",      hint: "Pockets, cuffs, closures, seams" },
  { id: "trim",      label: "Trims",        hint: "Zips, buttons, cord, hardware" },
  { id: "print",     label: "Print & artwork", hint: "Graphics, embroidery, placement" },
  { id: "packaging", label: "Packaging",    hint: "Labels, tags, how it arrives" },
];

export const SLOT_LABEL: Record<string, string> = Object.fromEntries(
  BRIEF_MEDIA_SLOTS.map((s) => [s.id, s.label]),
);

/** The written half, in the order a garment gets described. */
export const BRIEF_TEXT_FIELDS: {
  key: keyof ProductBrief; label: string; hint: string; slot: string; long?: boolean;
}[] = [
  { key: "description",     label: "What it is",   slot: "reference", hint: "Describe the garment in a sentence or two", long: true },
  { key: "fabric_notes",    label: "Fabric",       slot: "fabric",    hint: "Weight, handle, composition — or just what it should feel like", long: true },
  { key: "fit_notes",       label: "Fit",          slot: "fit",       hint: "Oversized, true to size, cropped. Where it should sit", long: true },
  { key: "colourways",      label: "Colours",      slot: "colour",    hint: "One per line if there are several" },
  { key: "trims_notes",     label: "Trims & hardware", slot: "trim",  hint: "Zips, buttons, cord, anything specific" },
  { key: "print_notes",     label: "Print & artwork",  slot: "print", hint: "Graphics, embroidery, and where they go" },
  { key: "packaging_notes", label: "Packaging",    slot: "packaging", hint: "Labels, tags, how it should arrive" },
];

export const FIT_TYPES = [
  "Oversized", "Relaxed", "Regular", "Slim", "Cropped", "Longline", "Boxy", "Tailored",
];

export const PRODUCT_CATEGORIES = [
  "Outerwear", "Knitwear", "Tops", "Shirts", "T-shirts", "Hoodies & sweats",
  "Trousers", "Shorts", "Denim", "Dresses", "Skirts", "Accessories", "Bags", "Headwear", "Other",
];

/** Which sections a brief has actually answered. */
export function briefCompleteness(
  brief: Partial<ProductBrief>,
  mediaCount: number,
): { answered: number; total: number; missing: string[] } {
  const checks: Array<[string, boolean]> = [
    ["A name", Boolean(brief.name?.trim())],
    ["What it is", Boolean(brief.description?.trim())],
    ["Fabric", Boolean(brief.fabric_notes?.trim())],
    ["Fit", Boolean(brief.fit_notes?.trim())],
    ["Colours", Boolean(brief.colourways?.trim())],
    ["A reference photo", mediaCount > 0],
    ["How many", Boolean(brief.target_quantity)],
  ];
  return {
    answered: checks.filter(([, ok]) => ok).length,
    total: checks.length,
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}
