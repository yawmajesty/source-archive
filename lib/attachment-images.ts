import { imageToDataUrl, imageDimensions } from "./invoice-pdf";
import { imageUrl } from "./image-url";

// ─────────────────────────────────────────────────────────────
// Attachments, as pictures.
//
// The brief PDF used to end with a list of filenames, which is no use to
// anybody: the whole reason to export a brief is to hand it to a pattern
// cutter or a factory, and "NAKd_Authority_Lookbook.pdf" on a sheet of
// paper tells them nothing. So every attachment is rendered into the
// document itself.
//
// Photographs are straightforward. PDFs — nine of the sixty-eight files
// clients have sent, and the ones that matter most, because they are the
// tech packs and the lookbooks — are rasterised a page at a time through
// pdf.js. There is no way to embed one PDF inside another with jsPDF, and
// a tech pack nobody can see may as well not be attached.
//
// Everything is capped. One lookbook in storage is 26MB and another brief
// carries ten attachments; rendering all of it at full resolution would
// produce a file too big to email, which defeats the point. The caps are
// stated in the document rather than applied silently.
// ─────────────────────────────────────────────────────────────

/**
 * Rasterised at about 170dpi across an A4 content width.
 *
 * These numbers are a file-size budget, not a quality preference. The first
 * build of this used 1400px at quality 0.78 and turned one brief into a
 * 15.6MB PDF — past what most mail servers will carry, which defeats the
 * point of an export you forward to a factory. At 1200px and 0.74 a tech
 * pack is still legible at full-page size.
 */
const RASTER_PX = 1200;

/**
 * Wide pages are rasterised larger, because they are laid on a turned
 * sheet whose content area is 267mm rather than 180mm. At 1200px such a
 * page would only be allowed to reach 203mm before it broke the 150dpi
 * ceiling, leaving a quarter of the paper empty — and tech packs, the
 * documents this matters most for, are nearly always landscape.
 */
const RASTER_PX_WIDE = 1600;
const JPEG_QUALITY = 0.74;

/** Per document, and across the whole appendix. */
export const MAX_PAGES_PER_DOC = 10;
export const MAX_APPENDIX_PAGES = 28;

export interface AttachmentPage {
  data: string;
  natural: { width: number; height: number } | null;
  /** 1-based, and only set when the source document had several pages. */
  page?: number;
  pageCount?: number;
}

export interface AttachmentSource {
  url: string;
  /** Shown before the filename, e.g. the product the file belongs to. */
  context?: string;
}

export interface Attachment {
  label: string;
  context?: string;
  kind: "image" | "document" | "unreadable";
  pages: AttachmentPage[];
  /** Why this one is short or missing, in words meant for the reader. */
  note?: string;
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;
const PDF_RE = /\.pdf(\?|$)/i;

/**
 * Whether this URL can be drawn as a picture directly.
 *
 * Worth checking before building a thumbnail: briefs carry PDFs in the same
 * field as photographs, and Supabase's image transform answers a PDF with
 * 400 "The source image is invalid or unsupported for rendering". The
 * product reference grid was requesting those and quietly rendering a gap.
 */
export function isDisplayableImage(url: string): boolean {
  return IMAGE_RE.test(url);
}

export function attachmentName(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    // Uploads are prefixed with a millisecond timestamp, which is noise here.
    return last.replace(/^\d{10,}-/, "") || "Attachment";
  } catch {
    return url.split("/").pop()?.slice(0, 60) || "Attachment";
  }
}

let workerReady = false;

/**
 * pdf.js, with its worker pointed at the copy in public/.
 *
 * The worker is synced out of node_modules by scripts/sync-pdf-worker.mjs
 * on every build, because pdf.js refuses to start when the worker and the
 * API are different versions.
 */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  return pdfjs;
}

async function renderPdf(url: string, budget: number): Promise<Attachment> {
  const label = attachmentName(url);
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) {
      return { label, kind: "unreadable", pages: [], note: "could not be downloaded" };
    }
    const bytes = await res.arrayBuffer();

    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;

    const allowed = Math.max(0, Math.min(doc.numPages, MAX_PAGES_PER_DOC, budget));
    const pages: AttachmentPage[] = [];

    for (let n = 1; n <= allowed; n++) {
      const page = await doc.getPage(n);
      const unscaled = page.getViewport({ scale: 1 });
      const target = unscaled.width > unscaled.height ? RASTER_PX_WIDE : RASTER_PX;
      const viewport = page.getViewport({ scale: target / unscaled.width });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) break;

      // PDF pages are transparent where nothing is drawn, and a transparent
      // page flattened into JPEG comes out black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      pages.push({
        data: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
        natural: { width: canvas.width, height: canvas.height },
        page: n,
        pageCount: doc.numPages,
      });

      // Canvases this size hold on to a lot of memory across a long loop.
      canvas.width = 0;
      canvas.height = 0;
    }

    const missed = doc.numPages - pages.length;
    return {
      label,
      kind: "document",
      pages,
      note: missed > 0
        ? `showing ${pages.length} of ${doc.numPages} pages`
        : undefined,
    };
  } catch {
    // A corrupt or password-protected PDF should cost its own entry and
    // nothing else.
    return { label, kind: "unreadable", pages: [], note: "could not be read as a PDF" };
  }
}

/**
 * Re-encode to JPEG, whatever came in.
 *
 * Two things made this necessary, both measured on one real brief. A
 * photographic PNG stays a PNG through the image transform and arrives at
 * 990KB where the same picture as JPEG is about 70KB. Worse, jsPDF does
 * not store a PNG as it finds it — it decodes to a bitmap and deflates,
 * so 4.6MB of images became a 30MB document. A JPEG is embedded whole.
 *
 * The white fill matters too: a PNG with transparency flattens to black
 * otherwise, which is how a logo on a clear background becomes a
 * rectangle of ink.
 */
export async function toJpeg(
  dataUrl: string,
  maxPx = RASTER_PX,
): Promise<{ data: string; natural: { width: number; height: number } } | null> {
  const natural = await imageDimensions(dataUrl);
  if (!natural) return null;

  const scale = Math.min(1, maxPx / natural.width, Math.max(maxPx, 1600) / natural.height);
  const width = Math.max(1, Math.round(natural.width * scale));
  const height = Math.max(1, Math.round(natural.height * scale));

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = dataUrl;
  });
  if (!image) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const data = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return { data, natural: { width, height } };
}

async function renderImage(url: string): Promise<Attachment> {
  const label = attachmentName(url);
  const fetched = await imageToDataUrl(
    imageUrl(url, RASTER_PX_WIDE / 2, { height: 1600 / 2, resize: "contain", quality: 85 }),
  );
  if (!fetched) {
    return { label, kind: "unreadable", pages: [], note: "could not be downloaded" };
  }
  // A wide photograph goes on a turned sheet as well, so it is allowed the
  // same extra pixels; a tall one gains nothing from them.
  const wide = (await imageDimensions(fetched)) ?? { width: 0, height: 0 };
  const page = await toJpeg(fetched, wide.width > wide.height ? RASTER_PX_WIDE : RASTER_PX);
  if (!page) {
    return { label, kind: "unreadable", pages: [], note: "could not be read as an image" };
  }
  return { label, kind: "image", pages: [page] };
}

/**
 * Every attachment turned into pages that can be drawn into a PDF.
 *
 * Sequential on purpose. These are large files — one lookbook is 26MB —
 * and fetching ten at once on a hotel wifi is how the whole export fails
 * instead of taking a little longer.
 */
export async function renderAttachments(
  sources: AttachmentSource[],
  options: { onProgress?: (done: number, total: number, label: string) => void } = {},
): Promise<{ attachments: Attachment[]; truncated: boolean }> {
  // Clients routinely attach the same document to the brief and to a
  // product, and each upload gets its own timestamped URL — so the same
  // 26MB lookbook arrives twice under two different links. Matching on the
  // filename underneath the timestamp catches that; matching on the URL
  // does not. Two genuinely different files sharing a name would merge,
  // which is the cheaper mistake: a duplicate costs pages in every export,
  // a merge costs one entry that is still named in the contents list.
  const seen = new Set<string>();
  const unique = sources.filter((source) => {
    if (!source.url) return false;
    const key = attachmentName(source.url).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const attachments: Attachment[] = [];
  let used = 0;
  let truncated = false;

  for (const [index, source] of unique.entries()) {
    const url = source.url;
    options.onProgress?.(index, unique.length, attachmentName(url));

    const remaining = MAX_APPENDIX_PAGES - used;

    // Hold back a page for every file still to come. Without this the
    // first long document eats the budget and everything after it is
    // dropped — on one real brief a 19-page tech pack left four
    // photographs and the product references with nowhere to go. Better
    // that every file appears and the long ones are cut short, which the
    // contents list says plainly.
    const later = unique.length - index - 1;
    const allowance = Math.max(1, remaining - later);

    if (remaining <= 0) {
      truncated = true;
      attachments.push({
        label: attachmentName(url),
        context: source.context,
        kind: "unreadable",
        pages: [],
        note: "not included — the appendix was already full",
      });
      continue;
    }

    let attachment: Attachment;
    if (PDF_RE.test(url)) {
      attachment = await renderPdf(url, allowance);
    } else if (IMAGE_RE.test(url)) {
      attachment = await renderImage(url);
    } else {
      // Design files and archives cannot be turned into a picture in a
      // browser. Named, so the reader knows to go and ask for it.
      attachment = {
        label: attachmentName(url),
        kind: "unreadable",
        pages: [],
        note: "not an image or PDF, so it cannot be shown here",
      };
    }

    if (attachment.note?.startsWith("showing ")) truncated = true;
    used += attachment.pages.length;
    attachments.push({ ...attachment, context: source.context });
  }

  options.onProgress?.(unique.length, unique.length, "");
  return { attachments, truncated };
}
