"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, PoundSterling, TrendingUp, Coins } from "lucide-react";
import type { Collection, Product } from "@/lib/brand-catalog";
import { categoryLabel } from "@/lib/brand-catalog";
import { computeCollectionRollup, computeProductMargin, formatCurrency, CURRENCIES } from "@/lib/brand-costing";
import { updateCollectionFx } from "../../actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  collection: Collection;
  products: Product[];
}

export function CostingRollup({ workspaceId, workspaceSlug, mode, role, collection, products }: Props) {
  const rollup = computeCollectionRollup(products, collection);
  const rowMargins = products.map((p) => ({ p, m: computeProductMargin(p, collection) }));

  return (
    <div className="space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Projected revenue"
          value={formatCurrency(rollup.totalRevenue, collection.base_currency)}
          icon={<TrendingUp size={13} />}
        />
        <Stat
          label="Total spend"
          value={formatCurrency(rollup.totalSpend, collection.base_currency)}
          icon={<Coins size={13} />}
        />
        <Stat
          label="Projected profit"
          value={formatCurrency(rollup.totalProfit, collection.base_currency)}
          highlight={rollup.totalProfit >= 0 ? "positive" : "negative"}
          icon={<PoundSterling size={13} />}
        />
        <Stat
          label="Blended margin"
          value={rollup.blendedMarginPct != null ? rollup.blendedMarginPct.toFixed(1) + "%" : "—"}
          hint={rollup.productsPricedCount > 0 ? `${rollup.productsPricedCount} of ${rollup.productCount} priced` : "No priced products yet"}
          highlight={
            rollup.blendedMarginPct != null
              ? rollup.blendedMarginPct >= collection.target_margin_pct ? "positive" : "warning"
              : undefined
          }
        />
      </div>

      {rollup.productsBelowTarget > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-300">
          <AlertTriangle size={13} className="shrink-0" />
          <span>
            <strong>{rollup.productsBelowTarget} product{rollup.productsBelowTarget !== 1 && "s"}</strong> below the {collection.target_margin_pct.toFixed(0)}% target margin. Highlighted in the table below.
          </span>
        </div>
      )}

      {/* FX + target margin editor */}
      <FxRateEditor
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        collectionId={collection.id}
        mode={mode}
        role={role}
        baseCurrency={collection.base_currency}
        initialRates={collection.fx_rates}
        initialTarget={collection.target_margin_pct}
      />

      {/* Per-category rollup */}
      {rollup.byCategory.length > 0 && (
        <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
          <header className="px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
            <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">By category</h2>
          </header>
          <table className="w-full text-[12px]">
            <thead className="bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
              <tr>
                {["Category", "Products", "Spend", "Revenue", "Profit", "Margin"].map((h, i) => (
                  <th key={h} className={cn("px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]", i > 1 ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sa-border)]">
              {rollup.byCategory.map((r) => (
                <tr key={r.category}>
                  <td className="px-3 py-2 text-[13px] text-[var(--sa-text-primary)]">{categoryLabel(r.category)}</td>
                  <td className="px-3 py-2 text-[12px] text-[var(--sa-text-secondary)]">{r.productCount}</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-[var(--sa-text-primary)]">{formatCurrency(r.totalSpend, collection.base_currency)}</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-[var(--sa-text-primary)]">{formatCurrency(r.totalRevenue, collection.base_currency)}</td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-[var(--sa-text-primary)]">{formatCurrency(r.totalProfit, collection.base_currency)}</td>
                  <td className={cn(
                    "px-3 py-2 text-[12px] font-mono text-right",
                    r.blendedMarginPct == null ? "text-[var(--sa-text-tertiary)]" :
                    r.blendedMarginPct >= collection.target_margin_pct ? "text-emerald-600 dark:text-emerald-400" :
                    "text-amber-600 dark:text-amber-400",
                  )}>
                    {r.blendedMarginPct != null ? r.blendedMarginPct.toFixed(1) + "%" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-product table */}
      <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
        <header className="px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)] flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">By product</h2>
          <span className="text-[10px] text-[var(--sa-text-tertiary)] uppercase tracking-wider">
            All values in {collection.base_currency}
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
              <tr>
                {["Style", "Name", "Qty", "Cost / u", "Retail / u", "Spend", "Revenue", "Profit", "Margin"].map((h, i) => (
                  <th key={h} className={cn("px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]", i >= 2 ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sa-border)]">
              {rowMargins.map(({ p, m }) => (
                <tr key={p.id} className={cn(m.belowTarget && "bg-amber-50/40 dark:bg-amber-500/5")}>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--sa-text-tertiary)] whitespace-nowrap">{p.style_code}</td>
                  <td className="px-3 py-2">
                    <Link href={`/app/${workspaceSlug}/collections/${collection.id}/products/${p.id}`} className="text-[13px] text-[var(--sa-text-primary)] hover:text-[var(--sa-accent)]">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--sa-text-secondary)]">{m.qty > 0 ? m.qty.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--sa-text-primary)]">
                    {m.costPerUnitBase != null ? formatCurrency(m.costPerUnitBase, collection.base_currency) : "—"}
                    {m.costPerUnitNative != null && m.costCurrency !== collection.base_currency && (
                      <span className="block text-[10px] text-[var(--sa-text-tertiary)] font-mono">
                        {formatCurrency(m.costPerUnitNative, m.costCurrency)} native
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--sa-text-primary)]">
                    {m.retailPerUnitBase != null ? formatCurrency(m.retailPerUnitBase, collection.base_currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--sa-text-primary)]">
                    {m.totalCost != null ? formatCurrency(m.totalCost, collection.base_currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--sa-text-primary)]">
                    {m.totalRevenue != null ? formatCurrency(m.totalRevenue, collection.base_currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--sa-text-primary)]">
                    {m.totalProfit != null ? formatCurrency(m.totalProfit, collection.base_currency) : "—"}
                  </td>
                  <td className={cn(
                    "px-3 py-2 text-right font-mono",
                    m.marginPct == null ? "text-[var(--sa-text-tertiary)]" :
                    m.belowTarget ? "text-amber-600 dark:text-amber-400" :
                    "text-emerald-600 dark:text-emerald-400",
                  )}>
                    {m.marginPct != null ? m.marginPct.toFixed(1) + "%" : "—"}
                    {m.belowTarget && (
                      <AlertTriangle size={10} className="inline ml-1" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[var(--sa-bg)] border-t border-[var(--sa-border)]">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]">
                  Collection total ({rollup.productCount} product{rollup.productCount !== 1 && "s"})
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[var(--sa-text-primary)]">{formatCurrency(rollup.totalSpend, collection.base_currency)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[var(--sa-text-primary)]">{formatCurrency(rollup.totalRevenue, collection.base_currency)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[var(--sa-text-primary)]">{formatCurrency(rollup.totalProfit, collection.base_currency)}</td>
                <td className={cn(
                  "px-3 py-2.5 text-right font-mono text-[13px] font-semibold",
                  rollup.blendedMarginPct == null ? "text-[var(--sa-text-tertiary)]" :
                  rollup.blendedMarginPct >= collection.target_margin_pct ? "text-emerald-600 dark:text-emerald-400" :
                  "text-amber-600 dark:text-amber-400",
                )}>
                  {rollup.blendedMarginPct != null ? rollup.blendedMarginPct.toFixed(1) + "%" : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── FX + target margin editor ─────────────────────────────────────

function FxRateEditor({
  workspaceId, workspaceSlug, collectionId, mode, role, baseCurrency, initialRates, initialTarget,
}: {
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  mode: WorkspaceMode;
  role: Role;
  baseCurrency: string;
  initialRates: Record<string, number>;
  initialTarget: number;
}) {
  const router = useRouter();
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of CURRENCIES) {
      if (c === baseCurrency) continue;
      out[c] = initialRates[c] != null ? String(initialRates[c]) : "";
    }
    return out;
  });
  const [target, setTarget] = useState(String(initialTarget));
  const [savedFlash, setSavedFlash] = useState(false);
  const [isPending, startTransition] = useTransition();

  function commit() {
    const numeric: Record<string, number> = {};
    for (const [c, v] of Object.entries(rates)) {
      const n = Number(v);
      if (v !== "" && Number.isFinite(n) && n > 0) numeric[c] = n;
    }
    startTransition(async () => {
      const res = await updateCollectionFx({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        mode,
        role,
        fx_rates: numeric,
        target_margin_pct: Number(target) || 0,
      });
      if (!res.success) { alert("Couldn't save: " + res.error); return; }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">FX rates & target margin</h2>
          <p className="text-[11px] text-[var(--sa-text-tertiary)]">
            One rate per currency you quote in. Format: 1 X in {baseCurrency}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-[11px] text-emerald-500">Saved</span>}
          <button
            onClick={commit}
            disabled={isPending}
            className="rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </header>
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CURRENCIES.filter((c) => c !== baseCurrency).map((c) => (
          <div key={c}>
            <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
              1 {c} =
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                step="0.0001"
                value={rates[c]}
                onChange={(e) => setRates((r) => ({ ...r, [c]: e.target.value }))}
                placeholder="0.0000"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] font-mono text-right text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              />
              <span className="text-[11px] text-[var(--sa-text-tertiary)]">{baseCurrency}</span>
            </div>
          </div>
        ))}
        <div>
          <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
            Target margin
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] font-mono text-right text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
            <span className="text-[11px] text-[var(--sa-text-tertiary)]">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────

function Stat({
  label, value, hint, icon, highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  highlight?: "positive" | "negative" | "warning";
}) {
  const color =
    highlight === "positive" ? "text-emerald-600 dark:text-emerald-400" :
    highlight === "negative" ? "text-red-600 dark:text-red-400" :
    highlight === "warning"  ? "text-amber-600 dark:text-amber-400" :
    "text-[var(--sa-text-primary)]";
  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn("mt-1.5 text-[18px] font-semibold font-mono", color)}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-[var(--sa-text-tertiary)]">{hint}</p>}
    </div>
  );
}
