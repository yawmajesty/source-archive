// ─────────────────────────────────────────────────────────────
// Product media — attributed photos and video.
//
// Before migration 011 every photo was a bare URL in products.images, so
// there was no way to tell a photo the client uploaded from one we did,
// and no way to store video at all. product_media carries one row per
// item with its kind and who contributed it.
//
// products.images is still maintained alongside it as a denormalized
// list of image URLs, because product cards, portal previews and the P&L
// views all still read that column. Media writes go through the helpers
// here so the two never drift apart.
// ─────────────────────────────────────────────────────────────

export type MediaKind = "image" | "video";
export type MediaAuthorRole = "agency" | "client";

export interface ProductMediaItem {
  id: string;
  product_id: string;
  url: string;
  kind: MediaKind;
  uploaded_by_role: MediaAuthorRole;
  uploaded_by_name: string | null;
  caption: string | null;
  created_at: string;
}

export interface NewMediaItem {
  url: string;
  kind: MediaKind;
  caption?: string | null;
}

const VIDEO_RE = /\.(mp4|mov|webm|m4v|avi)(\?|$)/i;

/** Classify by file extension — the only signal available once a file is a URL. */
export function mediaKindFor(nameOrUrl: string, mimeType?: string): MediaKind {
  if (mimeType?.startsWith("video/")) return "video";
  return VIDEO_RE.test(nameOrUrl) ? "video" : "image";
}

/** Images only, newest last — the shape products.images has always had. */
export function imageUrlsFrom(media: ProductMediaItem[]): string[] {
  return media.filter((m) => m.kind === "image").map((m) => m.url);
}

export function isVideoUrl(url: string): boolean {
  return VIDEO_RE.test(url);
}
