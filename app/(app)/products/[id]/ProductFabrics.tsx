"use client";

import { useState } from "react";
import { Layers, Plus, X } from "lucide-react";
import type { Fabric } from "@/lib/fabrics";
import { STOCK_LABEL } from "@/lib/fabrics";
import { linkFabricToProduct, unlinkFabricFromProduct, listProductFabrics } from "@/app/(app)/fabrics/actions";

/**
 * What a garment is made from.
 *
 * The library and the products were two archives that never met: you
 * could catalogue a cloth and separately build a product, and nothing
 * recorded that one was made of the other. This is the join, from the
 * product's side.
 */
export function ProductFabrics({
  productId, initial, library, canEdit,
}: {
  productId: string;
  initial: Fabric[];
  library: Array<{ id: string; name: string; code: string | null; tier: string; category: string }>;
  canEdit: boolean;
}) {
  const [fabrics, setFabrics] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unused = library.filter((l) => !fabrics.some((f) => f.id === l.id));

  return (
    <div className="rounded-xl border border-[var(--sa-border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Layers size={15} className="text-[var(--sa-text-tertiary)]" />
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Fabrics</p>
        <div className="flex-1" />
        {canEdit && (
          <button
            onClick={() => setPicking((p) => !p)}
            className="flex items-center gap-1 text-[12px] font-medium text-[var(--sa-accent)]"
          >
            <Plus size={11} /> Add from the library
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 text-[11.5px] text-red-500">{error}</p>}

      {fabrics.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-[var(--sa-text-tertiary)]">
          Nothing recorded yet — attach the cloth this is made from and it shows on both sides.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          {fabrics.map((f) => (
            <div
              key={f.id}
              className="group flex items-center gap-2 rounded-lg border border-[var(--sa-border)] p-2"
            >
              <div
                className="h-8 w-8 shrink-0 overflow-hidden rounded"
                style={{ background: "var(--sa-hover)" }}
              >
                {f.swatch_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={f.swatch_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-[var(--sa-text-primary)]">
                  {f.code && (
                    <span className="rounded bg-[var(--sa-hover)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--sa-text-secondary)]">
                      {f.code}
                    </span>
                  )}
                  {f.name}
                </p>
                <p className="truncate text-[11px] text-[var(--sa-text-tertiary)]">
                  {[f.composition, f.gsm ? `${f.gsm} gsm` : null, STOCK_LABEL[f.stock_status]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {f.price_per_unit_usd != null && (
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--sa-text-secondary)]">
                  ${f.price_per_unit_usd}/{f.price_unit}
                </span>
              )}
              {canEdit && (
                <button
                  onClick={async () => {
                    setFabrics((p) => p.filter((x) => x.id !== f.id));
                    await unlinkFabricFromProduct(f.id, productId);
                  }}
                  aria-label={`Remove ${f.name}`}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                >
                  <X size={12} className="text-[var(--sa-text-tertiary)]" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {picking && canEdit && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--sa-border)]">
          {unused.length === 0 ? (
            <p className="p-3 text-[12px] text-[var(--sa-text-tertiary)]">
              {library.length === 0
                ? "The fabric library is empty."
                : "Everything in the library is already on this product."}
            </p>
          ) : (
            unused.map((l, i) => (
              <button
                key={l.id}
                onClick={async () => {
                  setError(null);
                  const res = await linkFabricToProduct(l.id, productId);
                  if (!res.success) { setError(res.error ?? "Could not attach"); return; }
                  setFabrics(await listProductFabrics(productId));
                  setPicking(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--sa-hover)] ${
                  i > 0 ? "border-t border-[var(--sa-border)]" : ""
                }`}
              >
                {l.code && (
                  <span className="shrink-0 rounded bg-[var(--sa-hover)] px-1 py-0.5 font-mono text-[10.5px] text-[var(--sa-text-secondary)]">
                    {l.code}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--sa-text-primary)]">
                  {l.name}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--sa-text-tertiary)]">
                  {l.tier === "premium" ? "Premium" : "Standard"} · {l.category}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
