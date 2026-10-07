"use client";

import { useState } from "react";
import { FileText, ImageIcon, Inbox, ExternalLink } from "lucide-react";
import { imageUrl as sizedImage } from "@/lib/image-url";
import { Lightbox } from "@/components/shared/Lightbox";
import type { ClientOrigin } from "@/app/(app)/clients/[id]/origin-actions";

// ─────────────────────────────────────────────────────────────
// One place for everything about a client.
//
// The page already had their collections, their portal activity and their
// people. What it never had was the thing they first sent us — the brief,
// the references, the sentence explaining what they were actually after —
// and no gallery of the photographs now spread across their products.
//
// Both are read-only on purpose. This is the record of what was asked for,
// which is the thing you want to check a sample against.
// ─────────────────────────────────────────────────────────────

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|bmp|tiff?)(\?|$)/i;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fileName(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return last.replace(/^\d{10,}-/, "") || "Attachment";
  } catch {
    return "Attachment";
  }
}

export function ClientHome({
  origin,
  photos,
}: {
  origin: ClientOrigin | null;
  /** Every product photo across the client's collections. */
  photos: Array<{ url: string; productName: string; productId: string }>;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const shown = showAllPhotos ? photos : photos.slice(0, 12);
  const briefImages = origin?.files.filter((f) => IMAGE_EXT.test(f)) ?? [];
  const briefDocs = origin?.files.filter((f) => !IMAGE_EXT.test(f)) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {viewing !== null && (
        <Lightbox
          items={shown.map((p) => ({ url: p.url, caption: p.productName }))}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {/* ── What they first asked for ── */}
      <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
          <Inbox size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
          <h3 className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">
            The original enquiry
          </h3>
          {origin && (
            <a href="/leads" className="flex shrink-0 items-center gap-1 text-[11.5px] text-[var(--sa-accent)] hover:underline">
              Open in Leads <ExternalLink size={10} />
            </a>
          )}
        </div>

        {!origin ? (
          <p className="px-4 py-4 text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
            No enquiry is linked to this client. Ones added by hand have none, and ones converted before
            the link existed are matched by email where that is unambiguous.
          </p>
        ) : (
          <div className="px-4 py-3.5">
            <p className="mb-3 text-[11.5px] text-[var(--sa-text-tertiary)]">
              {origin.source === "brief_form" ? "Full brief" : "Enquiry"} · submitted {formatDate(origin.submittedAt)}
              {origin.revisionCount > 0 && ` · updated ${formatDate(origin.revisedAt)}`}
            </p>

            {origin.about.length > 0 && (
              <dl className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {origin.about.map(([label, value]) => (
                  <div key={label} className="flex min-w-0 gap-2">
                    <dt className="shrink-0 text-[11.5px] text-[var(--sa-text-tertiary)]">{label}</dt>
                    <dd className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--sa-text-primary)]">{value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {origin.products.length > 0 && (
              <div className="mb-3 border-t border-[var(--sa-border)] pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                  What they asked for ({origin.products.length})
                </p>
                <div className="flex flex-col gap-2">
                  {origin.products.map((p, i) => (
                    <div key={i} className="rounded-lg bg-[var(--sa-bg)] px-3 py-2">
                      <p className="text-[12.5px] font-medium text-[var(--sa-text-primary)]">
                        {p.name || "Unnamed"}
                        {p.category && <span className="font-normal text-[var(--sa-text-tertiary)]"> · {p.category}</span>}
                      </p>
                      {p.description && (
                        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--sa-text-secondary)]">{p.description}</p>
                      )}
                      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--sa-text-tertiary)]">
                        {p.target_qty != null && <span>{p.target_qty.toLocaleString()} units</span>}
                        {p.colorways != null && <span>{p.colorways} colourways</span>}
                        {p.target_price_usd != null && <span>target ${p.target_price_usd}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(origin.message || origin.sustainability || origin.moodboardLinks) && (
              <div className="mb-3 border-t border-[var(--sa-border)] pt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                  In their words
                </p>
                {origin.message && (
                  <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--sa-text-primary)]">{origin.message}</p>
                )}
                {origin.sustainability && (
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--sa-text-secondary)]">
                    <span className="font-medium text-[var(--sa-text-primary)]">Sustainability:</span> {origin.sustainability}
                  </p>
                )}
                {origin.moodboardLinks && (
                  <p className="mt-2 break-all text-[12px] text-[var(--sa-accent)]">{origin.moodboardLinks}</p>
                )}
              </div>
            )}

            {origin.files.length > 0 && (
              <div className="border-t border-[var(--sa-border)] pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                  What they sent ({origin.files.length})
                </p>
                {briefImages.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {briefImages.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img loading="lazy" decoding="async" src={sizedImage(url, 64)} alt=""
                          className="h-16 w-16 rounded-md border border-[var(--sa-border)] object-cover hover:opacity-90" />
                      </a>
                    ))}
                  </div>
                )}
                {briefDocs.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[12px] text-[var(--sa-accent)] hover:underline">
                    <FileText size={11} /> {fileName(url)}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Everything photographed since ── */}
      <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
          <ImageIcon size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
          <h3 className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">Photos</h3>
          <span className="tnum shrink-0 text-[11.5px] text-[var(--sa-text-tertiary)]">{photos.length}</span>
        </div>

        {photos.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] text-[var(--sa-text-tertiary)]">No product photos yet.</p>
        ) : (
          <div className="px-4 py-3.5">
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {shown.map((photo, i) => (
                <button key={`${photo.productId}-${photo.url}`} type="button" onClick={() => setViewing(i)}
                  title={photo.productName}
                  className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-lg border border-[var(--sa-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img loading="lazy" decoding="async" src={sizedImage(photo.url, 160)} alt={photo.productName}
                    className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            {photos.length > 12 && (
              <button onClick={() => setShowAllPhotos((v) => !v)}
                className="mt-2 text-[11.5px] text-[var(--sa-text-tertiary)] transition-colors hover:text-[var(--sa-text-secondary)]">
                {showAllPhotos ? "Show fewer" : `Show all ${photos.length}`}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
