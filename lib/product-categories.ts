// ─────────────────────────────────────────────────────────────
// What a product can be.
//
// A collection is not only garments. A drop ships with hang tags, poly
// bags, boxes, woven labels and the odd accessory, and each of those is
// quoted, sampled and invoiced exactly like a hoodie — so they are
// products, not a separate concept. What differs is which fields mean
// anything: a hang tag has no size range and no colourways.
//
// `products.category` is free text and stays free text. This list is
// what the pickers offer, not a constraint — a category typed by hand,
// or imported from a spreadsheet, keeps working.
//
// Pure data. Deliberately not in a "use server" file.
// ─────────────────────────────────────────────────────────────

export interface CategoryGroup {
  label: string;
  /** True when the things in this group are not garments. */
  nonGarment?: boolean;
  options: string[];
}

export const PRODUCT_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Garments",
    options: [
      "Tops", "T-shirts", "Shirts", "Knitwear", "Hoodies & sweats",
      "Outerwear", "Jackets", "Bottoms", "Trousers", "Shorts", "Denim",
      "Dresses", "Skirts", "Activewear", "Swimwear", "Underwear", "Loungewear",
    ],
  },
  {
    label: "Headwear, bags & footwear",
    options: ["Headwear", "Caps & hats", "Bags", "Footwear"],
  },
  {
    label: "Trims, labels & hardware",
    nonGarment: true,
    options: [
      "Hang tags", "Woven labels", "Care labels", "Size labels",
      "Patches", "Embroidery", "Hardware", "Zips & pullers",
      "Buttons", "Drawcords", "Trims",
    ],
  },
  {
    label: "Packaging & accessories",
    nonGarment: true,
    options: [
      "Packaging", "Poly bags", "Boxes", "Tissue & inserts",
      "Stickers", "Accessories", "Jewellery", "Other",
    ],
  },
];

/** Every option, flattened, in the order the groups are declared. */
export const PRODUCT_CATEGORIES: string[] =
  PRODUCT_CATEGORY_GROUPS.flatMap((g) => g.options);

const NON_GARMENT = new Set(
  PRODUCT_CATEGORY_GROUPS.filter((g) => g.nonGarment).flatMap((g) =>
    g.options.map((o) => o.toLowerCase()),
  ),
);

/**
 * Whether a category is something other than a garment.
 *
 * Used to hide the fields that would only ever be blank on it — a box
 * has no size range — rather than to change how it is priced or
 * invoiced, which is identical. Unknown categories are treated as
 * garments, because that is what most of them are and showing a field
 * nobody needs is a smaller mistake than hiding one they do.
 */
export function isNonGarmentCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return NON_GARMENT.has(category.trim().toLowerCase());
}

/** The group a category belongs to, for grouping a list by eye. */
export function categoryGroup(category: string | null | undefined): string | null {
  if (!category) return null;
  const needle = category.trim().toLowerCase();
  for (const g of PRODUCT_CATEGORY_GROUPS) {
    if (g.options.some((o) => o.toLowerCase() === needle)) return g.label;
  }
  return null;
}
