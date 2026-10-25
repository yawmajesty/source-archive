import type { BriefProduct } from "./mock-data";
import {
  imageToDataUrl, detectImageFormat, imageDimensions, fitWithin,
  PAGE_H, MARGIN, CONTENT_W,
} from "./invoice-pdf";
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

/** 110 CSS px of image is about 29mm on the page; ask for twice that. */
const IMAGE_BOX_MM = 38;

export async function downloadBriefPDF(brief: BriefForPdf): Promise<void> {
  // Every reference fetched as a data URL first: jsPDF cannot wait for a
  // network image, and a half-loaded one silently becomes a blank box.
  const productImages = await Promise.all(
    brief.products.map((p) =>
      Promise.all(
        (p.moodboard_files ?? []).slice(0, 6).map(async (u) => {
          const data = await imageToDataUrl(
            imageUrl(u, 150, { height: 150, resize: "contain", quality: 82 }),
          );
          if (!data) return null;
          // Measured here so the page can keep each photograph's own shape.
          return { data, natural: await imageDimensions(data) };
        }),
      ),
    ),
  );

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
    addPage: () => void;
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
    const estimate = 34 + (product.description ? 18 : 0) + (images.length ? IMAGE_BOX_MM + 6 : 0);
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
      room(IMAGE_BOX_MM + 4);
      let x = MARGIN;
      for (const image of images) {
        if (x + IMAGE_BOX_MM > MARGIN + CONTENT_W) {
          y += IMAGE_BOX_MM + 3;
          room(IMAGE_BOX_MM + 4);
          x = MARGIN;
        }
        // The frame stays square so the grid lines up; the photograph is
        // fitted inside it at its own aspect ratio and centred. Forcing it
        // to the frame is what squashed every tall shot.
        const fitted = fitWithin(
          { x: x + 0.6, y: y + 0.6, w: IMAGE_BOX_MM - 1.2, h: IMAGE_BOX_MM - 1.2 },
          image.natural,
        );
        doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
        doc.rect(x, y, IMAGE_BOX_MM, IMAGE_BOX_MM);
        try {
          doc.addImage(image.data, detectImageFormat(image.data), fitted.x, fitted.y, fitted.w, fitted.h);
        } catch {
          // One unreadable reference should not cost the whole document.
        }
        x += IMAGE_BOX_MM + 3;
      }
      y += IMAGE_BOX_MM + 4;
    }

    y += 2;
    rule();
  });

  // ── Files they sent, as a list of names ──
  if (brief.briefFiles.length > 0) {
    room(14);
    heading("Files they sent");
    for (const url of brief.briefFiles) {
      room(4.4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      muted();
      doc.text(`• ${fileNameOf(url)}`, MARGIN, y);
      y += 4.4;
    }
  }

  // ── Page numbers, added last because the count is only known now ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    muted();
    doc.text(`${brief.companyName}  ·  brief  ·  ${i} of ${pages}`, MARGIN, PAGE_H - 8);
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
