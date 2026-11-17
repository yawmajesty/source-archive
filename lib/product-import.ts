// ─────────────────────────────────────────────────────────────
// Reading a collection out of a spreadsheet.
//
// Every factory and every client sends a different sheet. The columns
// are never in the same order, the headings are English or Chinese or
// both, and "MOQ" turns up as "MOQ", "Min order", "最小起订量" and
// "minimum qty" in four files from the same week. So the import matches
// headings against a vocabulary rather than expecting a fixed layout,
// and whatever it works out is shown for correction before anything is
// written — a mapping that is right nine times out of ten and silent the
// tenth is worse than one that asks.
//
// The vocabulary deliberately includes the headings of the RFQ sheet
// this app sends out (lib/rfq-sheet.ts), so a sheet that comes back from
// a factory with its prices filled in imports without being touched.
//
// Pure helpers — no "use server" here, so the constants survive into the
// browser bundle that does the parsing.
// ─────────────────────────────────────────────────────────────

export type FieldKind = "text" | "number" | "integer" | "list";

export interface ImportField {
  key: string;
  /** What the column is called in the preview. */
  label: string;
  kind: FieldKind;
  /** The products column it ends up in. */
  column: string;
  /**
   * Everything this heading has been seen as. Matched after normalising,
   * so case, spacing and punctuation do not matter. Longer, more
   * specific aliases must come first — "sample cost" has to win over
   * "cost" on a sheet that has both.
   */
  aliases: string[];
}

/**
 * Ordered most specific first. autoMap walks this list in order, so a
 * heading that could be two things takes the earlier one.
 */
export const IMPORT_FIELDS: ImportField[] = [
  {
    key: "styleNo", label: "Style no.", kind: "text", column: "style_no",
    aliases: ["style no", "style number", "style code", "style ref", "styleno", "款号", "货号", "sku", "article no", "article number", "art no", "ref no", "reference", "item no", "item number", "item code", "item ref", "product code", "product no"],
  },
  {
    key: "name", label: "Style name", kind: "text", column: "name",
    aliases: ["style name", "product name", "item name", "garment name", "款式名称", "品名", "名称", "style", "product", "item", "garment", "description", "name"],
  },
  {
    key: "category", label: "Category", kind: "text", column: "category",
    aliases: ["category", "garment type", "product type", "类别", "品类", "种类", "type"],
  },
  {
    key: "sizeRange", label: "Sizes", kind: "text", column: "size_range",
    aliases: ["size range", "sizes", "size breakdown", "尺码", "尺寸", "码数", "size"],
  },
  {
    key: "colorways", label: "Colours", kind: "list", column: "colorways",
    aliases: ["colourways", "colorways", "colourway", "colorway", "colours", "colors", "颜色", "色号", "配色", "colour", "color"],
  },
  {
    key: "fabric", label: "Fabric", kind: "text", column: "fabric",
    aliases: ["fabric", "material", "fabrication", "面料", "材质", "布料"],
  },
  {
    key: "compositionGsm", label: "Composition & GSM", kind: "text", column: "composition_gsm",
    aliases: ["composition and gsm", "composition & gsm", "composition gsm", "成分及克重", "成分克重", "composition", "成分", "gsm", "克重", "weight"],
  },
  {
    key: "notesZh", label: "Notes (Chinese)", kind: "text", column: "notes_zh",
    aliases: ["notes chinese", "chinese notes", "notes zh", "中文备注", "中文说明"],
  },
  {
    key: "notes", label: "Notes", kind: "text", column: "notes",
    aliases: ["notes", "note", "comments", "comment", "remarks", "remark", "备注", "说明", "详情"],
  },
  {
    key: "moq", label: "MOQ", kind: "integer", column: "moq",
    aliases: ["moq", "minimum order quantity", "minimum order qty", "min order qty", "minimum order", "min order", "minimum qty", "最小起订量", "起订量"],
  },
  {
    key: "orderQty", label: "Order qty", kind: "integer", column: "order_qty",
    aliases: ["order quantity", "order qty", "quantity", "qty", "units", "pieces", "pcs", "数量", "订单数量", "订货量"],
  },
  {
    key: "leadTimeDays", label: "Lead time (days)", kind: "integer", column: "lead_time_days",
    aliases: ["lead time days", "bulk lead time", "lead time", "leadtime", "production time", "交期", "生产周期", "工期"],
  },
  {
    key: "sampleFeeUsd", label: "Sample fee", kind: "number", column: "sample_fee_usd",
    aliases: ["sample fee", "sample cost", "sample price", "sample charge", "样品费", "打样费", "sampling fee"],
  },
  {
    key: "clientUnitPriceUsd", label: "Client price", kind: "number", column: "client_unit_price_usd",
    aliases: ["client unit price", "client price", "selling price", "sell price", "retail price", "price to client", "售价", "客户价"],
  },
  {
    key: "targetCostUsd", label: "Target cost", kind: "number", column: "target_cost_usd",
    aliases: ["target cost", "target price", "target fob", "目标价", "目标成本"],
  },
  {
    key: "quotedCostUsd", label: "Quoted cost", kind: "number", column: "quoted_cost_usd",
    aliases: ["bulk fob price", "bulk fob", "quoted cost", "quoted price", "factory price", "fob price", "unit cost", "大货fob价", "大货价", "报价", "出厂价", "fob", "cost", "price"],
  },
];

export function fieldByKey(key: string): ImportField | undefined {
  return IMPORT_FIELDS.find((f) => f.key === key);
}

/**
 * Headings that hold nothing we store, checked before anything else.
 *
 * Without this, "Style image" — the second column of our own RFQ sheet —
 * contains "style" and is read as the style name, which then leaves the
 * real name column unmapped. The sheet this app sends out would not have
 * imported back.
 */
const NOT_A_FIELD = [
  "no", "s no", "sr no", "serial", "序号", "index", "row",
  "style image", "image", "images", "photo", "picture", "款式图", "图片",
  "pattern fee", "版费",
];

/**
 * Case, spacing, punctuation and the usual spreadsheet decoration all
 * removed, so "Style No." , "style_no" and "STYLE NO" are one thing.
 * Chinese is left alone beyond trimming — it has no case and no spaces.
 */
export function normaliseHeader(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\(.*?\)/g, " ")       // "Price (USD)" -> "Price"
    // "Style #" is "Style no.". Done before # is stripped, or the
    // heading collapses to "style" and reads as the name column.
    .replace(/#/g, " no ")
    .replace(/[*:：]/g, " ")
    .replace(/[_\-/\\.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The field a heading names, or null when it names none of them. */
export function matchHeader(raw: unknown): string | null {
  const h = normaliseHeader(raw);
  if (!h) return null;
  if (NOT_A_FIELD.some((n) => h === normaliseHeader(n))) return null;

  // Exact first, across every field, so a precise heading always wins
  // over another field's loose alias.
  for (const field of IMPORT_FIELDS) {
    for (const alias of field.aliases) {
      if (h === normaliseHeader(alias)) return field.key;
    }
  }
  // Then containment, in field order, longest alias first.
  for (const field of IMPORT_FIELDS) {
    const sorted = [...field.aliases].sort((a, b) => b.length - a.length);
    for (const alias of sorted) {
      const a = normaliseHeader(alias);
      if (a.length >= 3 && h.includes(a)) return field.key;
    }
  }
  return null;
}

/**
 * Which column of the sheet feeds which field.
 *
 * Returns one entry per column, so the preview can show every column
 * including the ones it could not place. A field is only taken once: if
 * two columns both look like "Notes", the first keeps it and the second
 * is left unmapped for a person to decide.
 */
export function autoMap(headers: unknown[]): Array<string | null> {
  const taken = new Set<string>();
  return headers.map((h) => {
    const key = matchHeader(h);
    if (!key || taken.has(key)) return null;
    taken.add(key);
    return key;
  });
}

// ── Values ───────────────────────────────────────────────────

/** Strips currency symbols, thousands separators and stray text. */
export function coerceNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  // ExcelJS hands back objects for formulas and rich text.
  if (typeof value === "object") {
    const v = value as { result?: unknown; richText?: Array<{ text?: string }>; text?: unknown };
    if (v.result != null) return coerceNumber(v.result);
    if (Array.isArray(v.richText)) return coerceNumber(v.richText.map((t) => t.text ?? "").join(""));
    if (v.text != null) return coerceNumber(v.text);
    return null;
  }
  // Sheets arrive written both ways: "1,234.56" and "1.234,56". Whichever
  // separator comes last is the decimal one; a lone comma is only a
  // decimal point when exactly two digits follow it at the end. Guessing
  // wrong turns 1.234,56 into 123456, so this is worth the care.
  let text = String(value).replace(/[^\d.,\-]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    text = lastComma > lastDot
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = /,\d{2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  }
  const cleaned = text.replace(/[^\d.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function coerceText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const v = value as { result?: unknown; richText?: Array<{ text?: string }>; text?: unknown; hyperlink?: string };
    if (Array.isArray(v.richText)) return coerceText(v.richText.map((t) => t.text ?? "").join(""));
    if (v.text != null) return coerceText(v.text);
    if (v.result != null) return coerceText(v.result);
    return null;
  }
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** "Black, White / Navy" and "黑、白" all become three colours. */
export function coerceList(value: unknown): string[] {
  const text = coerceText(value);
  if (!text) return [];
  return text
    .split(/[,/、;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface ImportedProduct {
  name: string;
  styleNo: string | null;
  category: string | null;
  sizeRange: string | null;
  colorways: string[];
  fabric: string | null;
  compositionGsm: string | null;
  notes: string | null;
  notesZh: string | null;
  moq: number | null;
  orderQty: number | null;
  leadTimeDays: number | null;
  sampleFeeUsd: number | null;
  clientUnitPriceUsd: number | null;
  targetCostUsd: number | null;
  quotedCostUsd: number | null;
}

export const EMPTY_PRODUCT: ImportedProduct = {
  name: "", styleNo: null, category: null, sizeRange: null, colorways: [],
  fabric: null, compositionGsm: null, notes: null, notesZh: null,
  moq: null, orderQty: null, leadTimeDays: null,
  sampleFeeUsd: null, clientUnitPriceUsd: null, targetCostUsd: null, quotedCostUsd: null,
};

/** One sheet row, through the mapping, into something insertable. */
export function buildProduct(mapping: Array<string | null>, cells: unknown[]): ImportedProduct {
  const out: ImportedProduct = { ...EMPTY_PRODUCT, colorways: [] };
  mapping.forEach((key, i) => {
    if (!key) return;
    const field = fieldByKey(key);
    if (!field) return;
    const raw = cells[i];
    switch (field.kind) {
      case "number": {
        const n = coerceNumber(raw);
        if (n != null) (out as unknown as Record<string, unknown>)[key] = n;
        break;
      }
      case "integer": {
        const n = coerceNumber(raw);
        if (n != null) (out as unknown as Record<string, unknown>)[key] = Math.round(n);
        break;
      }
      case "list":
        out.colorways = coerceList(raw);
        break;
      default: {
        const t = coerceText(raw);
        if (t != null) (out as unknown as Record<string, unknown>)[key] = t;
      }
    }
  });
  out.name = out.name ?? "";
  return out;
}

/** A row with nothing in it at all — trailing blanks are everywhere. */
export function isBlankRow(cells: unknown[]): boolean {
  return cells.every((c) => coerceText(c) == null);
}

/**
 * Where the headings are.
 *
 * Sheets rarely start at A1: there is a title, a logo, a blank row. The
 * header is the first row within the first fifteen that names at least
 * two fields we recognise — one is too easy to hit by accident on a
 * title row.
 */
export function findHeaderRow(rows: unknown[][]): number {
  let best = -1;
  let bestScore = 1;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const score = new Set(rows[i].map(matchHeader).filter(Boolean) as string[]).size;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/** A style name is a name. A paragraph in that column is a note. */
export const MAX_NAME_LENGTH = 120;

/**
 * Names that mean the row is a summary rather than a style. Checked
 * whole, so a garment called "Total Eclipse Tee" is not caught.
 */
const SUMMARY_NAMES = new Set([
  "total", "totals", "subtotal", "sub total", "sum", "grand total", "average",
  "合计", "总计", "小计", "总额", "共计",
]);

export function isSummaryName(name: string): boolean {
  return SUMMARY_NAMES.has(name.trim().toLowerCase().replace(/[:：]/g, ""));
}

/** Two or more recognised headings means this row is labels, not data. */
export function looksLikeHeaderRow(cells: unknown[]): boolean {
  return new Set(cells.map(matchHeader).filter(Boolean) as string[]).size >= 2;
}

/**
 * A merged banner read back as data.
 *
 * ExcelJS repeats a merged cell's value across every column it spans, so
 * the footer note on our own RFQ sheet arrives as a row saying the same
 * sentence twelve times. Left in, it imports as a style named after the
 * payment terms.
 */
export function isRepeatedRow(cells: unknown[]): boolean {
  const values = cells.map(coerceText).filter((v): v is string => v != null);
  if (values.length < 3) return false;
  return new Set(values).size === 1;
}

/**
 * Every style in the sheet, with the rows that are not styles left out.
 *
 * The skipping is the whole job. A real sheet has a title block, often
 * two header rows because it is bilingual, and a note or a total at the
 * bottom — and each of those becomes a product with a silly name if it
 * is simply read as data.
 */
export function skipReason(
  mapping: Array<string | null>,
  cells: unknown[],
  opts?: { allowHeaderLike?: boolean },
): string | null {
  if (isBlankRow(cells)) return "empty row";
  if (isRepeatedRow(cells)) return "a merged note, not a style";
  if (!opts?.allowHeaderLike && looksLikeHeaderRow(cells)) return "another row of headings";

  const product = buildProduct(mapping, cells);
  if (!product.name.trim()) return "no style name";
  if (product.name.length > MAX_NAME_LENGTH) return "that is a paragraph, not a name";
  if (isSummaryName(product.name)) return "a totals row";
  return null;
}

export function extractProducts(
  grid: unknown[][],
  headerRow: number,
  mapping: Array<string | null>,
): ImportedProduct[] {
  const out: ImportedProduct[] = [];
  // The second header row of a bilingual sheet sits directly under the
  // first; once real data has been read, a row that merely looks like
  // headings is shown rather than silently dropped.
  let started = false;

  for (let i = headerRow + 1; i < grid.length; i++) {
    const cells = grid[i];
    if (skipReason(mapping, cells, { allowHeaderLike: started }) != null) continue;
    started = true;
    out.push(buildProduct(mapping, cells));
  }
  return out;
}

export interface RowProblem {
  row: number;
  message: string;
}

/** Only one thing is actually required: something to call the style. */
export function validateProducts(products: ImportedProduct[]): RowProblem[] {
  const problems: RowProblem[] = [];
  const seen = new Map<string, number>();
  products.forEach((p, i) => {
    if (!p.name.trim()) {
      problems.push({ row: i, message: "No style name — this row will be skipped" });
      return;
    }
    const key = (p.styleNo ?? p.name).trim().toLowerCase();
    const first = seen.get(key);
    if (first != null) {
      problems.push({ row: i, message: `Same style as row ${first + 1} in this sheet` });
    } else {
      seen.set(key, i);
    }
  });
  return problems;
}
