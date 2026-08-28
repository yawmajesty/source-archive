"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { PRODUCT_STAGES } from "@/lib/stages";
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

/**
 * The stage track shown to clients, taken from lib/stages.ts rather than
 * redeclared here. A second copy is exactly how the dashboard crash happened:
 * a stage existed in one list and not another, and anything set to it fell
 * through. Kanban hints are layered on by id.
 */
const STAGE_HINTS: Record<string, string> = {
  review: "Waiting on your comments before we go again.",
  approved: "Moves here once you approve a sample.",
  revision: "A second sample, built from your feedback.",
  qc: "We post factory-floor QC photos here.",
  shipped: "Finished pieces land here.",
};

const STAGES: { id: string; label: string; hint?: string }[] = PRODUCT_STAGES.map((s) => ({
  id: s.id,
  label: s.label,
  hint: STAGE_HINTS[s.id],
}));

const money = (n: number | null) =>
  n == null ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Where a product has got to, at a glance.
 *
 * Seven segments, one per stage: the ones behind you fill in, the one you're
 * on breathes. It turns "sampling" from a word into visible progress, which is
 * the thing a brand actually wants to know when they open the portal.
 */
function StageProgress({ stage }: { stage: string }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  const current = STAGES[idx];
  const done = idx >= STAGES.length - 1;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1" aria-label={`Stage: ${current?.label ?? stage}`}>
        {STAGES.map((s, i) => {
          const passed = idx >= 0 && i < idx;
          const isCurrent = i === idx;
          return (
            <span
              key={s.id}
              className={`h-[3px] flex-1 rounded-full transition-all duration-500 ${isCurrent ? "stage-pulse" : ""}`}
              style={{
                background: passed || isCurrent ? STAGE_TINT[s.id] ?? "var(--accent)" : "var(--fill)",
                opacity: passed ? 0.55 : isCurrent ? 1 : 1,
              }}
            />
          );
        })}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--label-2)" }}>
        <span
          className="inline-block h-[6px] w-[6px] rounded-full"
          style={{ background: STAGE_TINT[stage] ?? "var(--accent)" }}
        />
        {current?.label ?? stage}
        {!done && idx >= 0 && (
          <span className="tnum" style={{ color: "var(--label-3)" }}>
            · {idx + 1} of {STAGES.length}
          </span>
        )}
        {done && <span style={{ color: "var(--green)" }}>· done</span>}
      </p>
    </div>
  );
}

// Warm at the start, cool through the middle, green at the finish — so the
// colour itself reads as progress rather than being decorative.
const STAGE_TINT: Record<string, string> = {
  brief: "#A88CE0",
  pattern: "#6F86E8",
  sourcing: "#6F86E8",
  sampling: "#3E9BD6",
  review: "#E0913C",
  approved: "#3EA97A",
  revision: "#E06C6C",
  production: "#2F9E68",
  qc: "#2F9E68",
  shipped: "#1F7A4C",
};

function productsOf(projects: PortalProject[]): PortalProduct[] {
  return projects.flatMap((p) => p.products);
}

/**
 * Export what's on screen, as a spreadsheet.
 *
 * The portal had a CSV download before the collection views replaced the old
 * projects table; this restores it against the same figures the Table view
 * shows, so the file and the screen can't disagree.
 */
function exportCsv(projects: PortalProject[], filenameHint: string) {
  const rows = projects.flatMap((proj) =>
    proj.products.map((p) => {
      const qty = p.order_qty ?? 0;
      const unit = p.quoted_cost_usd;
      return {
        Collection: proj.name,
        Product: p.name,
        Category: p.category,
        Stage: STAGES.find((s) => s.id === p.stage)?.label ?? p.stage,
        Quantity: qty || "",
        "Unit cost (USD)": unit ?? "",
        "Total spend (USD)": unit != null && qty ? (unit * qty).toFixed(2) : "",
        MOQ: p.moq ?? "",
        "Sample round": p.sample_round ?? "",
        "Expected sample": p.expected_sample_date
          ? new Date(p.expected_sample_date).toISOString().slice(0, 10)
          : "",
      };
    }),
  );
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  // Quote every field and double any embedded quotes — product names contain
  // commas and inches often enough to matter.
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.map(esc).join(","),
    ...rows.map((r) => headers.map((h) => esc((r as Record<string, unknown>)[h])).join(",")),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${filenameHint.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${stamp}.csv`;

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
            <StageProgress stage={p.stage} />
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────
// The line-sheet math clients otherwise keep in a spreadsheet. The totals
// footer is the whole reason to stop keeping it there.

export function TableView({ projects, onSelect, exportName = "collection" }: {
  projects: PortalProject[]; onSelect: (p: PortalProduct) => void; exportName?: string;
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end">
        <button
          onClick={() => exportCsv(projects, exportName)}
          className="mac-button flex items-center gap-1.5"
          title="Download these products as a spreadsheet"
        >
          <Download size={13} strokeWidth={1.6} /> Export CSV
        </button>
      </div>

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
