// ─────────────────────────────────────────────────────────────
// Receipts on a cost entry.
//
// There is no database column for these. The files themselves are the
// record: every receipt lives in the private `cost-receipts` bucket under
// `<agency id>/<cost id>/<when>-<name>`, and asking "what is attached to
// this expense?" is a storage listing, not a join.
//
// That is a deliberate trade. A `receipts jsonb` column would have meant a
// migration — and a migration means a person pasting SQL into a dashboard
// before the feature works at all. This way the thing works the moment it
// deploys, and the file and its record can never disagree, because they are
// the same object.
//
// The cost: a listing per entry when you open one, and a single listing of
// the agency's folder to know which rows have anything at all. Both are one
// round trip, which is cheaper than it sounds.
//
// Pure helpers only, shared by the browser and the server. Deliberately NOT
// a "use server" file — a const or a sync function exported from one of
// those is dropped from the client bundle and arrives as undefined.
// ─────────────────────────────────────────────────────────────

export interface CostReceipt {
  /** Full storage key, agency-prefixed. The identity of the file. */
  path: string;
  /** What a person sees: the filename as uploaded. */
  name: string;
  size: number;
  mimeType: string;
  /**
   * Signed and time-limited, because the bucket is private — a receipt
   * carries a supplier, an amount and sometimes a card number, so it is not
   * something to leave on a guessable public URL. Short-lived by design:
   * fetch a fresh one rather than storing this anywhere.
   */
  url: string;
  uploadedAt: string;
}

/** Eight is already more than any shipping invoice needs. */
export const MAX_RECEIPTS_PER_COST = 8;

/** What the file picker offers. HEIC is here because iPhones produce it. */
export const RECEIPT_ACCEPT = "image/*,.heic,.heif,application/pdf,.pdf";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp|tiff?)$/i;
const PDF_EXT = /\.pdf$/i;

/**
 * A receipt is a picture of a thing you paid for, or a PDF of one. Anything
 * else belongs on the product or in the project files, so it is turned away
 * here rather than quietly accepted and never shown.
 */
export function isAllowedReceipt(file: { name: string; type: string }): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  // Some browsers hand over an empty type for HEIC and for files dragged in
  // from certain apps, so the extension gets the last word.
  if (!file.type) return IMAGE_EXT.test(file.name) || PDF_EXT.test(file.name);
  return false;
}

export function receiptKind(receipt: { mimeType: string; name: string }): "image" | "pdf" {
  if (receipt.mimeType === "application/pdf" || PDF_EXT.test(receipt.name)) return "pdf";
  return "image";
}

/**
 * The storage key for a new receipt, relative to the agency folder — the
 * agency prefix is added server-side, where the agency is known for certain.
 *
 * The timestamp is what stops two receipts called `IMG_0042.jpg` from
 * overwriting one another, and it is stripped again for display.
 */
export function receiptKey(costId: string, fileName: string): string {
  return `${costId}/${Date.now()}-${fileName}`;
}

/** `…/1763040000000-DHL-invoice.pdf` → `DHL-invoice.pdf` */
export function receiptName(key: string): string {
  const base = (key.split("/").pop() ?? key).replace(/^\d{10,16}-/, "");
  // Storage keys can only carry ASCII, so a filename written entirely in
  // Chinese — which is most of what comes back from a Guangzhou supplier —
  // sanitizes down to nothing but its extension. A file called ".pdf" is
  // worse than one called "Receipt.pdf".
  if (!base || base.startsWith(".")) return `Receipt${base}`;
  return base;
}

export function formatReceiptSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
