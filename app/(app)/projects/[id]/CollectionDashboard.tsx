"use client";

import { useRouter } from "next/navigation";
import { Package, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product, Stage, PriceTier } from "@/lib/mock-data";

const STAGE_ORDER: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];

const STAGE_COLORS: Record<Stage, string> = {
  brief:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  sourcing:   "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sampling:   "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  production: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  qc:         "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  shipped:    "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
};

// If volume tiers exist, use the middle tier (median by MOQ);
// otherwise fall back to the single client_unit_price_usd / quoted_cost_usd.
function representativePrice(tiers: PriceTier[] | null | undefined, fallback: number | null | undefined): number | null {
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.moq - b.moq);
    return sorted[Math.floor(sorted.length / 2)].unit_price_usd;
  }
  return fallback ?? null;
}

function fmtUsd(v: number, opts: { whole?: boolean } = {}) {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return opts.whole
    ? `${sign}$${Math.round(abs).toLocaleString("en-US")}`
    : `${sign}$${abs.toFixed(2)}`;
}

function signed(v: number, opts: { whole?: boolean } = {}) {
  return `${v >= 0 ? "+" : ""}${fmtUsd(v, opts)}`;
}

interface Props {
  products: Product[];
  onOpenProduct: (id: string) => void;
}

export function CollectionDashboard({ products, onOpenProduct }: Props) {
  const router = useRouter();

  // ── Aggregate production margin ───────────────────────────────
  let totalRevenue = 0;
  let totalCost = 0;
  let totalTargetCost = 0;
  let totalQty = 0;
  let productsWithMargin = 0;
  // Spread vs target uses the supplier-side quoted price as the comparison.
  // Positive when quoted is above target.
  let spreadTotalQuoted = 0;
  let spreadTotalTarget = 0;
  let spreadProductCount = 0;
  for (const p of products) {
    const qty = p.order_qty ?? p.moq ?? 0;
    if (qty <= 0) continue;
    const clientUnit = representativePrice(p.price_tiers, p.client_unit_price_usd);
    const supplierUnit = representativePrice(p.internal_price_tiers, p.quoted_cost_usd);
    if (clientUnit == null && supplierUnit == null && p.target_cost_usd == null) continue;
    totalQty += qty;
    if (p.target_cost_usd != null) totalTargetCost += p.target_cost_usd * qty;
    if (clientUnit != null) totalRevenue += clientUnit * qty;
    if (supplierUnit != null) totalCost += supplierUnit * qty;
    if (clientUnit != null && supplierUnit != null) productsWithMargin++;
    // Quoted-vs-target spread: only counts when both quoted and target exist
    if (supplierUnit != null && p.target_cost_usd != null) {
      spreadTotalQuoted += supplierUnit * qty;
      spreadTotalTarget += p.target_cost_usd * qty;
      spreadProductCount++;
    }
  }
  const hasRevenue = totalRevenue > 0;
  const totalMargin = totalRevenue - totalCost;
  const marginPct = hasRevenue ? (totalMargin / totalRevenue) * 100 : null;
  const avgUnitMargin = hasRevenue && totalQty > 0 && productsWithMargin > 0 ? totalMargin / totalQty : null;
  const inProfit = totalMargin >= 0;

  // Quoted vs target spread
  const hasSpread = spreadProductCount > 0;
  const quotedTargetSpread = hasSpread ? spreadTotalQuoted - spreadTotalTarget : null;
  const spreadAboveTarget = quotedTargetSpread != null ? quotedTargetSpread >= 0 : null;
  const spreadPct = hasSpread && spreadTotalTarget > 0 ? ((quotedTargetSpread ?? 0) / spreadTotalTarget) * 100 : null;

  // ── Aggregate sampling P&L ───────────────────────────────────
  const samplingItems = products.filter((p) => p.sample_fee_usd != null || p.sample_cost_usd != null);
  const totalSampleFee = samplingItems.reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);
  const totalSampleCost = samplingItems.reduce((s, p) => s + (p.sample_cost_usd ?? 0), 0);
  const sampleMargin = totalSampleFee - totalSampleCost;
  const sampleMarginPct = totalSampleFee > 0 ? (sampleMargin / totalSampleFee) * 100 : null;
  const sampleProfitable = sampleMargin >= 0;

  // ── Stage counts ───────────────────────────────────────────────
  const stageCounts: Partial<Record<Stage, number>> = {};
  for (const p of products) stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  const activeStages = (Object.entries(stageCounts) as [Stage, number][])
    .filter(([_, n]) => n > 0)
    .sort((a, b) => STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0]));

  const samplingCount = products.filter((p) => p.stage === "sampling").length;
  const productionCount = products.filter((p) => p.stage === "production" || p.stage === "qc").length;

  return (
    <div className="h-full overflow-y-auto bg-[var(--sa-bg)]">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Top stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Products" value={products.length.toString()} icon={<Package size={14} />} />
          <StatTile label="In sampling" value={samplingCount.toString()} />
          <StatTile label="In production" value={productionCount.toString()} />
          <StatTile label="Total qty (planned)" value={totalQty > 0 ? totalQty.toLocaleString() : "—"} />
        </div>

        {/* Profit & Sampling P&L card */}
        <section className="rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--sa-border)] flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
              Profit & Sampling P&L
            </span>
          </div>

          {/* Production margin */}
          <div className="px-5 py-5 space-y-3 border-b border-[var(--sa-border)]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
              Production margin
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <PLTile
                label="Target cost"
                value={totalTargetCost > 0 ? fmtUsd(totalTargetCost, { whole: true }) : "—"}
                neutral
              />
              <PLTile
                label="Revenue (×qty)"
                value={hasRevenue ? fmtUsd(totalRevenue, { whole: true }) : "—"}
                neutral
              />
              <PLTile
                label="Avg unit margin"
                value={avgUnitMargin != null ? signed(avgUnitMargin) : "—"}
                positive={avgUnitMargin != null ? avgUnitMargin >= 0 : null}
              />
              <PLTile
                label={totalQty > 0 ? `Total profit (×${totalQty.toLocaleString()})` : "Total profit"}
                value={hasRevenue ? signed(totalMargin, { whole: true }) : "—"}
                positive={hasRevenue ? inProfit : null}
              />
            </div>

            {!hasRevenue && hasSpread && (
              <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[11px] text-[var(--sa-text-tertiary)]">
                Set a client unit price (or client volume tiers) on each product to compute total profit.
              </div>
            )}

            {hasSpread && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                <PLTile
                  label="Quoted total (supplier)"
                  value={fmtUsd(spreadTotalQuoted, { whole: true })}
                  neutral
                />
                <PLTile
                  label="Target cost total"
                  value={fmtUsd(spreadTotalTarget, { whole: true })}
                  neutral
                />
                <PLTile
                  label="Quoted vs target"
                  value={quotedTargetSpread != null ? signed(quotedTargetSpread, { whole: true }) : "—"}
                  positive={spreadAboveTarget}
                />
              </div>
            )}

            {marginPct != null && (
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium",
                inProfit ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                         : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              )}>
                {inProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>{inProfit ? "In profit" : "Below target"} · {Math.abs(marginPct).toFixed(1)}% margin</span>
              </div>
            )}

            {!hasRevenue && hasSpread && spreadPct != null && (
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium",
                spreadAboveTarget ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              )}>
                {spreadAboveTarget ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>
                  Quoted {spreadAboveTarget ? "above" : "below"} target by {Math.abs(spreadPct).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Sampling P&L */}
          <div className="px-5 py-5 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
              Sampling P&L
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PLTile
                label="Fee charged"
                value={totalSampleFee > 0 ? fmtUsd(totalSampleFee) : "—"}
                neutral
              />
              <PLTile
                label="Internal cost"
                value={totalSampleCost > 0 ? fmtUsd(totalSampleCost) : "—"}
                neutral
              />
              <PLTile
                label="Sample margin"
                value={samplingItems.length > 0 ? signed(sampleMargin) : "—"}
                positive={samplingItems.length > 0 ? sampleProfitable : null}
              />
            </div>
            {sampleMarginPct != null && samplingItems.length > 0 && (
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium",
                sampleProfitable ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                 : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              )}>
                {sampleProfitable ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>{sampleProfitable ? "Sampling profitable" : "Sampling at a loss"} · {Math.abs(sampleMarginPct).toFixed(1)}% margin</span>
              </div>
            )}
          </div>
        </section>

        {/* Stage breakdown */}
        {activeStages.length > 0 && (
          <section className="rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-3">
              By stage
            </p>
            <div className="flex flex-wrap gap-2">
              {activeStages.map(([stage, count]) => (
                <div key={stage} className="flex items-center gap-2 rounded-full border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-1">
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STAGE_COLORS[stage])}>
                    {stage}
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--sa-text-primary)]">{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Product tile grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Products</p>
            <p className="text-[11px] text-[var(--sa-text-tertiary)]">{products.length} item{products.length !== 1 ? "s" : ""}</p>
          </div>
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--sa-border)] bg-[var(--sa-window)] p-12 text-center">
              <Package size={24} className="text-[var(--sa-text-tertiary)] mx-auto mb-2" />
              <p className="text-[13px] text-[var(--sa-text-secondary)]">No products yet</p>
              <p className="text-[11px] text-[var(--sa-text-tertiary)] mt-1">Click "Add" in the header to add the first one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {products.map((p) => (
                <ProductTile key={p.id} product={p} onClick={() => onOpenProduct(p.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">
        {icon}<span>{label}</span>
      </div>
      <p className="mt-1.5 text-[18px] font-semibold text-[var(--sa-text-primary)] font-mono">{value}</p>
    </div>
  );
}

function PLTile({ label, value, neutral, positive }: { label: string; value: string; neutral?: boolean; positive?: boolean | null }) {
  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
      <p className={cn(
        "mt-1 font-mono text-[16px] font-semibold",
        neutral || positive == null
          ? "text-[var(--sa-text-primary)]"
          : positive ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
      )}>
        {value}
      </p>
    </div>
  );
}

function ProductTile({ product, onClick }: { product: Product; onClick: () => void }) {
  const previewImg = product.images?.[0];
  return (
    <button
      onClick={onClick}
      className="flex flex-col text-left rounded-xl overflow-hidden border border-[var(--sa-border)] bg-[var(--sa-window)] hover:border-[var(--sa-border-strong)] hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="w-full aspect-[4/5] bg-[var(--sa-hover)] overflow-hidden">
        {previewImg ? (
          <img src={previewImg} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full flex items-center justify-center text-[var(--sa-text-tertiary)]">
            <Package size={28} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1.5">
        <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{product.name}</p>
        {product.category && (
          <p className="text-[10px] text-[var(--sa-text-tertiary)] truncate">{product.category}</p>
        )}
        <div className="flex items-center justify-between gap-1">
          <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize", STAGE_COLORS[product.stage])}>
            {product.stage}
          </span>
          {product.quoted_cost_usd != null && (
            <span className="text-[11px] font-mono font-semibold text-[var(--sa-text-primary)]">
              ${product.quoted_cost_usd.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
