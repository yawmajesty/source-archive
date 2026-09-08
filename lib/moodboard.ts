// ─────────────────────────────────────────────────────────────
// Moodboard shapes.
//
// The board is spatial: an image's meaning comes partly from what it
// sits next to, so position is data, not presentation. Coordinates are
// in board space and unbounded — panning and zooming happen in the
// component and never touch what's stored.
// ─────────────────────────────────────────────────────────────

export type LinkType =
  | "fabric" | "trim" | "customization" | "colour"
  | "silhouette" | "photography" | "reference";

export const LINK_TYPES: { id: LinkType; label: string; hint: string }[] = [
  { id: "fabric",        label: "Fabric",        hint: "The cloth itself — weave, weight, handle" },
  { id: "trim",          label: "Trim",          hint: "Zips, buttons, cords, hardware" },
  { id: "customization", label: "Customization", hint: "Print, embroidery, wash, patch" },
  { id: "colour",        label: "Colour",        hint: "The shade to match" },
  { id: "silhouette",    label: "Silhouette",    hint: "The shape and cut" },
  { id: "photography",   label: "Photography",   hint: "How it should be shot" },
  { id: "reference",     label: "Reference",     hint: "General direction" },
];

export const LINK_LABEL: Record<string, string> = Object.fromEntries(
  LINK_TYPES.map((t) => [t.id, t.label]),
);

export interface MoodboardItem {
  id: string;
  board_id: string;
  image_url: string;
  storage_path: string | null;
  caption: string | null;
  source_url: string | null;
  x: number;
  y: number;
  width: number;
  z: number;
  added_by_name: string | null;
  created_at: string;
}

export interface MoodboardLink {
  id: string;
  item_id: string;
  product_id: string;
  link_type: LinkType;
  note: string | null;
}

export interface Moodboard {
  id: string;
  client_id: string;
  title: string;
}

/** Default size for a newly dropped image, in board units. */
export const DEFAULT_WIDTH = 260;

/**
 * Where to put an image that was added without a drop position — a file
 * picker rather than a drag. Lays them out in a loose grid to the right
 * of everything already placed, so a bulk upload doesn't stack into one
 * pile the client then has to unpick.
 */
export function nextSlot(existing: Array<{ x: number; y: number }>, index: number): { x: number; y: number } {
  const COLS = 4;
  const GAP = 300;
  if (existing.length === 0) {
    return { x: (index % COLS) * GAP, y: Math.floor(index / COLS) * GAP };
  }
  const maxX = Math.max(...existing.map((e) => e.x));
  const minY = Math.min(...existing.map((e) => e.y));
  return { x: maxX + GAP + (index % COLS) * GAP, y: minY + Math.floor(index / COLS) * GAP };
}

/** Keeps a newly clicked item on top without renumbering the whole board. */
export function topZ(items: Array<{ z: number }>): number {
  return items.reduce((max, i) => Math.max(max, i.z), 0) + 1;
}
