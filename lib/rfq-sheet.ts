import ExcelJS from "exceljs";
import { imageUrl } from "@/lib/image-url";

// ─────────────────────────────────────────────────────────────
// The RFQ sheet a factory fills in and sends back.
//
// Written to be used, not admired. A factory opens this in WPS as often as
// Excel, so it stays inside the subset both agree on: no tables, no
// conditional formatting, no protection, plain data validation for the two
// dropdowns. Nothing is locked, because the whole point is that they type
// in it and return it.
//
// Headers are two rows — Chinese above English — because that is how these
// get read on a factory floor, and a single row of either language slows
// somebody down.
//
// The three money columns are left empty and shaded, with the instruction
// written where it cannot be missed. An RFQ that arrives with prices
// already in it gets those prices confirmed rather than quoted.
// ─────────────────────────────────────────────────────────────

/** When the sample clock starts. The factory picks one. */
export const SAMPLE_TRIGGERS = [
  "All info received / 资料齐全",
  "Pattern fee received / 版费到账",
  "Fabric confirmed / 面料确认",
] as const;

/** When the bulk clock starts. */
export const BULK_TRIGGERS = [
  "PP sample approval / 产前样确认",
  "Fabric & trims in factory / 面料辅料进厂",
  "Deposit received / 定金到账",
] as const;

export interface RfqStyle {
  styleName: string;
  styleNo: string | null;
  size: string | null;
  colour: string | null;
  fabric: string | null;
  compositionGsm: string | null;
  notesEn: string | null;
  notesZh: string | null;
  imageUrl: string | null;
}

export interface RfqHeader {
  clientName: string;
  projectName: string;
  rfqNo: string;
  version: number;
  enquiryDate: string | null;
  validUntil: string | null;
  sampleLeadTimeDays: number | null;
  sampleTrigger: string | null;
  bulkLeadTimeDays: number | null;
  bulkTrigger: string | null;
}

const INK = "FF1D1D1F";
const RULE = "FFD9D9D9";
const BAND = "FFF1F1F1";
/** Light yellow. Reads as "yours to fill" in both Excel and WPS defaults. */
const FACTORY_FILL = "FFFFF6CC";

/** Chinese label above, English below — one entry per column. */
const COLUMNS: Array<{ zh: string; en: string; width: number; key: string }> = [
  { zh: "序号",        en: "No.",                 width: 6,  key: "no" },
  { zh: "款式图",      en: "Style image",         width: 18, key: "image" },
  { zh: "款式名称",    en: "Style name",          width: 26, key: "styleName" },
  { zh: "款号",        en: "Style no.",           width: 16, key: "styleNo" },
  { zh: "尺码",        en: "Size",                width: 16, key: "size" },
  { zh: "颜色",        en: "Colour",              width: 18, key: "colour" },
  { zh: "面料",        en: "Fabric",              width: 22, key: "fabric" },
  { zh: "成分及克重",  en: "Composition & GSM",   width: 24, key: "composition" },
  { zh: "备注",        en: "Notes",               width: 34, key: "notes" },
  { zh: "版费",        en: "Pattern fee",         width: 16, key: "patternFee" },
  { zh: "样品费",      en: "Sample cost",         width: 20, key: "sampleCost" },
  { zh: "大货FOB价",   en: "Bulk FOB price",      width: 20, key: "bulkFob" },
];

/** The three the factory completes, 1-indexed to match ExcelJS. */
const FIRST_FACTORY_COL = 10;
const LAST_FACTORY_COL = 12;

const thin = { style: "thin" as const, color: { argb: RULE } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

function labelRow(
  ws: ExcelJS.Worksheet,
  rowIndex: number,
  pairs: Array<[string, string]>,
): void {
  const row = ws.getRow(rowIndex);
  let col = 1;
  for (const [label, value] of pairs) {
    const labelCell = row.getCell(col);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10, color: { argb: INK } };
    labelCell.alignment = { vertical: "middle" };

    const valueCell = row.getCell(col + 1);
    valueCell.value = value;
    valueCell.font = { size: 10, color: { argb: INK } };
    valueCell.alignment = { vertical: "middle" };
    // Two columns of room for the value, so long project names stay legible.
    ws.mergeCells(rowIndex, col + 1, rowIndex, col + 2);
    col += 4;
  }
  row.height = 18;
}

/** Pixel dimensions, read from the file's own header. */
function dimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length > 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] === 0xff && [0xc0, 0xc1, 0xc2].includes(buf[i + 1])) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 1;
    }
  }
  return null;
}

async function fetchImage(
  url: string,
): Promise<{ buffer: Buffer; extension: "png" | "jpeg"; width: number; height: number } | null> {
  try {
    // The resized copy, not the original: a sheet with eight full-size
    // phone photographs in it is a sheet nobody can email.
    // Both axes bounded: width alone leaves a tall photograph tall, and one
    // measured here was 240x1802 and 693KB for a cell 108px wide.
    const sized = imageUrl(url, 110, { height: 70, resize: "contain", quality: 76 });
    const res = await fetch(sized, {
      headers: { Accept: "image/png,image/jpeg" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    // Supabase negotiates WebP, which Excel will not display, so ask again
    // for something it understands.
    if (/webp|avif/i.test(type)) {
      const fallback = await fetch(sized, {
        headers: { Accept: "image/png" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!fallback.ok) return null;
      const fb = Buffer.from(await fallback.arrayBuffer());
      const fbType = fallback.headers.get("content-type") ?? "";
      if (/webp|avif/i.test(fbType)) return null;
      const fbSize = dimensions(fb) ?? { width: 108, height: 68 };
      return { buffer: fb, extension: /png/i.test(fbType) ? "png" : "jpeg", ...fbSize };
    }
    const size = dimensions(buffer) ?? { width: 108, height: 68 };
    return { buffer, extension: /png/i.test(type) ? "png" : "jpeg", ...size };
  } catch {
    return null;
  }
}

export async function buildRfqWorkbook(
  header: RfqHeader,
  styles: RfqStyle[],
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Source Archive";
  wb.created = new Date();

  const ws = wb.addWorksheet("RFQ", {
    views: [{ state: "frozen", ySplit: 10 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = COLUMNS.map((c) => ({ key: c.key, width: c.width }));

  // ── Title ──
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const titleZh = ws.getCell(1, 1);
  titleZh.value = "报价请求单";
  titleZh.font = { bold: true, size: 15, color: { argb: INK } };
  titleZh.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const titleEn = ws.getCell(2, 1);
  titleEn.value = "Request for Quotation";
  titleEn.font = { size: 11, color: { argb: "FF6E6E73" } };
  titleEn.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 16;

  // ── Who, what, when ──
  labelRow(ws, 3, [
    ["客户 / Client", header.clientName],
    ["项目 / Project", header.projectName],
    ["款数 / Styles", String(styles.length)],
  ]);
  labelRow(ws, 4, [
    ["RFQ 编号 / RFQ No.", header.rfqNo],
    ["版本 / Version", `v${header.version}`],
    ["", ""],
  ]);
  labelRow(ws, 5, [
    ["询价日期 / Enquiry date", header.enquiryDate ?? ""],
    ["报价有效期至 / Quote valid until", header.validUntil ?? ""],
    ["", ""],
  ]);

  // ── Lead times, each with the point it is counted from ──
  for (const [rowIndex, label, days, trigger, options] of [
    [6, "样品交期 / Sample lead time", header.sampleLeadTimeDays, header.sampleTrigger, SAMPLE_TRIGGERS],
    [7, "大货交期 / Bulk lead time", header.bulkLeadTimeDays, header.bulkTrigger, BULK_TRIGGERS],
  ] as Array<[number, string, number | null, string | null, readonly string[]]>) {
    const row = ws.getRow(rowIndex);
    row.height = 18;

    const labelCell = row.getCell(1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10, color: { argb: INK } };
    ws.mergeCells(rowIndex, 1, rowIndex, 2);

    const daysCell = row.getCell(3);
    daysCell.value = days ?? null;
    daysCell.numFmt = "0";
    daysCell.border = BORDER;
    daysCell.alignment = { horizontal: "center" };

    const unit = row.getCell(4);
    unit.value = "天 / days";
    unit.font = { size: 9, color: { argb: "FF6E6E73" } };

    const fromLabel = row.getCell(5);
    fromLabel.value = "起算点 / Counted from";
    fromLabel.font = { bold: true, size: 10, color: { argb: INK } };
    ws.mergeCells(rowIndex, 5, rowIndex, 6);

    const triggerCell = row.getCell(7);
    triggerCell.value = trigger ?? options[0];
    triggerCell.border = BORDER;
    ws.mergeCells(rowIndex, 7, rowIndex, 9);
    // A list the factory can change, because which point it is counted from
    // is part of what they are quoting.
    triggerCell.dataValidation = {
      type: "list",
      allowBlank: false,
      // Quoted and comma-joined is the inline form both Excel and WPS read.
      formulae: [`"${options.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Pick one",
      error: "Choose one of the listed trigger points.",
    };
  }

  // ── The instruction, over the three columns it refers to ──
  ws.mergeCells(8, FIRST_FACTORY_COL, 8, LAST_FACTORY_COL);
  const instruction = ws.getCell(8, FIRST_FACTORY_COL);
  instruction.value = "请工厂填写 / To be filled by factory";
  instruction.font = { bold: true, size: 10, color: { argb: "FF8A6D00" } };
  instruction.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  instruction.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FACTORY_FILL } };
  instruction.border = BORDER;
  ws.getRow(8).height = 18;

  // ── Column headers, Chinese then English ──
  const zhRow = ws.getRow(9);
  const enRow = ws.getRow(10);
  zhRow.height = 20;
  enRow.height = 18;

  COLUMNS.forEach((col, i) => {
    const n = i + 1;
    const factory = n >= FIRST_FACTORY_COL;

    const zh = zhRow.getCell(n);
    zh.value = col.zh;
    zh.font = { bold: true, size: 11, color: { argb: INK } };
    zh.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    zh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: factory ? FACTORY_FILL : BAND } };
    zh.border = BORDER;

    const en = enRow.getCell(n);
    en.value = col.en;
    en.font = { size: 9.5, color: { argb: "FF6E6E73" } };
    en.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    en.fill = { type: "pattern", pattern: "solid", fgColor: { argb: factory ? FACTORY_FILL : BAND } };
    en.border = BORDER;
  });

  // ── One row per style ──
  const FIRST_DATA_ROW = 11;
  const IMAGE_ROW_HEIGHT = 78;

  const images = await Promise.all(
    styles.map((s) => (s.imageUrl ? fetchImage(s.imageUrl) : Promise.resolve(null))),
  );

  styles.forEach((style, i) => {
    const rowIndex = FIRST_DATA_ROW + i;
    const row = ws.getRow(rowIndex);
    row.height = IMAGE_ROW_HEIGHT;

    const notes = [style.notesZh?.trim(), style.notesEn?.trim()].filter(Boolean).join("\n");

    const values: Array<string | number | null> = [
      i + 1,
      null, // the image sits over this cell
      style.styleName,
      style.styleNo ?? "",
      style.size ?? "",
      style.colour ?? "",
      style.fabric ?? "",
      style.compositionGsm ?? "",
      notes,
      null, // pattern fee
      null, // sample cost
      null, // bulk FOB
    ];

    values.forEach((value, c) => {
      const n = c + 1;
      const cell = row.getCell(n);
      if (value !== null) cell.value = value;
      cell.border = BORDER;
      cell.alignment = {
        vertical: "middle",
        horizontal: n === 1 ? "center" : "left",
        wrapText: true,
      };
      cell.font = { size: 10, color: { argb: INK } };

      if (n >= FIRST_FACTORY_COL) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FACTORY_FILL } };
        // A number format rather than a currency symbol: we are asking for a
        // figure, and which currency is the factory's to state.
        cell.numFmt = "#,##0.00";
      }
    });

    const fetched = images[i];
    if (fetched) {
      const imageId = wb.addImage({ buffer: fetched.buffer as unknown as ExcelJS.Buffer, extension: fetched.extension });
      // Scaled to fit the box rather than filling it, so a tall garment shot
      // arrives the shape it was photographed.
      const boxW = 104;
      const boxH = IMAGE_ROW_HEIGHT - 12;
      const scale = Math.min(boxW / fetched.width, boxH / fetched.height, 1);
      const drawW = Math.max(1, Math.round(fetched.width * scale));
      const drawH = Math.max(1, Math.round(fetched.height * scale));
      ws.addImage(imageId, {
        tl: { col: 1.08, row: rowIndex - 1 + 0.08 },
        ext: { width: drawW, height: drawH },
        editAs: "oneCell",
      });
    }
  });

  // ── A closing note, so the terms are on the sheet and not only in email ──
  const noteRow = FIRST_DATA_ROW + styles.length + 1;
  ws.mergeCells(noteRow, 1, noteRow, COLUMNS.length);
  const note = ws.getCell(noteRow, 1);
  note.value =
    "样品费不含版费，含全部面料及辅料。大货价格为全包 FOB 价。/ " +
    "Sample cost excludes the pattern fee and includes all fabric and trims. Bulk price is all-in FOB.";
  note.font = { size: 9.5, italic: true, color: { argb: "FF6E6E73" } };
  note.alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(noteRow).height = 26;

  return wb;
}

/** What the generated file is called. */
export function rfqFileName(header: RfqHeader): string {
  const safe = (s: string) => s.replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "-");
  return `RFQ-${safe(header.rfqNo)}-v${header.version}-${safe(header.clientName)}.xlsx`;
}
