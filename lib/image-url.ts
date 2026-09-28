// ─────────────────────────────────────────────────────────────
// Right-sized images.
//
// Everything uploaded here is a photo straight off a phone or a camera:
// a typical product shot in storage is around 950KB. We were showing those
// at their full resolution behind a 56px thumbnail, so a product grid of
// twenty pulled roughly 19MB before it could draw anything. That is most
// of why the app felt slow.
//
// Supabase can resize on its own render endpoint and negotiates WebP from
// the browser's Accept header. The same photo measured:
//
//     original            964,731 bytes
//     width=400, WebP       6,298 bytes
//     width=64,  WebP       1,348 bytes
//
// So this is not a marginal saving — it is two to three orders of
// magnitude, and it costs one URL rewrite.
//
// Anything that is not a Supabase public object passes through untouched:
// external moodboard links, data: URIs, and the blob: previews shown while
// an upload is still in flight.
// ─────────────────────────────────────────────────────────────

const OBJECT_SEGMENT = "/storage/v1/object/public/";
const RENDER_SEGMENT = "/storage/v1/render/image/public/";

/** Screens are mostly 2x, and asking for 1x on one is visibly soft. */
const DPR = 2;

/** Past this there is nothing left to save and quality starts to matter more. */
const MAX_WIDTH = 1600;

export interface ImageOptions {
  /** 1–100. The default is a deliberate compromise; lift it for hero images. */
  quality?: number;
  /** "cover" crops to fill, "contain" fits inside. Thumbnails want cover. */
  resize?: "cover" | "contain" | "fill";
}

/**
 * A Supabase-hosted image resized for the box it is actually drawn in.
 *
 * `width` is the CSS width of that box, not the pixel width to request —
 * the doubling for high-density screens happens here so callers can pass
 * the number that appears in their own layout.
 */
export function imageUrl(
  src: string | null | undefined,
  width: number,
  options: ImageOptions = {},
): string {
  if (!src) return "";
  if (!src.includes(OBJECT_SEGMENT)) return src;

  const target = Math.min(Math.round(width * DPR), MAX_WIDTH);
  const params = new URLSearchParams({
    width: String(target),
    quality: String(options.quality ?? 72),
  });
  if (options.resize) params.set("resize", options.resize);

  return `${src.replace(OBJECT_SEGMENT, RENDER_SEGMENT)}?${params.toString()}`;
}

/**
 * Props every remote image on the site should carry.
 *
 * Lazy loading is the other half of the saving: none of these images had
 * it, so a long grid fetched every row at once even though only the first
 * was on screen. `decoding="async"` keeps the decode off the main thread.
 */
export function lazyImageProps(): { loading: "lazy"; decoding: "async" } {
  return { loading: "lazy", decoding: "async" };
}
