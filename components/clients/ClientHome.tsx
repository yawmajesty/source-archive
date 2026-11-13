"use client";

import { useState } from "react";
import { FileText, ImageIcon, Inbox, ExternalLink, LayoutGrid, Ruler, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageUrl as sizedImage } from "@/lib/image-url";
import { Lightbox } from "@/components/shared/Lightbox";
import { ClientFiles } from "@/components/clients/ClientFiles";
import {
  formatUsd, formatGbp, techpackState,
  type ClientMoney, type ClientTechpack,
} from "@/lib/client-overview";
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
  clientId,
  clientName,
  origin,
  photos,
  money,
  techpacks,
  collectionCount,
  productCount,
}: {
  clientId: string;
  clientName?: string;
  origin: ClientOrigin | null;
  /** Every product photo across the client's collections. */
  photos: Array<{ url: string; productName: string; productId: string }>;
  money?: ClientMoney;
  techpacks?: ClientTechpack[];
  collectionCount?: number;
  productCount?: number;
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

      {/* ── Where this client stands ── */}
      <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
          <LayoutGrid size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
          <h3 className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">
            {clientName ? `${clientName} at a glance` : "At a glance"}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[var(--sa-border)] sm:grid-cols-4">
          {[
            { label: "Collections", value: String(collectionCount ?? 0) },
            { label: "Styles", value: String(productCount ?? 0) },
            { label: "Tech packs", value: String((techpacks ?? []).length) },
            { label: "Photos", value: String(photos.length) },
          ].map((stat) => (
            <div key={stat.label} className="bg-[var(--sa-window)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{stat.label}</p>
              <p className="tnum mt-0.5 text-[18px] font-semibold text-[var(--sa-text-primary)]">{stat.value}</p>
            </div>
          ))}
        </div>

        {money && (
          <>
            <div className="grid grid-cols-2 gap-px border-t border-[var(--sa-border)] bg-[var(--sa-border)] sm:grid-cols-4">
              {[
                { label: "Invoiced", value: formatUsd(money.invoicedUsd), hint: `${money.counts.sent + money.counts.paid} sent` },
                { label: "Paid", value: formatUsd(money.paidUsd), hint: `${money.counts.paid} settled`, tone: "good" },
                { label: "Outstanding", value: formatUsd(money.outstandingUsd), hint: "sent, not yet paid", tone: money.outstandingUsd > 0 ? "warn" : undefined },
                { label: "In draft", value: formatUsd(money.draftUsd), hint: `${money.counts.draft} not sent` },
              ].map((stat) => (
                <div key={stat.label} className="bg-[var(--sa-window)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{stat.label}</p>
                  <p className={cn(
                    "tnum mt-0.5 text-[15px] font-semibold",
                    stat.tone === "good" ? "text-emerald-600"
                      : stat.tone === "warn" ? "text-amber-700 dark:text-amber-400"
                      : "text-[var(--sa-text-primary)]",
                  )}>
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-[var(--sa-text-tertiary)]">{stat.hint}</p>
                </div>
              ))}
            </div>
            <p className="border-t border-[var(--sa-border)] px-4 py-2.5 text-[11px] text-[var(--sa-text-tertiary)]">
              Invoices are in US dollars. Recorded spend on this client is{" "}
              <span className="tnum font-medium text-[var(--sa-text-secondary)]">{formatGbp(money.costGbp)}</span>, in
              pounds — the two are shown apart rather than added, because a single figure mixing them would be true in neither.
            </p>
          </>
        )}
      </section>

      <ClientFiles clientId={clientId} />

      {/* ── Tech packs across every collection ── */}
      <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
          <Ruler size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
          <h3 className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">Tech packs</h3>
          <span className="tnum shrink-0 text-[11.5px] text-[var(--sa-text-tertiary)]">{(techpacks ?? []).length}</span>
        </div>

        {(techpacks ?? []).length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
            No tech packs for this client yet. They are uploaded on a style&apos;s own page, under Tech pack.
          </p>
        ) : (
          <div className="divide-y divide-[var(--sa-border)]">
            {(techpacks ?? []).map((tp) => {
              const state = techpackState(tp);
              const signed = state === "Signed by both";
              return (
                <div key={tp.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/products/${tp.productId}`}
                      className="block truncate text-[12.5px] font-medium text-[var(--sa-text-primary)] hover:text-[var(--sa-accent)]"
                    >
                      {tp.productName ?? "A style"}
                    </a>
                    <p className="truncate text-[11px] text-[var(--sa-text-tertiary)]">
                      v{tp.version}
                      {tp.fileName ? ` · ${tp.fileName}` : tp.title ? ` · ${tp.title}` : ""}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                    tp.supersededAt ? "bg-[var(--sa-hover)] text-[var(--sa-text-tertiary)]"
                      : signed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
                  )}>
                    {state}
                  </span>
                  {tp.fileUrl && (
                    <a
                      href={tp.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex shrink-0 items-center gap-1 text-[11.5px] text-[var(--sa-accent)] hover:underline"
                    >
                      <Download size={11} /> Open
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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
