"use client";

import { useMemo } from "react";
import type { PortalProduct, PortalProject } from "../page";

// ─────────────────────────────────────────────────────────────
// Four views of the same collection. One dataset, four mental modes:
//   Gallery  — "see my collection"    (the line-sheet moment)
//   Table    — "check my numbers"     (the spreadsheet they keep in Excel)
//   Kanban   — "move my work"         (lifecycle stages)
//   Timeline — "will I hit my date"   (dates, backwards from delivery)
// ─────────────────────────────────────────────────────────────

export type CollectionView = "gallery" | "table" | "kanban" | "timeline";

export const COLLECTION_VIEWS: { id: CollectionView; label: string }[] = [
  { id: "gallery",  label: "Gallery" },
  { id: "table",    label: "Table" },
  { id: "kanban",   label: "Kanban" },
  { id: "timeline", label: "Timeline" },
];

const STAGES: { id: string; label: string; hint?: string }[] = [
  { id: "brief",      label: "Brief" },
  { id: "sourcing",   label: "Sourcing" },
  { id: "sampling",   label: "Sampling" },
  { id: "approved",   label: "Approved",   hint: "Moves here once you approve a sample." },
  { id: "production", label: "Production" },
  { id: "qc",         label: "Quality check", hint: "We post factory-floor QC photos here." },
  { id: "shipped",    label: "Shipped",    hint: "Delivered pieces land here." },
];

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function productsOf(projects: PortalProject[]): PortalProduct[] {
  return projects.flatMap((p) => p.products);
}

// ── Gallery ──────────────────────────────────────────────────

export function GalleryView({ projects, onSelect }: {
  projects: PortalProject[]; onSelect: (p: PortalProduct) => void;
}) {
  const products = productsOf(projects);
  if (!products.length) return <Empty text="No products in this collection yet." />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <button key={p.id} onClick={() => onSelect(p)} className="mac-card mac-card-hover overflow-hidden text-left">
          <div className="aspect-[4/5] w-full overflow-hidden" style={{ background: "var(--fill)" }}>
            {p.images?.[0] ? (
              <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px]" style={{ color: "var(--label-3)" }}>
                No photo
              </div>
            )}
          </div>
          <div className="p-2.5">
            <p className="truncate text-[13px] font-medium tight" style={{ color: "var(--label)" }}>{p.name}</p>
            <p className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--label-2)" }}>{p.category}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────
// The line-sheet math clients otherwise keep in a spreadsheet. The totals
// footer is the whole reason to stop keeping it there.

export function TableView({ projects, onSelect }: {
  projects: PortalProject[]; onSelect: (p: PortalProduct) => void;
}) {
  const products = productsOf(projects);

  const totals = useMemo(() => {
    let units = 0, spend = 0;
    for (const p of products) {
      const qty = p.order_qty ?? 0;
      units += qty;
      spend += (p.quoted_cost_usd ?? 0) * qty;
    }
    return { units, spend };
  }, [products]);

  if (!products.length) return <Empty text="No products in this collection yet." />;

  const th = "px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[.04em]";
  const td = "px-2.5 py-2 text-[12.5px]";

  return (
    <div className="mac-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: "var(--fill)" }}>
              <th className={th} style={{ color: "var(--label-3)" }}>Product</th>
              <th className={th} style={{ color: "var(--label-3)" }}>Stage</th>
              <th className={`${th} text-right`} style={{ color: "var(--label-3)" }}>Qty</th>
              <th className={`${th} text-right`} style={{ color: "var(--label-3)" }}>Unit cost</th>
              <th className={`${th} text-right`} style={{ color: "var(--label-3)" }}>Spend</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const qty = p.order_qty ?? 0;
              const spend = (p.quoted_cost_usd ?? 0) * qty;
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="cursor-pointer"
                  style={{ boxShadow: "inset 0 -0.5px 0 var(--sep)" }}
                >
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      {p.images?.[0] && (
                        <img src={p.images[0]} alt="" className="h-7 w-7 shrink-0 rounded-[5px] object-cover" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-medium" style={{ color: "var(--label)" }}>{p.name}</span>
                        <span className="block truncate text-[11px]" style={{ color: "var(--label-3)" }}>{p.category}</span>
                      </span>
                    </span>
                  </td>
                  <td className={td} style={{ color: "var(--label-2)" }}>
                    {STAGES.find((s) => s.id === p.stage)?.label ?? p.stage}
                  </td>
                  <td className={`${td} tnum text-right`} style={{ color: "var(--label)" }}>{qty || "—"}</td>
                  <td className={`${td} tnum text-right`} style={{ color: "var(--label)" }}>{money(p.quoted_cost_usd)}</td>
                  <td className={`${td} tnum text-right`} style={{ color: "var(--label)" }}>{spend ? money(spend) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--fill)" }}>
              <td className={`${td} font-semibold`} style={{ color: "var(--label)" }}>
                {products.length} products
              </td>
              <td className={td} />
              <td className={`${td} tnum text-right font-semibold`} style={{ color: "var(--label)" }}>{totals.units || "—"}</td>
              <td className={td} />
              <td className={`${td} tnum text-right font-semibold`} style={{ color: "var(--label)" }}>
                {totals.spend ? money(totals.spend) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Kanban ───────────────────────────────────────────────────
// Empty columns teach rather than sit blank.

export function KanbanView({ projects, onSelect }: {
  projects: PortalProject[]; onSelect: (p: PortalProduct) => void;
}) {
  const products = productsOf(projects);
  if (!products.length) return <Empty text="No products in this collection yet." />;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((stage) => {
        const inStage = products.filter((p) => p.stage === stage.id);
        return (
          <div key={stage.id} className="w-[210px] shrink-0">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-[12px] font-semibold tight" style={{ color: "var(--label)" }}>{stage.label}</span>
              <span className="tnum text-[11px]" style={{ color: "var(--label-3)" }}>{inStage.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {inStage.map((p) => (
                <button key={p.id} onClick={() => onSelect(p)} className="mac-card mac-card-hover p-2 text-left">
                  <div className="flex items-center gap-2">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="h-8 w-8 shrink-0 rounded-[5px] object-cover" />}
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium" style={{ color: "var(--label)" }}>{p.name}</p>
                      <p className="truncate text-[11px]" style={{ color: "var(--label-3)" }}>
                        {p.stage === "sampling" ? `Round ${p.sample_round}` : p.category}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {inStage.length === 0 && (
                <div
                  className="rounded-[9px] px-2.5 py-3 text-[11px]"
                  style={{ border: "0.5px dashed var(--sep)", color: "var(--label-3)" }}
                >
                  {stage.hint ?? "Nothing here yet."}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────

export function TimelineView({ projects, onSelect }: {
  projects: PortalProject[]; onSelect: (p: PortalProduct) => void;
}) {
  const products = productsOf(projects);

  const rows = useMemo(() => {
    return products.map((p) => {
      const dates = p.milestones
        .map((m) => new Date(m.due_date).getTime())
        .filter((t) => !Number.isNaN(t));
      return { product: p, first: dates.length ? Math.min(...dates) : null, last: dates.length ? Math.max(...dates) : null };
    });
  }, [products]);

  const bounds = useMemo(() => {
    const all = rows.flatMap((r) => (r.first && r.last ? [r.first, r.last] : []));
    if (!all.length) return null;
    return { min: Math.min(...all), max: Math.max(...all) };
  }, [rows]);

  if (!products.length) return <Empty text="No products in this collection yet." />;
  if (!bounds) return <Empty text="No scheduled dates yet — the timeline fills in as milestones are set." />;

  const span = Math.max(bounds.max - bounds.min, 1);
  const pct = (t: number) => ((t - bounds.min) / span) * 100;
  const nowPct = pct(Date.now());

  return (
    <div className="mac-card p-4">
      <div className="relative">
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px"
            style={{ left: `calc(28% + ${nowPct * 0.72}%)`, background: "var(--amber)" }}
          />
        )}
        <div className="flex flex-col gap-2">
          {rows.map(({ product, first, last }) => (
            <button key={product.id} onClick={() => onSelect(product)} className="flex items-center gap-2 text-left">
              <span className="w-[28%] truncate text-[12px]" style={{ color: "var(--label)" }}>{product.name}</span>
              <span className="relative h-[18px] flex-1 rounded-[5px]" style={{ background: "var(--fill)" }}>
                {first && last && (
                  <span
                    className="absolute top-0 bottom-0 rounded-[5px]"
                    style={{
                      left: `${pct(first)}%`,
                      width: `${Math.max(pct(last) - pct(first), 2)}%`,
                      background: product.stage === "shipped" ? "var(--green)" : "var(--accent)",
                      opacity: product.stage === "shipped" ? 1 : 0.75,
                    }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="tnum mt-3 flex justify-between text-[11px]" style={{ color: "var(--label-3)" }}>
        <span>{new Date(bounds.min).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
        <span>{new Date(bounds.max).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
      </p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-[12.5px]" style={{ color: "var(--label-3)" }}>{text}</p>;
}
