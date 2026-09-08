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

export type BlockKind = "image" | "note" | "heading" | "list" | "swatch";

export const BLOCK_KINDS: { id: BlockKind; label: string; hint: string }[] = [
  { id: "note",    label: "Sticky note", hint: "A thought, a question, an instruction" },
  { id: "heading", label: "Heading",     hint: "Name a section of the board" },
  { id: "list",    label: "List",        hint: "Bullets, numbers or a checklist" },
  { id: "swatch",  label: "Colour",      hint: "A colour with its hex and CMYK" },
];

export type ListStyle = "bullet" | "numbered" | "checklist";

/** Sticky colours. Deliberately muted — the images are the loud part. */
export const NOTE_COLOURS = [
  { id: "yellow", label: "Yellow", bg: "#FDF3C7", fg: "#5C4700" },
  { id: "pink",   label: "Pink",   bg: "#FBE3EC", fg: "#6B2740" },
  { id: "blue",   label: "Blue",   bg: "#E2ECFB", fg: "#1E3A67" },
  { id: "green",  label: "Green",  bg: "#E3F2E4", fg: "#1F4426" },
  { id: "grey",   label: "Grey",   bg: "#ECECEE", fg: "#39393D" },
];

export interface NoteContent   { text: string; colour: string }
export interface HeadingContent { text: string; level: 1 | 2 }
export interface ListItem      { text: string; done?: boolean }
export interface ListContent   { title: string; style: ListStyle; items: ListItem[] }
export interface SwatchContent { name: string; hex: string; cmyk: { c: number; m: number; y: number; k: number } }

export type BlockContent =
  | NoteContent | HeadingContent | ListContent | SwatchContent | Record<string, never>;

export interface MoodboardItem {
  id: string;
  board_id: string;
  kind: BlockKind;
  content: BlockContent;
  height: number | null;
  image_url: string | null;
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


// ── Colour ───────────────────────────────────────────────────
//
// CMYK here is the plain arithmetic conversion, not a colour-managed
// one. A real print value depends on the paper, the press and the ICC
// profile, so this is a starting point to hand a printer, never a proof.
// It is labelled as such in the UI for the same reason.

export function hexToCmyk(hex: string): { c: number; m: number; y: number; k: number } {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { c: 0, m: 0, y: 0, k: 0 };

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const k = 1 - Math.max(r, g, b);
  // Pure black divides by zero in the general formula.
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };

  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export function cmykToHex(c: number, m: number, y: number, k: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(255 * (1 - v / 100) * (1 - k / 100))));
  const to2 = (v: number) => v.toString(16).padStart(2, "0");
  return `#${to2(f(c))}${to2(f(m))}${to2(f(y))}`.toUpperCase();
}

export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

export function normaliseHex(hex: string): string {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((ch) => ch + ch).join("") : clean;
  return `#${full.toUpperCase()}`;
}

/** Black or white text, whichever stays readable on the swatch. */
export function readableOn(hex: string): string {
  const clean = normaliseHex(hex).slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Rec. 709 luma — matches how the eye weights the channels.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? "#1D1D1F" : "#FFFFFF";
}

export function defaultContent(kind: BlockKind): BlockContent {
  switch (kind) {
    case "note":    return { text: "", colour: "yellow" };
    case "heading": return { text: "", level: 1 };
    case "list":    return { title: "", style: "bullet", items: [{ text: "" }] };
    case "swatch":  return { name: "", hex: "#C8963C", cmyk: hexToCmyk("#C8963C") };
    default:        return {};
  }
}

export const DEFAULT_SIZE: Record<BlockKind, { width: number; height: number | null }> = {
  image:   { width: 260, height: null },
  note:    { width: 220, height: 200 },
  heading: { width: 320, height: null },
  list:    { width: 260, height: null },
  swatch:  { width: 170, height: null },
};
