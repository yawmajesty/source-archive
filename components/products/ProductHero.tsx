"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageUrl as sizedImage } from "@/lib/image-url";
import { Lightbox } from "@/components/shared/Lightbox";
import { isNonGarmentCategory, categoryGroup } from "@/lib/product-categories";
import type { Product } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// The top of a product page, read the way a shop reads.
//
// The page used to open on a grid of square thumbnails and a row of
// fields, with the price buried in a collapsible section further down.
// The two things anybody opens a product for — what it looks like and
// what it costs — were the two hardest to see.
//
// So: one large portrait frame with the rest of the shots under it, and
// the name, description and pricing beside it. Images are contained
// rather than cropped, because these are factory and sample photographs
// of every shape and a crop can cut the hem off a garment.
//
// The frame is 3:4 rather than the 9:16 of a phone screen. At the width
// this column gets on a laptop, 9:16 would stand over a thousand pixels
// tall and push the price below the fold, which is the complaint this
// replaces rather than a different version of it.
// ─────────────────────────────────────────────────────────────

const MONEY = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ProductHero({
  product,
  images,
  description,
  canEdit = true,
  onSaveDescription,
}: {
  product: Product;
  images: string[];
  description: string | null;
  canEdit?: boolean;
  /** Returns an error message, or null when it saved. */
  onSaveDescription?: (text: string) => Promise<string | null>;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // An upload or a delete can move the images under us.
  useEffect(() => {
    if (index > images.length - 1) setIndex(Math.max(0, images.length - 1));
  }, [images.length, index]);

  useEffect(() => { setDraft(description ?? ""); }, [description]);

  // Keep the selected thumbnail in view when the arrows are used.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.children[index] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index]);

  const count = images.length;
  const step = (by: number) => setIndex((i) => (count === 0 ? 0 : (i + by + count) % count));
  const nonGarment = isNonGarmentCategory(product.category);
  const group = categoryGroup(product.category);

  const colourways = Array.isArray(product.colorways)
    ? (product.colorways as unknown[])
      .map((c) => (typeof c === "string" ? c : (c as { name?: string } | null)?.name))
      .filter(Boolean) as string[]
    : [];

  const variance =
    product.quoted_cost_usd != null && product.target_cost_usd ?
      ((product.quoted_cost_usd - product.target_cost_usd) / product.target_cost_usd) * 100
      : null;

  async function saveDescription() {
    if (!onSaveDescription) return;
    setSaving(true);
    setError(null);
    const err = await onSaveDescription(draft.trim());
    setSaving(false);
    if (err) { setError(err); return; }
    setEditing(false);
  }

  /** Garment-only facts are left out of a hang tag or a poly bag. */
  const facts: Array<[string, string]> = [
    ["MOQ", product.moq != null ? product.moq.toLocaleString() : "—"],
    ["Order qty", product.order_qty ? product.order_qty.toLocaleString() : "—"],
    ["Lead time", product.lead_time_days != null ? `${product.lead_time_days} days` : "—"],
    ...(nonGarment ? [] : ([
      ["Sizes", product.size_range || "—"],
      ["Fabric", product.fabric || "—"],
      ["Colourways", colourways.length > 0 ? colourways.join(", ") : "—"],
    ] as Array<[string, string]>)),
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-7">
      {/* ── The pictures ── */}
      <div className="min-w-0">
        <div
          tabIndex={count > 1 ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
            if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
          }}
          className="group relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-bg)] outline-none focus-visible:border-[var(--sa-accent)]"
        >
          {count === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <ImageIcon size={26} className="text-[var(--sa-text-tertiary)]" />
              <p className="text-[12px] text-[var(--sa-text-tertiary)]">No images yet</p>
              <p className="max-w-[18rem] text-center text-[11px] text-[var(--sa-text-tertiary)]">
                Add them under Media below and they appear here.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setLightbox(index)}
                aria-label="View this image full size"
                className="block h-full w-full cursor-zoom-in p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={images[index]}
                  src={sizedImage(images[index], 1200)}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              </button>

              {count > 1 && (
                <>
                  <GalleryArrow side="left" onClick={() => step(-1)} />
                  <GalleryArrow side="right" onClick={() => step(1)} />
                  <span className="pointer-events-none absolute bottom-2.5 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                    {index + 1} / {count}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {count > 1 && (
          <div ref={stripRef} className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-[var(--sa-bg)] transition-colors",
                  i === index ? "border-[var(--sa-accent)]" : "border-[var(--sa-border)] hover:border-[var(--sa-text-tertiary)]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={sizedImage(url, 120)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {lightbox !== null && (
          <Lightbox items={images.map((u) => ({ url: u }))} startIndex={lightbox} onClose={() => setLightbox(null)} />
        )}
      </div>

      {/* ── What it is, and what it costs ── */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <span className="rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--sa-text-secondary)]">
                {product.category}
              </span>
            )}
            {group && group !== product.category && (
              <span className="text-[11px] text-[var(--sa-text-tertiary)]">{group}</span>
            )}
            {product.style_no && (
              <span className="font-mono text-[11px] text-[var(--sa-text-tertiary)]">{product.style_no}</span>
            )}
          </div>
          <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[var(--sa-text-primary)]">
            {product.name}
          </h1>
        </div>

        {/* Description */}
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
              Description
            </span>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                title="Edit the description"
                className="text-[var(--sa-text-tertiary)] transition-colors hover:text-[var(--sa-accent)]"
              >
                <Pencil size={11} />
              </button>
            )}
          </div>

          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                autoFocus
                rows={5}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What this is, in the words you would use to describe it to the client."
                className="w-full resize-y rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] leading-relaxed text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={saveDescription}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Check size={12} /> {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setDraft(description ?? ""); setError(null); }}
                  className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                >
                  <X size={12} /> Cancel
                </button>
              </div>
              {error && <p className="text-[11.5px] text-red-600">{error}</p>}
            </div>
          ) : description?.trim() ? (
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">
              {description}
            </p>
          ) : (
            <button
              onClick={() => canEdit && setEditing(true)}
              className="text-left text-[12.5px] italic text-[var(--sa-text-tertiary)] hover:text-[var(--sa-accent)]"
            >
              No description yet{canEdit ? " — add one" : ""}.
            </button>
          )}
        </div>

        {/* Pricing */}
        <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3.5">
          <div className="grid grid-cols-3 gap-3">
            <Figure label="Target" value={MONEY(product.target_cost_usd)} />
            <Figure
              label="Quoted"
              value={MONEY(product.quoted_cost_usd)}
              tone={variance == null || Math.abs(variance) <= 5 ? undefined : variance > 0 ? "bad" : "good"}
            />
            <Figure label="Client price" value={MONEY(product.client_unit_price_usd)} strong />
          </div>
          {variance != null && Math.abs(variance) > 5 && (
            <p className={cn(
              "mt-2 text-[11.5px]",
              variance > 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]",
            )}>
              Quoted is {Math.abs(variance).toFixed(1)}% {variance > 0 ? "over" : "under"} target.
            </p>
          )}
          {product.sample_fee_usd != null && product.sample_fee_usd > 0 && (
            <p className="mt-2 text-[11.5px] text-[var(--sa-text-tertiary)]">
              Sample fee {MONEY(product.sample_fee_usd)}
            </p>
          )}
        </div>

        {/* The facts worth seeing without scrolling */}
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</dt>
              <dd className="truncate text-[13px] text-[var(--sa-text-primary)]" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Figure({ label, value, tone, strong }: {
  label: string; value: string; tone?: "good" | "bad"; strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</span>
      <span className={cn(
        "truncate font-mono text-[15px] font-semibold",
        tone === "good" ? "text-[var(--sa-success)]"
          : tone === "bad" ? "text-[var(--sa-danger)]"
          : "text-[var(--sa-text-primary)]",
        strong && "text-[17px]",
      )}>
        {value}
      </span>
    </div>
  );
}

function GalleryArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-black/70 focus-visible:opacity-100 group-hover:opacity-100",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {side === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );
}
