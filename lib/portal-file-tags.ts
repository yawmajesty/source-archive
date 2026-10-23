// ─────────────────────────────────────────────────────────────
// What a client's upload is, and what it is for.
//
// Two separate questions, asked separately on purpose. A logo and a print
// file are both artwork in the loose sense, but one belongs to the brand
// and the other belongs to one garment — and a file dropped in with
// neither answered is a file somebody has to open to identify later.
//
// A fixed list rather than free text. Free tags turn into "logo", "Logo",
// "logos" and "brand logo" within a month, and then nothing can be
// filtered.
// ─────────────────────────────────────────────────────────────

export interface FileTag {
  id: string;
  label: string;
  /** Brand-level things belong to the client; product-level to one garment. */
  scope: "brand" | "product";
  hint: string;
}

export const FILE_TAGS: FileTag[] = [
  // ── The brand, not any one product ──
  { id: "logo",        label: "Logo",             scope: "brand",   hint: "Marks, wordmarks, icon files" },
  { id: "packaging",   label: "Packaging",        scope: "brand",   hint: "Boxes, polybags, tissue, stickers" },
  { id: "brand_guide", label: "Brand guidelines", scope: "brand",   hint: "Colours, fonts, how it should look" },
  { id: "labels",      label: "Labels & tags",    scope: "brand",   hint: "Care labels, woven labels, swing tags" },

  // ── One garment ──
  { id: "artwork",     label: "Artwork",          scope: "product", hint: "Prints, graphics, embroidery files" },
  { id: "techpack",    label: "Tech pack",        scope: "product", hint: "The specification for one style" },
  { id: "measurements",label: "Measurements",     scope: "product", hint: "Size charts, grading, spec sheets" },
  { id: "reference",   label: "Reference",        scope: "product", hint: "A sample photo or a garment you like" },

  // ── Neither ──
  { id: "other",       label: "Something else",   scope: "brand",   hint: "Anything that doesn't fit above" },
];

export const FILE_TAG_LABEL: Record<string, string> = Object.fromEntries(
  FILE_TAGS.map((t) => [t.id, t.label]),
);

/** Tags that are about one garment, so the product question is worth asking. */
export function tagWantsProduct(tagId: string | null | undefined): boolean {
  if (!tagId) return false;
  return FILE_TAGS.find((t) => t.id === tagId)?.scope === "product";
}
