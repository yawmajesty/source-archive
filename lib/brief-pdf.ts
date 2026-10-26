import type { BriefProduct } from "./mock-data";
import {
  imageToDataUrl, detectImageFormat, fitWithin,
  PAGE_H, MARGIN, CONTENT_W,
} from "./invoice-pdf";
import {
  renderAttachments, isDisplayableImage, toJpeg,
  MAX_PAGES_PER_DOC, MAX_APPENDIX_PAGES,
  type Attachment, type AttachmentSource,
} from "./attachment-images";
import { layoutMoodboard } from "./moodboard-layout";
import { imageUrl } from "./image-url";

// ─────────────────────────────────────────────────────────────
// A brief as a document you can hand to somebody.
//
// The brief alert email already carries everything, but an email is not
// something a pattern cutter opens on a factory floor, and forwarding it
// drags our own subject line and footer along with it.
//
// Built the way it gets read: who the brand is first, because the work only
// makes sense once you know who it is for, then one block per product with
// its references, because that is the unit somebody is quoting or cutting.
// Each product starts on a page of its own when it will not fit — a
// specification split across a page break is how a detail gets missed.
// ─────────────────────────────────────────────────────────────

const INK = [29, 29, 31] as const;
const MUTED = [110, 110, 115] as const;
const RULE = [223, 223, 226] as const;

export interface BriefForPdf {
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  industry: string | null;
  brandStage: string | null;
  manufacturedBefore: boolean | null;
  howFoundUs: string | null;
  budget: string | null;
  timeline: string | null;
  message: string | null;
  moodboardLinks: string | null;
  sustainability: string | null;
  submittedAt: string | null;
  revisedAt: string | null;
  briefFiles: string[];
  products: BriefProduct[];
}

/** How tall a row of references wants to be, and how tall it may become. */
const ROW_TARGET_MM = 32;
const ROW_MAX_MM = 48;
const ROW_GAP_MM = 2.5;

export interface BriefPdfOptions {
  /** Called as each attachment is fetched, so a button can say what it is doing. */
  onProgress?: (done: number, total: number, label: string) => void;
}

export async function downloadBriefPDF(
  brief: BriefForPdf,
  options: BriefPdfOptions = {},
): Promise<void> {
  // Every reference fetched as a data URL first: jsPDF cannot wait for a
  // network image, and a half-loaded one silently becomes a blank box.
  const productImages = await Promise.all(
    brief.products.map((p) =>
      Promise.all(
        // Images only. Briefs put PDFs in this field too, and asking the
        // image transform for one returns 400 — which is why two references
        // on this brief were silently rendering as nothing. The PDFs are
        // not lost: they go to the appendix and are rendered there.
        (p.moodboard_files ?? []).filter(isDisplayableImage).slice(0, 6).map(async (u) => {
          const fetched = await imageToDataUrl(
            // 800px: about 420dpi at the 48mm a row can reach, and still
            // acceptable if one panoramic image spans the full width. Asking
            // for the original would mean a megabyte per reference.
            imageUrl(u, 400, { height: 400, resize: "contain", quality: 82 }),
          );
          if (!fetched) return null;
          // Re-encoded to JPEG for the same reason the appendix is: jsPDF
          // stores a PNG by decoding it to a bitmap and deflating, which on
          // one brief turned 4.6MB of pictures into a 30MB file.
          // Measured here so the page can keep each photograph's own shape.
          return await toJpeg(fetched, 800);
        }),
      ),
    ),
  );

  // Attachments are turned into pages before jsPDF is even loaded: they are
  // the slow part — one lookbook in storage is 26MB — and a half-fetched
  // appendix would produce a document with blank pages in it.
  const sources: AttachmentSource[] = [
    ...brief.briefFiles.map((url) => ({ url })),
    // A product's own references belong here too: at 32mm in the product
    // block they are a reminder of what was meant, not something anybody
    // can work from, and any PDFs among them have nowhere else to appear.
    ...brief.products.flatMap((product, index) =>
      (product.moodboard_files ?? []).map((url) => ({
        url,
        context: `${index + 1}. ${product.name || "Unnamed product"}`,
      })),
    ),
  ];

  const { attachments, truncated } = sources.length
    ? await renderAttachments(sources, { onProgress: options.onProgress })
    : { attachments: [] as Attachment[], truncated: false };

  const jspdfModule: Record<string, unknown> = await import("jspdf");
  const ctor =
    (jspdfModule.jsPDF as unknown) ??
    ((jspdfModule.default as Record<string, unknown>)?.jsPDF as unknown) ??
    (jspdfModule.default as unknown);
  if (typeof ctor !== "function") {
    throw new Error("jsPDF could not be loaded. Re-run npm install and try again.");
  }

  type Doc = {
    setFont: (f: string, s?: string) => void;
    setFontSize: (n: number) => void;
    setTextColor: (r: number, g: number, b: number) => void;
    setDrawColor: (r: number, g: number, b: number) => void;
    setFillColor: (r: number, g: number, b: number) => void;
    text: (t: string | string[], x: number, y: number) => void;
    line: (a: number, b: number, c: number, d: number) => void;
    rect: (x: number, y: number, w: number, h: number, style?: string) => void;
    addImage: (d: string, f: string, x: number, y: number, w: number, h: number) => void;
    addPage: (format?: string, orientation?: "portrait" | "landscape") => void;
    internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    splitTextToSize: (t: string, w: number) => string[];
    getNumberOfPages: () => number;
    setPage: (n: number) => void;
    save: (name: string) => void;
  };
  const doc = new (ctor as new (o: unknown) => Doc)({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = MARGIN;

  const ink = () => doc.setTextColor(INK[0], INK[1], INK[2]);
  const muted = () => doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);

  /** Start a new page when the next block will not fit on this one. */
  const room = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
      return true;
    }
    return false;
  };

  const rule = () => {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 5;
  };

  const paragraph = (text: string, size = 9.5, lineHeight = 4.6) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    muted();
    for (const line of doc.splitTextToSize(text, CONTENT_W)) {
      room(lineHeight);
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  };

  /** Two columns of label/value, which is how this reads fastest. */
  const facts = (rows: Array<[string, string | null | undefined]>) => {
    const present = rows.filter(([, v]) => v && String(v).trim());
    const colW = CONTENT_W / 2;
    for (let i = 0; i < present.length; i += 2) {
      room(9);
      for (const [j, pair] of present.slice(i, i + 2).entries()) {
        const x = MARGIN + j * colW;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        muted();
        doc.text(pair[0].toUpperCase(), x, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        ink();
        doc.text(doc.splitTextToSize(String(pair[1]), colW - 6)[0] ?? "", x, y + 4.2);
      }
      y += 9.5;
    }
  };

  // ── Who the brand is ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  ink();
  doc.text(brief.companyName, MARGIN, y + 4);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  muted();
  const dated = [
    brief.submittedAt ? `Brief submitted ${fmt(brief.submittedAt)}` : null,
    brief.revisedAt ? `updated ${fmt(brief.revisedAt)}` : null,
    `${brief.products.length} product${brief.products.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join("  ·  ");
  doc.text(dated, MARGIN, y);
  y += 7;
  rule();

  facts([
    ["Contact", brief.contactName],
    ["Email", brief.contactEmail],
    ["Phone", brief.phone],
    ["Website", brief.website],
    ["Country", brief.country],
    ["Industry", brief.industry],
    ["Brand stage", brief.brandStage],
    ["Manufactured before", brief.manufacturedBefore == null ? null : brief.manufacturedBefore ? "Yes" : "No — first time"],
    ["Budget", brief.budget],
    ["Timeline", brief.timeline],
    ["Found us via", brief.howFoundUs],
  ]);

  // ── The brand in their own words ──
  if (brief.message || brief.sustainability || brief.moodboardLinks) {
    y += 2;
    rule();
    heading("In their own words");
    if (brief.message) paragraph(brief.message);
    if (brief.sustainability) {
      y += 2;
      label("Sustainability");
      paragraph(brief.sustainability);
    }
    if (brief.moodboardLinks) {
      y += 2;
      label("Moodboard");
      paragraph(brief.moodboardLinks, 8.5, 4.2);
    }
  }

  // ── One block per product ──
  brief.products.forEach((product, index) => {
    const images = (productImages[index] ?? []).filter(Boolean) as Array<{
      data: string;
      natural: { width: number; height: number } | null;
    }>;

    // A product is the unit somebody quotes from, so it does not get split
    // across a page break unless it genuinely cannot fit on one.
    const estimate = 34 + (product.description ? 18 : 0) + (images.length ? ROW_MAX_MM + 6 : 0);
    if (index === 0) { y += 4; rule(); } else { y += 3; }
    if (y + Math.min(estimate, PAGE_H - MARGIN * 2) > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    ink();
    doc.text(`${index + 1}. ${product.name || "Unnamed product"}`, MARGIN, y);
    y += 5.5;

    const spec = [
      product.category || null,
      product.target_qty != null ? `${product.target_qty.toLocaleString()} units` : null,
      product.colorways != null ? `${product.colorways} colourway${product.colorways === 1 ? "" : "s"}` : null,
      product.target_price_usd != null ? `target $${product.target_price_usd}` : null,
    ].filter(Boolean).join("  ·  ");
    if (spec) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      muted();
      doc.text(spec, MARGIN, y);
      y += 5.5;
    }

    if (product.description) paragraph(product.description);
    if (product.sustainability) { y += 1.5; label("Sustainability"); paragraph(product.sustainability, 8.5, 4.2); }
    if (product.moodboard_link) { y += 1.5; label("Moodboard"); paragraph(product.moodboard_link, 8.5, 4.2); }

    if (images.length > 0) {
      y += 2.5;

      // Laid out as a moodboard: rows of a common height and varying width,
      // each justified to the page. Nothing cropped, nothing stretched, and
      // no square frames around a tall shot — references are not uniform
      // and pretending otherwise is what made the first two versions look
      // wrong.
      const { rows } = layoutMoodboard(
        images.map((i) => (i.natural ? i.natural.width / i.natural.height : 1)),
        CONTENT_W,
        { targetHeight: ROW_TARGET_MM, maxHeight: ROW_MAX_MM, gap: ROW_GAP_MM },
      );

      for (const row of rows) {
        const rowHeight = row[0]?.h ?? 0;
        // A row is drawn whole or moved whole. Splitting one across a page
        // break leaves half a moodboard at the bottom of a page.
        room(rowHeight + 2);
        for (const cell of row) {
          const image = images[cell.index];
          try {
            doc.addImage(
              image.data,
              detectImageFormat(image.data),
              MARGIN + cell.x,
              y,
              cell.w,
              cell.h,
            );
          } catch {
            // One unreadable reference should not cost the whole document.
          }
        }
        y += rowHeight + ROW_GAP_MM;
      }
      y += 1.5;
    }

    y += 2;
    rule();
  });

  // ── Files they sent ──
  //
  // The list of names stays, because it is the only place a design file or
  // an archive can be acknowledged at all, and because it reads as a
  // contents page for the pages that follow.
  if (attachments.length > 0) {
    y += 2;
    room(16);
    heading("Files they sent");
    for (const attachment of attachments) {
      room(4.4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      muted();
      const suffix = attachment.note
        ? `  (${attachment.note})`
        : attachment.pages.length > 1
          ? `  (${attachment.pages.length} pages)`
          : "";
      const prefix = attachment.context ? `${attachment.context}  —  ` : "";
      doc.text(
        doc.splitTextToSize(`• ${prefix}${attachment.label}${suffix}`, CONTENT_W)[0] ?? "",
        MARGIN,
        y,
      );
      y += 4.4;
    }

    if (truncated) {
      y += 1;
      doc.setFontSize(7.5);
      doc.text(
        `Long documents are shown to ${MAX_PAGES_PER_DOC} pages, and the appendix to ${MAX_APPENDIX_PAGES}, to keep this file small enough to email.`,
        MARGIN,
        y,
      );
      y += 4.4;
    }
  }

  // ── The attachments themselves, one page each ──
  //
  // A page apiece rather than a grid: these are tech packs and lookbooks,
  // and the point of putting them here is that somebody can read the
  // measurements off them.
  const renderable = attachments.filter((a) => a.pages.length > 0);
  for (const attachment of renderable) {
    for (const page of attachment.pages) {
      // A landscape tech pack on a portrait sheet uses about half the paper,
      // and these are the pages somebody reads measurements off. Turning the
      // sheet instead makes the same drawing nearly twice the size.
      const wide = !!page.natural && page.natural.width > page.natural.height * 1.15;
      doc.addPage("a4", wide ? "landscape" : "portrait");
      const sheetW = doc.internal.pageSize.getWidth();
      const sheetH = doc.internal.pageSize.getHeight();
      const contentW = sheetW - MARGIN * 2;
      y = MARGIN;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      muted();
      const named = attachment.context
        ? `${attachment.context}  —  ${attachment.label}`
        : attachment.label;
      const caption = page.pageCount && page.pageCount > 1
        ? `${named}  ·  page ${page.page} of ${page.pageCount}`
        : named;
      doc.text(doc.splitTextToSize(caption, contentW)[0] ?? "", MARGIN, y);

      // The box left under the caption and above the footer.
      const top = MARGIN + 5;
      const box = { x: MARGIN, y: top, w: contentW, h: sheetH - 13 - top };

      // Never blown up past about 150dpi: a small logo stretched across A4
      // is just a blurry logo, and it reads as a fault in the export.
      const natural = page.natural;
      const capped = natural
        ? {
            ...box,
            w: Math.min(box.w, (natural.width / 150) * 25.4),
            h: Math.min(box.h, (natural.height / 150) * 25.4),
          }
        : box;
      // Keep it centred in the full box, not in the capped one.
      const fitted = fitWithin({ ...box, w: capped.w, h: capped.h }, natural);
      const placed = {
        ...fitted,
        x: box.x + (box.w - fitted.w) / 2,
        y: box.y + (box.h - fitted.h) / 2,
      };

      try {
        doc.addImage(
          page.data,
          detectImageFormat(page.data),
          placed.x,
          placed.y,
          placed.w,
          placed.h,
        );
      } catch {
        doc.setFontSize(9);
        muted();
        doc.text("This page could not be drawn.", MARGIN, top + 8);
      }
    }
  }

  // ── Page numbers, added last because the count is only known now ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    muted();
    // Appendix sheets may be landscape, so the baseline is read per page.
    doc.text(
      `${brief.companyName}  ·  brief  ·  ${i} of ${pages}`,
      MARGIN,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  doc.save(fileName(brief.companyName));

  function heading(text: string) {
    room(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    ink();
    doc.text(text, MARGIN, y);
    y += 5.5;
  }

  function label(text: string) {
    room(5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    muted();
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 4;
  }
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function fileNameOf(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return last.replace(/^\d{10,}-/, "") || "Attachment";
  } catch {
    return url.slice(0, 60);
  }
}

function fileName(company: string): string {
  const safe = company.replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "-") || "brief";
  return `Brief-${safe}.pdf`;
}
