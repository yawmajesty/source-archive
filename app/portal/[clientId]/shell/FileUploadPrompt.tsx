"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FILE_TAGS, tagWantsProduct } from "@/lib/portal-file-tags";

// ─────────────────────────────────────────────────────────────
// What is this, and what is it for?
//
// Asked before the upload rather than after, because the moment the file
// is sent is the only moment anybody knows the answer. A file that arrives
// as "FINAL_v3.pdf" with nothing attached has to be opened to be
// identified, and then renamed, and then filed — all work that the person
// sending it could have saved with two taps.
//
// Both questions can be skipped. A client blocked from sending us
// something because they cannot decide what to call it is worse than an
// untagged file.
// ─────────────────────────────────────────────────────────────

export interface UploadChoice {
  tag: string | null;
  productId: string | null;
  note: string | null;
}

export function FileUploadPrompt({
  file,
  products,
  busy,
  onCancel,
  onConfirm,
}: {
  file: File;
  products: Array<{ id: string; name: string; collection: string }>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (choice: UploadChoice) => void;
}) {
  const [tag, setTag] = useState<string | null>(null);
  const [productId, setProductId] = useState<string>("");
  const [note, setNote] = useState("");

  const brand = FILE_TAGS.filter((t) => t.scope === "brand");
  const product = FILE_TAGS.filter((t) => t.scope === "product");
  const asksProduct = tagWantsProduct(tag);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
      active ? "text-white" : ""
    }`;

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6"
      onClick={busy ? undefined : onCancel}>
      <div
        className="flex max-h-[92vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl"
        style={{ background: "var(--portal-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
              What is this?
            </p>
            <p className="truncate text-[11.5px]" style={{ color: "var(--portal-text-muted)" }}>
              {file.name} · {(file.size / 1048576).toFixed(1)} MB
            </p>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="Cancel"
            className="shrink-0 rounded-md p-1 disabled:opacity-40" style={{ color: "var(--portal-text-muted)" }}>
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
            For the brand
          </p>
          <div className="flex flex-wrap gap-1.5">
            {brand.map((t) => (
              <button key={t.id} onClick={() => setTag(tag === t.id ? null : t.id)}
                title={t.hint}
                className={chip(tag === t.id)}
                style={tag === t.id
                  ? { background: "var(--portal-brand)" }
                  : { border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)" }}>
                {t.label}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
            For one product
          </p>
          <div className="flex flex-wrap gap-1.5">
            {product.map((t) => (
              <button key={t.id} onClick={() => setTag(tag === t.id ? null : t.id)}
                title={t.hint}
                className={chip(tag === t.id)}
                style={tag === t.id
                  ? { background: "var(--portal-brand)" }
                  : { border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)" }}>
                {t.label}
              </button>
            ))}
          </div>

          {tag && (
            <p className="mt-2 text-[11.5px] leading-snug" style={{ color: "var(--portal-text-muted)" }}>
              {FILE_TAGS.find((t) => t.id === tag)?.hint}
            </p>
          )}

          {/* Only once they have said it is about a product. Asking which
              garment a logo belongs to is a question with no answer. */}
          {asksProduct && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
                Which product?
              </p>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface-raised)", color: "var(--portal-text-primary)" }}
              >
                <option value="">Not for a specific product yet</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.collection}</option>
                ))}
              </select>
              {products.length === 0 && (
                <p className="mt-1 text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
                  No products yet — send it anyway and we&apos;ll attach it once the style exists.
                </p>
              )}
            </div>
          )}

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
              Anything we should know
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — e.g. use this one, not the earlier version"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
              style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface-raised)", color: "var(--portal-text-primary)" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--portal-border-subtle)" }}>
          <button onClick={onCancel} disabled={busy}
            className="rounded-lg px-3 py-2 text-[12.5px] font-medium disabled:opacity-40"
            style={{ color: "var(--portal-text-secondary)" }}>
            Cancel
          </button>
          <div className="flex-1" />
          {/* Deliberately not disabled on a missing tag. Blocking somebody
              from sending us a file because they cannot categorise it is
              worse than receiving it untagged. */}
          <button
            onClick={() => onConfirm({ tag, productId: productId || null, note: note || null })}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--portal-brand)" }}
          >
            {busy ? "Uploading…" : tag ? "Send it" : "Send without a tag"}
          </button>
        </div>
      </div>
    </div>
  );
}
