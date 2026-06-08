"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Package, ArrowRight, Plus, X, Pencil, Trash2, Check,
  LayoutList, Table2, GitBranch, Copy, Receipt, LayoutGrid, FileSpreadsheet,
} from "lucide-react";
import { QuoteBuilder } from "./QuoteBuilder";
import { CollectionDashboard } from "./CollectionDashboard";
import { ResizablePanel } from "@/components/layout/ResizablePanel";
import { ProductRow } from "@/components/shared/ProductRow";
import { StageTrack } from "@/components/shared/StageTrack";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { forkProductsToRound } from "./actions";
import type { Client, Project, Product, Factory, Stage, PriceTier } from "@/lib/mock-data";
import type { SavedInvoice } from "@/lib/data";

interface ProductWithFactory {
  product: Product;
  factory: Factory | null;
}

interface Props {
  project: Project;
  client: Client | null;
  productsWithFactory: ProductWithFactory[];
  factories: Factory[];
  products: Product[];
  savedInvoices: SavedInvoice[];
}

type SortKey = "name" | "stage" | "cost";
type SortDir = "asc" | "desc";
type ViewMode = "dashboard" | "list" | "table" | "quotes";

const STAGE_ORDER: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];
const STAGES: Stage[] = STAGE_ORDER;

const STAGE_COLORS: Record<Stage, string> = {
  brief:      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  sourcing:   "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sampling:   "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved:   "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  production: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  qc:         "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  shipped:    "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
};

function fmt(v: number | null | undefined, prefix = "$") {
  if (v == null) return "—";
  return `${prefix}${v.toFixed(2)}`;
}

// Pick the representative unit price for P&L modelling:
// if volume tiers exist, use the middle tier (median by MOQ);
// otherwise fall back to the flat single price (client_unit_price_usd / quoted_cost_usd).
function representativePrice(tiers: PriceTier[] | null | undefined, fallback: number | null | undefined): number | null {
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.moq - b.moq);
    return sorted[Math.floor(sorted.length / 2)].unit_price_usd;
  }
  return fallback ?? null;
}

function RoundBadge({ round }: { round: number }) {
  if (round <= 1) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300 leading-none shrink-0">
      <GitBranch size={8} /> R{round}
    </span>
  );
}

// ── Add Product Modal ─────────────────────────────────────────────────────────
function AddProductModal({ projectId, factories, onClose }: {
  projectId: string;
  factories: Factory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLSelectElement>(null);
  const factoryRef = useRef<HTMLSelectElement>(null);
  const moqRef = useRef<HTMLInputElement>(null);
  const targetCostRef = useRef<HTMLInputElement>(null);
  const clientPriceRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const name = nameRef.current?.value.trim();
    if (!name) { setError("Name is required"); return; }

    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from("products").insert({
      id: "prod-" + Date.now(),
      name,
      category: categoryRef.current?.value.trim() || null,
      stage: stageRef.current?.value || "brief",
      project_id: projectId,
      factory_id: factoryRef.current?.value || null,
      moq: parseInt(moqRef.current?.value || "0") || 0,
      order_qty: 0,
      target_cost_usd: parseFloat(targetCostRef.current?.value || "0") || 0,
      quoted_cost_usd: parseFloat(clientPriceRef.current?.value || "0") || null,
      quoted_cost_currency: "USD",
      lead_time_days: 0,
      colorways: [],
      notes: "",
      sample_round: 1,
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Add Product</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)] transition-colors">
            <X size={16} className="text-[var(--sa-text-tertiary)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Name *</label>
            <input ref={nameRef} autoFocus
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              placeholder="e.g. Ceramic Mug"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Category</label>
            <input ref={categoryRef}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              placeholder="e.g. Drinkware"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Stage</label>
              <select ref={stageRef} defaultValue="brief"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Factory</label>
              <select ref={factoryRef}
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              >
                <option value="">— None —</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">MOQ</label>
              <input ref={moqRef} type="number" min="0"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Target Cost</label>
              <input ref={targetCostRef} type="number" min="0" step="0.01"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Client Price</label>
              <input ref={clientPriceRef} type="number" min="0" step="0.01"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
          >
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Product"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Product preview (right panel) ────────────────────────────────────────────
function ProductPreview({ product, factory, onOpen }: { product: Product; factory: Factory | null; onOpen: () => void }) {
  return (
    <motion.div
      key={product.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      <div className="flex items-start justify-between px-5 py-4 panel-border-b bg-[var(--sa-window)]">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] truncate">{product.name}</h2>
            <RoundBadge round={product.sample_round ?? 1} />
          </div>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{product.category}</p>
          {product.parent_product_id && (
            <p className="text-[11px] text-violet-500">Forked from round {(product.sample_round ?? 2) - 1}</p>
          )}
        </div>
        <button onClick={onOpen}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity ml-3"
        >
          Open <ArrowRight size={11} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Stage</p>
          <StageTrack currentStage={product.stage} showLabels animated />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Target cost", value: product.target_cost_usd != null ? `$${product.target_cost_usd}` : "—" },
            { label: "Quoted cost", value: product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "—" },
            { label: "MOQ", value: product.moq != null ? product.moq.toLocaleString() : "—" },
            { label: "Lead time", value: product.lead_time_days != null ? `${product.lead_time_days}d` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[var(--sa-border)] p-3 bg-[var(--sa-window)]">
              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
              <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--sa-text-primary)]">{value}</p>
            </div>
          ))}
        </div>

        {factory && (
          <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Factory</p>
            <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">{factory.name}</p>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{factory.city}, {factory.country}</p>
          </div>
        )}

        {(product.sample_fee_usd != null || product.sample_cost_usd != null) && (() => {
          const fee = product.sample_fee_usd ?? 0;
          const cost = product.sample_cost_usd ?? 0;
          const margin = fee - cost;
          const marginPct = fee > 0 ? (margin / fee) * 100 : null;
          return (
            <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Sampling P&L</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Fee charged", value: fee > 0 ? `$${fee.toFixed(2)}` : "—", neutral: true },
                  { label: "Internal cost", value: cost > 0 ? `$${cost.toFixed(2)}` : "—", neutral: true },
                  { label: "Margin", value: `${margin >= 0 ? "+" : ""}$${margin.toFixed(2)}`, pos: margin >= 0 },
                ].map(({ label, value, neutral, pos }) => (
                  <div key={label} className="rounded-lg border border-[var(--sa-border)] p-2.5 bg-[var(--sa-bg)]">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
                    <p className={cn("mt-0.5 font-mono text-[13px] font-semibold",
                      neutral ? "text-[var(--sa-text-primary)]" : pos ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                    )}>{value}</p>
                  </div>
                ))}
              </div>
              {marginPct != null && (
                <p className={cn("mt-2 text-[11px] font-medium", marginPct >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                  {marginPct >= 0 ? "▲" : "▼"} {Math.abs(marginPct).toFixed(1)}% sample margin
                </p>
              )}
            </div>
          );
        })()}

        {product.colorways.length > 0 && (
          <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Colorways</p>
            <div className="flex flex-wrap gap-1.5">
              {product.colorways.map((c) => (
                <span key={c} className="rounded-full bg-[var(--sa-hover)] px-2.5 py-1 text-[11px] text-[var(--sa-text-secondary)] border border-[var(--sa-border)]">{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Table view with multi-select ─────────────────────────────────────────────
function CollectionTable({
  productsWithFactory,
  projectId,
  projectName,
  onOpenProduct,
}: {
  productsWithFactory: ProductWithFactory[];
  projectId: string;
  projectName: string;
  onOpenProduct: (id: string) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forking, startFork] = useTransition();
  const [viewTab, setViewTab] = useState<"products" | "sampling" | "production">("products");

  const allIds = productsWithFactory.map((i) => i.product.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleFork() {
    const ids = Array.from(selected);
    startFork(async () => {
      await forkProductsToRound(ids, projectId);
      setSelected(new Set());
      router.refresh();
    });
  }

  // Sampling totals
  const samplingItems = productsWithFactory.filter(
    ({ product: p }) => p.sample_fee_usd != null || p.sample_cost_usd != null
  );
  const totalFee    = samplingItems.reduce((s, { product: p }) => s + (p.sample_fee_usd  ?? 0), 0);
  const totalCost   = samplingItems.reduce((s, { product: p }) => s + (p.sample_cost_usd ?? 0), 0);
  const totalMargin = totalFee - totalCost;

  // Production P&L rows — per-product projected revenue/cost/margin
  const productionRows = productsWithFactory.map(({ product: p }) => {
    const qty = p.order_qty ?? p.moq ?? 0;
    const clientUnit = representativePrice(p.price_tiers, p.client_unit_price_usd);
    const supplierUnit = representativePrice(p.internal_price_tiers, p.quoted_cost_usd);
    const unitMargin = clientUnit != null && supplierUnit != null ? clientUnit - supplierUnit : null;
    const lineRevenue = clientUnit != null && qty > 0 ? clientUnit * qty : null;
    const lineCost = supplierUnit != null && qty > 0 ? supplierUnit * qty : null;
    const lineMargin = lineRevenue != null && lineCost != null ? lineRevenue - lineCost : null;
    return { product: p, qty, clientUnit, supplierUnit, unitMargin, lineRevenue, lineCost, lineMargin };
  });
  const prodTotalRevenue = productionRows.reduce((s, r) => s + (r.lineRevenue ?? 0), 0);
  const prodTotalCost    = productionRows.reduce((s, r) => s + (r.lineCost ?? 0), 0);
  const prodTotalMargin  = prodTotalRevenue - prodTotalCost;
  const prodMarginPct    = prodTotalRevenue > 0 ? (prodTotalMargin / prodTotalRevenue) * 100 : null;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab strip + actions */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 panel-border-b bg-[var(--sa-window)] shrink-0">
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--sa-bg)] p-0.5 border border-[var(--sa-border)]">
          {(["products", "sampling", "production"] as const).map((t) => (
            <button key={t} onClick={() => setViewTab(t)}
              className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors capitalize",
                viewTab === t ? "bg-[var(--sa-window)] text-[var(--sa-text-primary)] shadow-sm" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]"
              )}
            >
              {t === "products" ? "Products" : t === "sampling" ? "Sampling P&L" : "Production P&L"}
            </button>
          ))}
        </div>

        {viewTab === "products" && selected.size > 0 && (
          <button
            onClick={handleFork}
            disabled={forking}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
          >
            <Copy size={11} />
            {forking ? "Creating…" : `Round 2 sampling (${selected.size})`}
          </button>
        )}
      </div>

      {viewTab === "products" ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
              <tr>
                <th className="px-3 py-2 text-left w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-[var(--sa-border)] accent-[var(--sa-accent)]"
                  />
                </th>
                {["Product", "Round", "Stage", "Sample cost", "Client sample fee", "Prod. cost", "Client unit price", "Sample lead", "Prod. lead", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productsWithFactory.map(({ product: p, factory }) => {
                const isSelected = selected.has(p.id);
                const round = p.sample_round ?? 1;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-[var(--sa-border)] hover:bg-[var(--sa-hover)] transition-colors cursor-pointer",
                      isSelected && "bg-violet-50/60 dark:bg-violet-950/20"
                    )}
                    onClick={() => toggleOne(p.id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(p.id)}
                        className="rounded border-[var(--sa-border)] accent-[var(--sa-accent)]"
                      />
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      <p className="font-medium text-[var(--sa-text-primary)] truncate">{p.name}</p>
                      {p.category && <p className="text-[10px] text-[var(--sa-text-tertiary)] truncate">{p.category}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[var(--sa-text-secondary)]">R{round}</span>
                        {round > 1 && <GitBranch size={10} className="text-violet-500" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STAGE_COLORS[p.stage])}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{fmt(p.sample_cost_usd)}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-primary)]">{fmt(p.sample_fee_usd)}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{fmt(p.target_cost_usd)}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{fmt(p.client_unit_price_usd)}</td>
                    <td className="px-3 py-2.5 text-[var(--sa-text-secondary)]">
                      {p.sample_lead_time_days != null ? `${p.sample_lead_time_days}d` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--sa-text-secondary)]">{p.lead_time_days ? `${p.lead_time_days}d` : "—"}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenProduct(p.id)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-accent)] transition-colors whitespace-nowrap"
                      >
                        Open <ArrowRight size={10} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {productsWithFactory.length === 0 && (
            <div className="flex items-center justify-center py-16 text-[13px] text-[var(--sa-text-tertiary)]">No products yet</div>
          )}
        </div>
      ) : viewTab === "sampling" ? (
        /* Sampling P&L table */
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
              <tr>
                {["#", "Product", "Round", "Stage", "Expected sample", "Sample cost", "Client fee", "Margin", "Prod. cost", "Client price", "Prod. lead"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productsWithFactory.map(({ product: p }, i) => {
                const fee    = p.sample_fee_usd  ?? 0;
                const cost   = p.sample_cost_usd ?? 0;
                const margin = fee - cost;
                const round  = p.sample_round ?? 1;
                return (
                  <tr key={p.id} className={cn("border-b border-[var(--sa-border)] hover:bg-[var(--sa-hover)] transition-colors", i % 2 === 1 && "bg-[var(--sa-bg)]/40")}>
                    <td className="px-3 py-2.5 text-[var(--sa-text-tertiary)]">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-[var(--sa-text-primary)] max-w-[140px]">
                      <p className="truncate">{p.name}</p>
                      {p.category && <p className="text-[10px] text-[var(--sa-text-tertiary)]">{p.category}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[var(--sa-text-secondary)]">R{round}</span>
                        {round > 1 && <GitBranch size={10} className="text-violet-500" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STAGE_COLORS[p.stage])}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--sa-text-secondary)] whitespace-nowrap">
                      {(p as any).expected_sample_date
                        ? new Date((p as any).expected_sample_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{p.sample_cost_usd != null ? `$${cost.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-primary)]">{p.sample_fee_usd != null ? `$${fee.toFixed(2)}` : "—"}</td>
                    <td className={cn("px-3 py-2.5 font-mono font-semibold",
                      p.sample_fee_usd == null && p.sample_cost_usd == null ? "text-[var(--sa-text-tertiary)]"
                      : margin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                    )}>
                      {p.sample_fee_usd != null || p.sample_cost_usd != null ? `${margin >= 0 ? "+" : ""}$${margin.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{fmt(p.target_cost_usd)}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{fmt(p.client_unit_price_usd)}</td>
                    <td className="px-3 py-2.5 text-[var(--sa-text-secondary)]">{p.lead_time_days ? `${p.lead_time_days}d` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            {(samplingItems.length > 0) && (
              <tfoot className="border-t-2 border-[var(--sa-border-strong)] bg-[var(--sa-bg)]">
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-[11px] font-semibold text-[var(--sa-text-secondary)]">Collection total</td>
                  <td className="px-3 py-3 font-mono text-[13px] font-bold text-[var(--sa-text-primary)]">${totalCost.toFixed(2)}</td>
                  <td className="px-3 py-3 font-mono text-[13px] font-bold text-[var(--sa-text-primary)]">${totalFee.toFixed(2)}</td>
                  <td className={cn("px-3 py-3 font-mono text-[13px] font-bold",
                    totalMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                  )}>
                    {totalFee > 0 || totalCost > 0 ? `${totalMargin >= 0 ? "+" : ""}$${totalMargin.toFixed(2)}` : "—"}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
          {productsWithFactory.length === 0 && (
            <div className="flex items-center justify-center py-16 text-[13px] text-[var(--sa-text-tertiary)]">No products yet</div>
          )}
        </div>
      ) : (
        /* Production P&L table */
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 z-10 bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
              <tr>
                {["#", "Product", "Stage", "Qty", "Client unit", "Supplier unit", "Unit margin", "Margin %", "Revenue", "Cost", "Total margin"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productionRows.map(({ product: p, qty, clientUnit, supplierUnit, unitMargin, lineRevenue, lineCost, lineMargin }, i) => {
                const marginPct = clientUnit != null && clientUnit > 0 && unitMargin != null ? (unitMargin / clientUnit) * 100 : null;
                const hasAnyValue = lineRevenue != null || lineCost != null;
                return (
                  <tr key={p.id} className={cn("border-b border-[var(--sa-border)] hover:bg-[var(--sa-hover)] transition-colors", i % 2 === 1 && "bg-[var(--sa-bg)]/40")}>
                    <td className="px-3 py-2.5 text-[var(--sa-text-tertiary)]">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-[var(--sa-text-primary)] max-w-[160px]">
                      <p className="truncate">{p.name}</p>
                      {p.category && <p className="text-[10px] text-[var(--sa-text-tertiary)]">{p.category}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STAGE_COLORS[p.stage])}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)] whitespace-nowrap">
                      {qty > 0 ? qty.toLocaleString() : "—"}
                      {p.order_qty == null && p.moq != null && qty > 0 && (
                        <span className="ml-1 text-[9px] text-[var(--sa-text-tertiary)]" title="Using MOQ — order qty not set">MOQ</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-primary)]">{clientUnit != null ? `$${clientUnit.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{supplierUnit != null ? `$${supplierUnit.toFixed(2)}` : "—"}</td>
                    <td className={cn("px-3 py-2.5 font-mono font-semibold",
                      unitMargin == null ? "text-[var(--sa-text-tertiary)]"
                      : unitMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                    )}>
                      {unitMargin != null ? `${unitMargin >= 0 ? "+" : ""}$${unitMargin.toFixed(2)}` : "—"}
                    </td>
                    <td className={cn("px-3 py-2.5 font-mono",
                      marginPct == null ? "text-[var(--sa-text-tertiary)]"
                      : marginPct >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                    )}>
                      {marginPct != null ? `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-primary)]">{lineRevenue != null ? `$${lineRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[var(--sa-text-secondary)]">{lineCost != null ? `$${lineCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}</td>
                    <td className={cn("px-3 py-2.5 font-mono font-semibold",
                      !hasAnyValue || lineMargin == null ? "text-[var(--sa-text-tertiary)]"
                      : lineMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                    )}>
                      {lineMargin != null ? `${lineMargin >= 0 ? "+" : ""}$${lineMargin.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {productionRows.length > 0 && (prodTotalRevenue > 0 || prodTotalCost > 0) && (
              <tfoot className="border-t-2 border-[var(--sa-border-strong)] bg-[var(--sa-bg)]">
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-[11px] font-semibold text-[var(--sa-text-secondary)]">Collection total</td>
                  <td className={cn("px-3 py-3 font-mono text-[13px] font-bold",
                    prodMarginPct == null ? "text-[var(--sa-text-tertiary)]"
                    : prodMarginPct >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                  )}>
                    {prodMarginPct != null ? `${prodMarginPct >= 0 ? "+" : ""}${prodMarginPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-3 font-mono text-[13px] font-bold text-[var(--sa-text-primary)]">${prodTotalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-3 font-mono text-[13px] font-bold text-[var(--sa-text-primary)]">${prodTotalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  <td className={cn("px-3 py-3 font-mono text-[13px] font-bold",
                    prodTotalMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                  )}>
                    {`${prodTotalMargin >= 0 ? "+" : ""}$${prodTotalMargin.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {productsWithFactory.length === 0 && (
            <div className="flex items-center justify-center py-16 text-[13px] text-[var(--sa-text-tertiary)]">No products yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export function ProjectsPageClient({ project, client, productsWithFactory, factories, products, savedInvoices }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    productsWithFactory[0]?.product.id ?? null
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");

  // Rename
  const [projectName, setProjectName] = useState(project.name);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(project.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startRename() {
    setNameValue(projectName);
    setEditingName(true);
    setTimeout(() => { nameInputRef.current?.focus(); nameInputRef.current?.select(); }, 0);
  }

  async function commitRename() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === projectName) { setEditingName(false); return; }
    await supabase.from("projects").update({ name: trimmed }).eq("id", project.id);
    setProjectName(trimmed);
    setEditingName(false);
    router.refresh();
  }

  function onNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditingName(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${projectName}"? All products in this collection will also be deleted.`)) return;
    await supabase.from("projects").delete().eq("id", project.id);
    router.push(client ? `/clients/${client.id}` : "/");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...productsWithFactory].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.product.name.localeCompare(b.product.name);
    else if (sortKey === "stage") cmp = STAGE_ORDER.indexOf(a.product.stage) - STAGE_ORDER.indexOf(b.product.stage);
    else if (sortKey === "cost") cmp = (a.product.quoted_cost_usd ?? a.product.target_cost_usd ?? 0) - (b.product.quoted_cost_usd ?? b.product.target_cost_usd ?? 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const selectedItem = sorted.find((i) => i.product.id === selectedId);

  function openProduct(id: string) {
    router.push(`/products/${id}`);
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button onClick={() => toggleSort(k)}
        className={cn(
          "flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded transition-colors",
          active ? "text-[var(--sa-accent)] font-medium" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]"
        )}
      >
        {label}
        {active && <span className="text-[10px]">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
      </button>
    );
  }

  return (
    <>
      <div className="flex h-full overflow-hidden flex-col">
        {/* Collection header bar */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 panel-border-b bg-[var(--sa-window)] shrink-0">
          <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)] min-w-0 flex-1">
            <span className="truncate shrink-0">{client?.name ?? "Client"}</span>
            <ChevronRight size={11} className="shrink-0" />
            {editingName ? (
              <div className="flex items-center gap-1 min-w-0">
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={onNameKeyDown}
                  onBlur={commitRename}
                  className="rounded px-1.5 py-0.5 text-[12px] font-medium outline-none min-w-0 w-40"
                  style={{ border: "1px solid var(--sa-accent)", background: "var(--sa-bg)", color: "var(--sa-text-primary)" }}
                />
                <button onClick={commitRename} className="flex items-center justify-center rounded p-0.5 text-green-600 hover:bg-green-50 transition-colors">
                  <Check size={12} />
                </button>
                <button onClick={() => setEditingName(false)} className="flex items-center justify-center rounded p-0.5 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-bg)] transition-colors">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={startRename}
                className="group flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-[var(--sa-bg)] min-w-0"
                title="Rename collection"
              >
                <span className="text-[var(--sa-text-primary)] font-medium truncate">{projectName}</span>
                <Pencil size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 rounded-lg bg-[var(--sa-bg)] p-0.5 border border-[var(--sa-border)]">
              <button onClick={() => setViewMode("dashboard")}
                title="Dashboard"
                className={cn("rounded-md p-1.5 transition-colors", viewMode === "dashboard" ? "bg-[var(--sa-window)] text-[var(--sa-text-primary)] shadow-sm" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]")}
              >
                <LayoutGrid size={13} />
              </button>
              <button onClick={() => setViewMode("list")}
                title="List view"
                className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-[var(--sa-window)] text-[var(--sa-text-primary)] shadow-sm" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]")}
              >
                <LayoutList size={13} />
              </button>
              <button onClick={() => setViewMode("table")}
                title="Table view"
                className={cn("rounded-md p-1.5 transition-colors", viewMode === "table" ? "bg-[var(--sa-window)] text-[var(--sa-text-primary)] shadow-sm" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]")}
              >
                <Table2 size={13} />
              </button>
              <button onClick={() => setViewMode("quotes")}
                title="Quotes"
                className={cn("rounded-md p-1.5 transition-colors", viewMode === "quotes" ? "bg-[var(--sa-window)] text-[var(--sa-text-primary)] shadow-sm" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]")}
              >
                <Receipt size={13} />
              </button>
            </div>

            <a
              href={`/api/projects/${project.id}/production-invoice`}
              title="Download Production Invoice .xlsx (approved products only)"
              className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
            >
              <FileSpreadsheet size={12} /> Production Invoice
            </a>
            <button
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-1 rounded-lg bg-[var(--sa-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={12} /> Add
            </button>
            <button onClick={handleDelete} title="Delete collection"
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-red-50 text-[var(--sa-text-tertiary)] hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Body */}
        {viewMode === "dashboard" ? (
          <div className="flex-1 overflow-hidden">
            <CollectionDashboard products={products} onOpenProduct={openProduct} />
          </div>
        ) : viewMode === "quotes" ? (
          <div className="flex-1 overflow-hidden">
            {client ? (
              <QuoteBuilder
                project={project}
                client={client}
                products={products}
                savedInvoices={savedInvoices}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--sa-text-tertiary)]">
                No client linked to this collection.
              </div>
            )}
          </div>
        ) : viewMode === "table" ? (
          <div className="flex-1 overflow-hidden bg-[var(--sa-bg)]">
            <CollectionTable
              productsWithFactory={sorted}
              projectId={project.id}
              projectName={project.name}
              onOpenProduct={openProduct}
            />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Panel 2 — list */}
            <ResizablePanel defaultWidth={380} storageKey="koru-project-panel2">
              <div className="flex h-full flex-col">
                {/* Sort bar */}
                <div className="flex items-center gap-1 px-3 py-1.5 panel-border-b bg-[var(--sa-window)]">
                  <span className="text-[10px] text-[var(--sa-text-tertiary)] mr-1">Sort:</span>
                  <SortBtn k="name" label="Name" />
                  <SortBtn k="stage" label="Stage" />
                  <SortBtn k="cost" label="Cost" />
                </div>

                {/* Column headers */}
                <div className="flex items-center gap-3 px-3 py-1 panel-border-b bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
                  <div className="h-6 w-6 shrink-0" />
                  <span className="flex-1 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Product</span>
                  <span className="hidden w-32 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] xl:block">Factory</span>
                  <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Cost</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Stage</span>
                </div>

                {/* Rows */}
                <div className="flex-1 overflow-y-auto">
                  {sorted.length === 0 ? (
                    <EmptyState title="No products yet" description="Add products to this collection." />
                  ) : (
                    sorted.map(({ product, factory }) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        factory={factory}
                        selected={product.id === selectedId}
                        onClick={() => setSelectedId(product.id)}
                        onDoubleClick={() => openProduct(product.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            </ResizablePanel>

            {/* Panel 3 — preview */}
            <div className="flex-1 overflow-hidden bg-[var(--sa-bg)]">
              <AnimatePresence mode="wait">
                {selectedItem ? (
                  <ProductPreview
                    key={selectedItem.product.id}
                    product={selectedItem.product}
                    factory={selectedItem.factory}
                    onOpen={() => openProduct(selectedItem.product.id)}
                  />
                ) : (
                  <EmptyState title="Select a product" description="Click a product to preview" />
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddProduct && (
          <AddProductModal
            projectId={project.id}
            factories={factories}
            onClose={() => setShowAddProduct(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
