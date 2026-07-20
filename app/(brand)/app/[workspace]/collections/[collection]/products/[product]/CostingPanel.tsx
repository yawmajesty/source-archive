"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Product, Collection, CostBreakdown } from "@/lib/brand-catalog";
import { computeProductMargin, CURRENCIES, formatCurrency } from "@/lib/brand-costing";
import { updateProductCosting } from "../../../actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { cn } from "@/lib/utils";

interface Props {
  product: Product;
  collection: Collection;
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
}

const BREAKDOWN_FIELDS: Array<{ key: keyof CostBreakdown; label: string }> = [
  { key: "fabric",       label: "Fabric" },
  { key: "trims",        label: "Trims" },
  { key: "labor",        label: "Labor" },
  { key: "wash_finish",  label: "Wash / finish" },
  { key: "packaging",    label: "Packaging" },
  { key: "freight_duty", label: "Freight & duty" },
  { key: "other",        label: "Other" },
];

export function CostingPanel({ product, collection, workspaceId, workspaceSlug, mode, role }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local staging state — commits on blur so the user isn't fighting
  // the server on every keystroke.
  const [costMode, setCostMode] = useState<"single" | "breakdown">(
    product.cost_breakdown && Object.values(product.cost_breakdown).some((v) => v != null) ? "breakdown" : "single",
  );
  const [singleCost, setSingleCost] = useState(product.estimated_cost != null ? String(product.estimated_cost) : "");
  const [costCurrency, setCostCurrency] = useState(product.cost_currency ?? collection.base_currency);
  const [breakdown, setBreakdown] = useState<CostBreakdown>(product.cost_breakdown ?? {});
  const [retail, setRetail] = useState(product.sale_price_retail != null ? String(product.sale_price_retail) : "");
  const [wholesale, setWholesale] = useState(product.sale_price_wholesale != null ? String(product.sale_price_wholesale) : "");

  // Live margin uses local state so what-if edits update immediately.
  const previewProduct: Product = useMemo(
    () => ({
      ...product,
      estimated_cost: singleCost === "" ? null : Number(singleCost),
      cost_currency: costCurrency,
      cost_breakdown: costMode === "breakdown" ? breakdown : null,
      sale_price_retail: retail === "" ? null : Number(retail),
      sale_price_wholesale: wholesale === "" ? null : Number(wholesale),
    }),
    [product, singleCost, costCurrency, breakdown, costMode, retail, wholesale],
  );
  const m = useMemo(() => computeProductMargin(previewProduct, collection), [previewProduct, collection]);

  const missingRate =
    m.costPerUnitNative != null &&
    costCurrency !== collection.base_currency &&
    !(collection.fx_rates?.[costCurrency] > 0);

  function persist(patch: Parameters<typeof updateProductCosting>[0]["patch"]) {
    startTransition(async () => {
      const res = await updateProductCosting({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collection.id,
        product_id: product.id,
        mode,
        role,
        patch,
      });
      if (!res.success) alert("Couldn't save: " + res.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Costing</h2>
          <p className="text-[11px] text-[var(--sa-text-tertiary)]">
            Enter costs in whatever currency your factory quoted — margin rolls up in {collection.base_currency}.
          </p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-[var(--sa-border)] overflow-hidden">
          {(["single", "breakdown"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setCostMode(k)}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium",
                costMode === k
                  ? "bg-[var(--sa-accent)] text-white"
                  : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
              )}
            >
              {k === "single" ? "Single number" : "Breakdown"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] divide-y md:divide-y-0 md:divide-x divide-[var(--sa-border)]">
        {/* Editor */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                Cost per unit
              </label>
              {costMode === "single" ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={singleCost}
                  onChange={(e) => setSingleCost(e.target.value)}
                  onBlur={() =>
                    persist({
                      estimated_cost: singleCost === "" ? null : Number(singleCost),
                      cost_currency: costCurrency,
                      cost_breakdown: null,
                    })
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] font-mono outline-none focus:border-[var(--sa-accent)]"
                />
              ) : (
                <input
                  type="text"
                  disabled
                  value={m.costPerUnitNative != null ? m.costPerUnitNative.toFixed(2) : "—"}
                  className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] font-mono outline-none"
                />
              )}
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Currency</label>
              <select
                value={costCurrency}
                onChange={(e) => setCostCurrency(e.target.value)}
                onBlur={() =>
                  persist({ cost_currency: costCurrency, estimated_cost: singleCost === "" ? null : Number(singleCost) })
                }
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {costMode === "breakdown" && (
            <div className="space-y-2 rounded-lg border border-[var(--sa-border)] p-3 bg-[var(--sa-bg)]/40">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)]">
                Line items ({costCurrency})
              </p>
              {BREAKDOWN_FIELDS.map((f) => (
                <div key={f.key} className="grid grid-cols-[1fr_120px] items-center gap-2">
                  <span className="text-[12px] text-[var(--sa-text-secondary)]">{f.label}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={breakdown[f.key] != null ? String(breakdown[f.key]) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBreakdown((prev) => {
                        const next = { ...prev };
                        if (v === "") delete next[f.key];
                        else next[f.key] = Number(v);
                        return next;
                      });
                    }}
                    onBlur={() =>
                      persist({
                        cost_breakdown: Object.keys(breakdown).length ? breakdown : null,
                        estimated_cost: null,
                        cost_currency: costCurrency,
                      })
                    }
                    placeholder="0.00"
                    className="rounded border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1 text-[12px] font-mono text-right text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                  />
                </div>
              ))}
              <div className="grid grid-cols-[1fr_120px] items-center gap-2 pt-2 border-t border-[var(--sa-border)]">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)]">Line total</span>
                <span className="text-[13px] font-mono font-semibold text-right text-[var(--sa-text-primary)]">
                  {m.costPerUnitNative != null ? m.costPerUnitNative.toFixed(2) : "—"} {costCurrency}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                Retail price ({collection.base_currency})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={retail}
                onChange={(e) => setRetail(e.target.value)}
                onBlur={() => persist({ sale_price_retail: retail === "" ? null : Number(retail) })}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] font-mono text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                Wholesale <span className="normal-case font-normal text-[var(--sa-text-tertiary)]">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={wholesale}
                onChange={(e) => setWholesale(e.target.value)}
                onBlur={() => persist({ sale_price_wholesale: wholesale === "" ? null : Number(wholesale) })}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] font-mono text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              />
            </div>
          </div>

          {missingRate && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
              You&apos;re quoting in <strong>{costCurrency}</strong> but the collection has no FX rate set for it. Add one on the Costing tab to see this in {collection.base_currency}.
            </p>
          )}
        </div>

        {/* Live margin */}
        <MarginPreview
          margin={m}
          baseCurrency={collection.base_currency}
          costCurrency={costCurrency}
          targetPct={collection.target_margin_pct}
        />
      </div>
    </section>
  );
}

// ── Live margin preview ───────────────────────────────────────────

function MarginPreview({
  margin: m,
  baseCurrency,
  costCurrency,
  targetPct,
}: {
  margin: ReturnType<typeof computeProductMargin>;
  baseCurrency: string;
  costCurrency: string;
  targetPct: number;
}) {
  const marginColor =
    m.marginPct == null
      ? "text-[var(--sa-text-tertiary)]"
      : m.belowTarget
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";
  const MarginIcon = m.marginPct != null && m.marginPct >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="p-5 space-y-4 bg-[var(--sa-bg)]/30">
      <div>
        <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
          Gross margin
        </p>
        <div className="flex items-baseline gap-2">
          <MarginIcon size={18} className={marginColor} />
          <span className={cn("text-[28px] font-semibold font-mono leading-none", marginColor)}>
            {m.marginPct != null ? m.marginPct.toFixed(1) + "%" : "—"}
          </span>
          {m.markupMultiple != null && (
            <span className="text-[11px] text-[var(--sa-text-tertiary)] font-mono">
              · {m.markupMultiple.toFixed(2)}× markup
            </span>
          )}
        </div>
        {m.marginPct != null && m.belowTarget && (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            Below your {targetPct.toFixed(0)}% target
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          label={`Cost / unit (${baseCurrency})`}
          value={m.costPerUnitBase != null ? formatCurrency(m.costPerUnitBase, baseCurrency) : "—"}
          sub={
            m.costPerUnitNative != null && costCurrency !== baseCurrency
              ? `${formatCurrency(m.costPerUnitNative, costCurrency)} native`
              : undefined
          }
        />
        <Tile
          label="Profit / unit"
          value={m.unitProfit != null ? formatCurrency(m.unitProfit, baseCurrency) : "—"}
        />
        <Tile
          label={`Total spend (${m.qty || 0} u)`}
          value={m.totalCost != null ? formatCurrency(m.totalCost, baseCurrency) : "—"}
        />
        <Tile
          label="Projected revenue"
          value={m.totalRevenue != null ? formatCurrency(m.totalRevenue, baseCurrency) : "—"}
        />
      </div>

      {m.totalProfit != null && (
        <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Projected profit</p>
          <p className={cn("text-[18px] font-mono font-semibold", marginColor)}>
            {formatCurrency(m.totalProfit, baseCurrency)}
          </p>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
      <p className="mt-0.5 text-[13px] font-mono font-semibold text-[var(--sa-text-primary)]">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--sa-text-tertiary)] font-mono">{sub}</p>}
    </div>
  );
}
