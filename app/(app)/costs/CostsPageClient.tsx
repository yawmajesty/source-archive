"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, ChevronDown, ChevronRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { Cost, Client, Project, Product } from "@/lib/mock-data";

interface Props {
  costs: Cost[];
  clients: Client[];
  projects: Project[];
  products: Product[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  sampling:   "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  shipping:   "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  factory:    "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
  travel:     "bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-400",
  translation:"bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400",
  inspection: "bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400",
  other:      "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
};

const STAGE_COLORS: Record<string, string> = {
  brief: "bg-gray-400", sourcing: "bg-blue-500", sampling: "bg-amber-500",
  approved: "bg-green-600", production: "bg-purple-600", qc: "bg-orange-500", shipped: "bg-emerald-600",
};

function ProductDrillDown({ products }: { products: Product[] }) {
  if (!products.length) return <p className="text-[12px] text-[var(--sa-text-tertiary)] py-2">No products in this collection.</p>;
  return (
    <div className="rounded-xl border border-[var(--sa-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
              {["Product", "Stage", "Target", "Quoted", "Margin", "Sample fee", "Sample cost", "Sample P&L"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => {
              const unitMargin = p.quoted_cost_usd != null ? p.quoted_cost_usd - p.target_cost_usd : null;
              const marginPct = unitMargin != null && p.target_cost_usd > 0 ? (unitMargin / p.target_cost_usd) * 100 : null;
              const sampleFee = p.sample_fee_usd ?? 0;
              const sampleCost = p.sample_cost_usd ?? 0;
              const sampleMargin = (p.sample_fee_usd != null || p.sample_cost_usd != null) ? sampleFee - sampleCost : null;
              return (
                <tr key={p.id} className={cn("border-b border-[var(--sa-border)] last:border-0", i % 2 === 1 ? "bg-[var(--sa-bg)]/40" : "bg-[var(--sa-window)]")}>
                  <td className="px-3 py-2 font-medium text-[var(--sa-text-primary)] max-w-[180px] truncate">{p.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", STAGE_COLORS[p.stage] ?? "bg-gray-400")} />
                      <span className="capitalize text-[var(--sa-text-secondary)]">{p.stage}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[var(--sa-text-secondary)]">${p.target_cost_usd.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-[var(--sa-text-secondary)]">{p.quoted_cost_usd != null ? `$${p.quoted_cost_usd.toFixed(2)}` : "—"}</td>
                  <td className={cn("px-3 py-2 font-mono", marginPct == null ? "text-[var(--sa-text-tertiary)]" : marginPct >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                    {marginPct != null ? `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[var(--sa-text-secondary)]">{sampleFee > 0 ? `$${sampleFee.toFixed(2)}` : "—"}</td>
                  <td className="px-3 py-2 font-mono text-[var(--sa-text-secondary)]">{sampleCost > 0 ? `$${sampleCost.toFixed(2)}` : "—"}</td>
                  <td className={cn("px-3 py-2 font-mono font-semibold", sampleMargin == null ? "text-[var(--sa-text-tertiary)]" : sampleMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                    {sampleMargin != null ? `${sampleMargin >= 0 ? "+" : ""}$${sampleMargin.toFixed(2)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {products.length > 1 && (() => {
            const totalSampleFees = products.reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);
            const totalSampleCosts = products.reduce((s, p) => s + (p.sample_cost_usd ?? 0), 0);
            const totalSampleMargin = totalSampleFees - totalSampleCosts;
            const hasSampling = products.some(p => p.sample_fee_usd != null || p.sample_cost_usd != null);
            if (!hasSampling) return null;
            return (
              <tfoot className="border-t-2 border-[var(--sa-border-strong)] bg-[var(--sa-bg)]">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-[11px] font-semibold text-[var(--sa-text-secondary)]">Sampling totals</td>
                  <td className="px-3 py-2 font-mono text-[11px] font-semibold text-[var(--sa-text-primary)]">${totalSampleFees.toFixed(2)}</td>
                  <td className="px-3 py-2 font-mono text-[11px] font-semibold text-[var(--sa-text-primary)]">${totalSampleCosts.toFixed(2)}</td>
                  <td className={cn("px-3 py-2 font-mono text-[11px] font-bold", totalSampleMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                    {totalSampleMargin >= 0 ? "+" : ""}${totalSampleMargin.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

function PLView({ costs, projects, clients, products }: { costs: Cost[]; projects: Project[]; clients: Client[]; products: Product[] }) {
  const [selectedProjId, setSelectedProjId] = useState<string | null>(null);
  const gbp = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const usd = (v: number, sign = false) => `${sign && v > 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${sign && v < 0 ? " loss" : ""}`;

  const byProject = projects.map((proj) => {
    const pc = costs.filter((c) => c.project_id === proj.id);
    const pp = products.filter((p) => p.project_id === proj.id);
    const revenue    = pc.filter((c) => c.direction === "in").reduce((s, c) => s + c.amount_gbp, 0);
    const cogs       = pc.filter((c) => c.direction === "out" && c.cost_type === "cogs").reduce((s, c) => s + c.amount_gbp, 0);
    const operating  = pc.filter((c) => c.direction === "out" && c.cost_type === "operating").reduce((s, c) => s + c.amount_gbp, 0);
    const gross      = revenue - cogs;
    const net        = gross - operating;
    const margin     = revenue > 0 ? (gross / revenue) * 100 : null;
    const sampleFees  = pp.reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);
    const sampleCosts = pp.reduce((s, p) => s + (p.sample_cost_usd ?? 0), 0);
    const sampleMargin = sampleFees - sampleCosts;
    const clientName = clients.find((c) => c.id === proj.client_id)?.name ?? "";
    return { proj, clientName, revenue, cogs, operating, gross, net, margin, sampleFees, sampleCosts, sampleMargin, products: pp };
  }).filter((r) => r.revenue + r.cogs + r.operating + r.sampleFees + r.sampleCosts > 0);

  const totals = byProject.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue, cogs: acc.cogs + r.cogs,
    operating: acc.operating + r.operating, gross: acc.gross + r.gross, net: acc.net + r.net,
    sampleFees: acc.sampleFees + r.sampleFees, sampleCosts: acc.sampleCosts + r.sampleCosts,
    sampleMargin: acc.sampleMargin + r.sampleMargin,
  }), { revenue: 0, cogs: 0, operating: 0, gross: 0, net: 0, sampleFees: 0, sampleCosts: 0, sampleMargin: 0 });

  const TH = ({ c, right }: { c: string; right?: boolean }) => (
    <th className={cn("px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] whitespace-nowrap", right ? "text-right" : "text-left")}>{c}</th>
  );
  const TD = ({ v, bold, pos }: { v: string; bold?: boolean; pos?: boolean }) => {
    const val = parseFloat(v.replace(/[^-\d.]/g, ""));
    return (
      <td className={cn("px-3 py-3 font-mono text-[12px] text-right whitespace-nowrap",
        bold ? "font-semibold text-[var(--sa-text-primary)]" : "text-[var(--sa-text-secondary)]",
        pos && (val < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]")
      )}>{v}</td>
    );
  };

  return (
    <div className="px-6 pb-6 flex flex-col gap-5 overflow-y-auto">
      {/* Summary cards — 8 across */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
        {[
          { label: "Revenue",      value: gbp(totals.revenue),      sub: "Agency fees in",            pos: false },
          { label: "COGS",         value: gbp(totals.cogs),         sub: "Billable production costs",  pos: false },
          { label: "Gross profit", value: gbp(totals.gross),        sub: totals.revenue > 0 ? `${((totals.gross/totals.revenue)*100).toFixed(0)}% margin` : "—", pos: true },
          { label: "Operating",    value: gbp(totals.operating),    sub: "Internal overhead",          pos: false },
          { label: "Net profit",   value: gbp(totals.net),          sub: "After all costs",            pos: true },
          { label: "Sample fees",  value: usd(totals.sampleFees),   sub: "Charged to clients (USD)",   pos: false },
          { label: "Sample costs", value: usd(totals.sampleCosts),  sub: "Internal sample spend (USD)", pos: false },
          { label: "Sample P&L",   value: usd(totals.sampleMargin, true), sub: totals.sampleFees > 0 ? `${((totals.sampleMargin/totals.sampleFees)*100).toFixed(0)}% margin` : "—", pos: true },
        ].map(({ label, value, sub, pos }) => {
          const val = parseFloat(value.replace(/[^-\d.]/g, ""));
          return (
            <div key={label} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--sa-text-tertiary)]">{label}</p>
              <p className={cn("mt-1 font-mono text-[16px] font-semibold", pos ? (val < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]") : "text-[var(--sa-text-primary)]")}>{value}</p>
              <p className="text-[10px] text-[var(--sa-text-tertiary)] mt-0.5">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* Per-collection table with drill-down */}
      <div className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-window)]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">By Collection</span>
          <span className="text-[10px] text-[var(--sa-text-tertiary)]">Click a row to drill down into products</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
              <tr>
                <TH c="" /><TH c="Collection" /><TH c="Client" />
                <TH c="Revenue" right /><TH c="COGS" right /><TH c="Gross" right /><TH c="GM%" right />
                <TH c="Sample P&L" right /><TH c="Operating" right /><TH c="Net" right />
              </tr>
            </thead>
            {byProject.map(({ proj, clientName, revenue, cogs, gross, operating, net, margin, sampleMargin, products: projProducts }, i) => (
              <tbody key={proj.id}>
                <tr
                  onClick={() => setSelectedProjId(selectedProjId === proj.id ? null : proj.id)}
                  className={cn("border-b border-[var(--sa-border)] cursor-pointer transition-colors",
                    selectedProjId === proj.id ? "bg-[var(--sa-selected)]" : i % 2 === 1 ? "bg-[var(--sa-bg)]/50 hover:bg-[var(--sa-hover)]" : "hover:bg-[var(--sa-hover)]"
                  )}
                >
                  <td className="px-3 py-3">
                    <motion.div animate={{ rotate: selectedProjId === proj.id ? 90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronRight size={13} className="text-[var(--sa-text-tertiary)]" />
                    </motion.div>
                  </td>
                  <td className="px-3 py-3 text-[12px] font-medium text-[var(--sa-text-primary)] whitespace-nowrap">{proj.name}</td>
                  <td className="px-3 py-3 text-[12px] text-[var(--sa-text-secondary)] whitespace-nowrap">{clientName}</td>
                  <TD v={gbp(revenue)} />
                  <TD v={gbp(cogs)} />
                  <TD v={gbp(gross)} pos />
                  <td className={cn("px-3 py-3 font-mono text-[12px] text-right", margin !== null && margin < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]")}>
                    {margin !== null ? `${margin.toFixed(0)}%` : "—"}
                  </td>
                  <td className={cn("px-3 py-3 font-mono text-[12px] text-right font-semibold",
                    sampleMargin === 0 && projProducts.every(p => p.sample_fee_usd == null && p.sample_cost_usd == null)
                      ? "text-[var(--sa-text-tertiary)]"
                      : sampleMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]"
                  )}>
                    {projProducts.some(p => p.sample_fee_usd != null || p.sample_cost_usd != null) ? usd(sampleMargin, true) : "—"}
                  </td>
                  <TD v={gbp(operating)} />
                  <TD v={gbp(net)} pos bold />
                </tr>
                {selectedProjId === proj.id && (
                  <tr>
                    <td colSpan={10} className="bg-[var(--sa-bg)] px-4 py-3 border-b border-[var(--sa-border)]">
                      <ProductDrillDown products={projProducts} />
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
            <tfoot className="bg-[var(--sa-bg)] border-t-2 border-[var(--sa-border-strong)]">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-[12px] font-semibold text-[var(--sa-text-secondary)]">Total</td>
                <TD v={gbp(totals.revenue)} bold />
                <TD v={gbp(totals.cogs)} bold />
                <TD v={gbp(totals.gross)} pos bold />
                <td className={cn("px-3 py-3 font-mono text-[12px] text-right font-semibold", totals.revenue > 0 && (totals.gross/totals.revenue) < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]")}>
                  {totals.revenue > 0 ? `${((totals.gross/totals.revenue)*100).toFixed(0)}%` : "—"}
                </td>
                <td className={cn("px-3 py-3 font-mono text-[12px] text-right font-bold", totals.sampleMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                  {usd(totals.sampleMargin, true)}
                </td>
                <TD v={gbp(totals.operating)} bold />
                <TD v={gbp(totals.net)} pos bold />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CostsPageClient({ costs, clients, projects, products }: Props) {
  const [view, setView] = useState<"costs" | "pl">("costs");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBillable, setFilterBillable] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);

  // Filter
  const filtered = useMemo(() => {
    let r = costs;
    if (filterProject !== "all") r = r.filter((c) => c.project_id === filterProject);
    if (filterCategory !== "all") r = r.filter((c) => c.category === filterCategory);
    if (filterBillable === "yes") r = r.filter((c) => c.billable_to_client);
    if (filterBillable === "no") r = r.filter((c) => !c.billable_to_client);
    return r;
  }, [costs, filterProject, filterCategory, filterBillable]);

  // Group by project
  const grouped = useMemo(() => {
    const map = new Map<string, Cost[]>();
    for (const c of filtered) {
      const key = c.project_id ?? `client:${c.client_id ?? "unknown"}`;
      const group = map.get(key) ?? [];
      group.push(c);
      map.set(key, group);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const moneyOut = filtered.filter((c) => c.direction === "out").reduce((s, c) => s + c.amount_gbp, 0);
  const moneyIn  = filtered.filter((c) => c.direction === "in").reduce((s, c) => s + c.amount_gbp, 0);
  const totalBillable = filtered.filter((c) => c.billable_to_client).reduce((s, c) => s + c.amount_gbp, 0);
  const netBalance = moneyIn - moneyOut;

  function getProjectName(id: string) {
    if (id.startsWith("client:")) {
      const cId = id.replace("client:", "");
      return clients.find((c) => c.id === cId)?.name ?? "Client payments";
    }
    return projects.find((p) => p.id === id)?.name ?? id;
  }
  function getClientName(projectId: string) {
    if (projectId.startsWith("client:")) return "";
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return "";
    return clients.find((c) => c.id === proj.client_id)?.name ?? "";
  }
  function getProductName(id: string | null) {
    if (!id) return "—";
    return products.find((p) => p.id === id)?.name ?? "—";
  }

  function toggleGroup(projId: string) {
    setCollapsed((prev) => ({ ...prev, [projId]: !prev[projId] }));
  }

  const categories = Array.from(new Set(costs.map((c) => c.category)));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Cost Tracker</h1>
          <div className="flex items-center gap-1 rounded-lg bg-[var(--sa-bg)] p-0.5 border border-[var(--sa-border)]">
            {(["costs", "pl"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors", view === v ? "bg-[var(--sa-window)] text-[var(--sa-text-primary)] shadow-sm" : "text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]")}>
                {v === "costs" ? "Costs" : "P&L"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={13} strokeWidth={2.5} /> Add Entry
        </button>
      </div>

      {view === "pl" && <PLView costs={costs} projects={projects} clients={clients} products={products} />}

      <div className={cn("flex-1 overflow-y-auto", view === "pl" && "hidden")}>
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4">
          {[
            { label: "Money In", value: `£${moneyIn.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`, color: "text-[var(--sa-success)]" },
            { label: "Money Out", value: `£${moneyOut.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`, color: "text-[var(--sa-danger)]" },
            { label: "Billable", value: `£${totalBillable.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`, color: "text-[var(--sa-text-primary)]" },
            { label: "Net Balance", value: `£${netBalance.toLocaleString("en-GB", { maximumFractionDigits: 0, signDisplay: "always" })}`, color: netBalance >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]" },
          ].map(({ label, value, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4"
            >
              <p className="text-[10px] uppercase tracking-wider text-[var(--sa-text-tertiary)]">{label}</p>
              <p className={cn("mt-1 font-mono text-[20px] font-semibold", color)}>{value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 px-6 pb-3 flex-wrap">
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterBillable}
            onChange={(e) => setFilterBillable(e.target.value)}
            className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
          >
            <option value="all">Billable: all</option>
            <option value="yes">Billable only</option>
            <option value="no">Non-billable only</option>
          </select>
        </div>

        {/* Table */}
        <div className="px-6 pb-6">
          <div className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-window)]">
            {/* Col headers — desktop only */}
            <div className="hidden sm:grid grid-cols-[24px_120px_1fr_1fr_100px_110px_80px_60px] gap-3 px-4 py-2 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
              {["", "Date", "Product", "Category", "Description", "Amount", "Billable", "Paid by"].map((h) => (
                <span key={h} className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)]">{h}</span>
              ))}
            </div>

            {grouped.length === 0 && (
              <div className="py-12 text-center text-[13px] text-[var(--sa-text-tertiary)]">No costs match your filters.</div>
            )}

            {grouped.map(([projectId, rows]) => {
              const isCollapsed = collapsed[projectId];
              const groupTotal = rows.reduce((s, c) => s + c.amount_gbp, 0);
              return (
                <div key={projectId}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(projectId)}
                    className="flex w-full items-center gap-2 px-4 py-2 bg-[var(--sa-bg)] border-b border-[var(--sa-border)] hover:bg-[var(--sa-hover)] transition-colors"
                  >
                    <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronDown size={12} className="text-[var(--sa-text-tertiary)]" />
                    </motion.div>
                    <span className="text-[12px] font-semibold text-[var(--sa-text-primary)]">{getProjectName(projectId)}</span>
                    <span className="text-[11px] text-[var(--sa-text-tertiary)]">· {getClientName(projectId)}</span>
                    <span className="ml-auto font-mono text-[12px] text-[var(--sa-text-secondary)]">
                      £{groupTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                    </span>
                  </button>

                  {/* Rows */}
                  {!isCollapsed && rows.map((cost) => (
                    <div key={cost.id} className="border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-hover)] transition-colors">
                      {/* Mobile card */}
                      <div className="sm:hidden flex flex-col gap-1 px-4 py-3 text-[12px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {cost.direction === "in"
                              ? <ArrowDownLeft size={12} className="text-[var(--sa-success)]" />
                              : <ArrowUpRight size={12} className="text-[var(--sa-danger)]" />
                            }
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", CATEGORY_COLORS[cost.category])}>{cost.category}</span>
                          </div>
                          <span className={cn("font-mono font-semibold", cost.direction === "in" ? "text-[var(--sa-success)]" : "text-[var(--sa-text-primary)]")}>
                            {cost.direction === "in" ? "+" : ""}£{cost.amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <span className="text-[var(--sa-text-primary)] font-medium">{cost.description}</span>
                        <div className="flex items-center gap-2 text-[var(--sa-text-tertiary)]">
                          <span>{formatDate(cost.date_paid)}</span>
                          <span>·</span>
                          <span>{cost.paid_by}</span>
                          {cost.billable_to_client && <span className="text-[var(--sa-success)] font-medium">· Billable</span>}
                        </div>
                      </div>
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-[24px_120px_1fr_1fr_100px_110px_80px_60px] gap-3 items-center px-4 py-2.5 text-[12px]">
                        <span>
                          {cost.direction === "in"
                            ? <ArrowDownLeft size={13} className="text-[var(--sa-success)]" />
                            : <ArrowUpRight size={13} className="text-[var(--sa-danger)]" />
                          }
                        </span>
                        <span className="text-[var(--sa-text-tertiary)]">{formatDate(cost.date_paid)}</span>
                        <span className="truncate text-[var(--sa-text-secondary)]">{getProductName(cost.product_id)}</span>
                        <span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", CATEGORY_COLORS[cost.category])}>{cost.category}</span></span>
                        <span className="truncate text-[var(--sa-text-primary)]">{cost.description}</span>
                        <span className={cn("font-mono", cost.direction === "in" ? "text-[var(--sa-success)] font-semibold" : "text-[var(--sa-text-primary)]")}>
                          {cost.direction === "in" ? "+" : ""}£{cost.amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                          <span className="text-[10px] text-[var(--sa-text-tertiary)] ml-1">{cost.currency !== "GBP" ? `(${cost.currency} ${cost.amount})` : ""}</span>
                        </span>
                        <span>{cost.billable_to_client ? <span className="text-[11px] text-[var(--sa-success)] font-medium">Yes</span> : <span className="text-[11px] text-[var(--sa-text-tertiary)]">No</span>}</span>
                        <span className="truncate text-[var(--sa-text-secondary)]">{cost.paid_by}</span>
                      </div>
                    </div>
                  ))}

                  {/* Group subtotal */}
                  {!isCollapsed && (
                    <div className="flex items-center justify-end gap-2 px-4 py-2 bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
                      <span className="text-[11px] text-[var(--sa-text-tertiary)]">Subtotal</span>
                      <span className="font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">
                        £{groupTotal.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Grand total */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[var(--sa-bg)]">
              <span className="text-[12px] font-semibold text-[var(--sa-text-secondary)]">Total</span>
              <span className="font-mono text-[15px] font-bold text-[var(--sa-text-primary)]">
                £{(moneyOut - moneyIn).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg bg-[var(--sa-window)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--sa-text-primary)]">Add Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <AddCostForm
              projects={projects}
              products={products}
              clients={clients}
              onClose={() => setShowModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors",
        props.className
      )}
    />
  );
}

function SelectField({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
    >
      {children}
    </select>
  );
}

function AddCostForm({ projects, products, clients, onClose }: {
  projects: Project[];
  products: Product[];
  clients: Client[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("sampling");
  const [currency, setCurrency] = useState("GBP");
  const [amount, setAmount] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [billable, setBillable] = useState(false);
  const [costType, setCostType] = useState<"cogs" | "operating">("operating");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => !projectId || p.project_id === projectId);

  const defaultFx: Record<string, number> = { GBP: 1, USD: 0.79, CNY: 0.11, EUR: 0.86 };

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || !description.trim()) { setError("Description and amount are required."); return; }
    if (direction === "out" && !projectId) { setError("Project is required for expenses."); return; }

    setSaving(true);
    setError(null);

    const fx = parseFloat(fxRate) || defaultFx[currency] || 1;
    const amtGbp = Math.round(amt * fx * 100) / 100;

    const { error: err } = await supabase.from("costs").insert({
      project_id: projectId || null,
      client_id: clientId || null,
      product_id: productId || null,
      category,
      description: description.trim(),
      amount: amt,
      currency,
      fx_rate: fx,
      amount_gbp: amtGbp,
      direction,
      cost_type: direction === "in" ? "operating" : costType,
      billable_to_client: direction === "in" ? false : billable,
      paid_by: paidBy.trim() || (direction === "in" ? "Client" : "Agency"),
      date_paid: date,
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Direction toggle */}
      <div className="flex rounded-lg border border-[var(--sa-border)] overflow-hidden">
        {(["out", "in"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium transition-colors",
              direction === d
                ? d === "out" ? "bg-[var(--sa-danger)] text-white" : "bg-[var(--sa-success)] text-white"
                : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
            )}
          >
            {d === "out" ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
            {d === "out" ? "Money Out (Expense)" : "Money In (Payment)"}
          </button>
        ))}
      </div>

      {direction === "out" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project *">
              <SelectField value={projectId} onChange={(e) => { setProjectId(e.target.value); setProductId(""); }}>
                <option value="">Select project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectField>
            </Field>
            <Field label="Product">
              <SelectField value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">All products</option>
                {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectField>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <SelectField value={category} onChange={(e) => setCategory(e.target.value)}>
                {["sampling", "shipping", "factory", "travel", "translation", "inspection", "other"].map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </SelectField>
            </Field>
            <Field label="Type">
              <SelectField value={costType} onChange={(e) => setCostType(e.target.value as "cogs" | "operating")}>
                <option value="operating">Operating</option>
                <option value="cogs">COGS</option>
              </SelectField>
            </Field>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client">
            <SelectField value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
          </Field>
          <Field label="Category">
            <SelectField value={category} onChange={(e) => setCategory(e.target.value)}>
              {["sampling", "shipping", "factory", "other"].map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </SelectField>
          </Field>
        </div>
      )}

      <Field label="Description *">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={direction === "in" ? "e.g. Sample invoice R1 payment" : "e.g. DHL sample shipment — R1"} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <SelectField value={currency} onChange={(e) => { setCurrency(e.target.value); setFxRate(""); }}>
            {["GBP", "USD", "CNY", "EUR"].map((c) => <option key={c}>{c}</option>)}
          </SelectField>
        </Field>
        <Field label="Amount *">
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </Field>
      </div>

      {currency !== "GBP" && (
        <Field label={`FX rate (${currency} → GBP) · default ${defaultFx[currency] ?? 1}`}>
          <Input type="number" min="0" step="0.0001" value={fxRate} onChange={(e) => setFxRate(e.target.value)} placeholder={String(defaultFx[currency] ?? "")} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Paid by">
          <Input value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder={direction === "in" ? "Client" : "Agency"} />
        </Field>
      </div>

      {direction === "out" && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="billable" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded accent-[var(--sa-accent)]" />
          <label htmlFor="billable" className="text-[13px] text-[var(--sa-text-secondary)]">Billable to client</label>
        </div>
      )}

      {error && <p className="text-[12px] text-[var(--sa-danger)]">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn("flex-1 rounded-lg py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50",
            direction === "in" ? "bg-[var(--sa-success)]" : "bg-[var(--sa-accent)]"
          )}
        >
          {saving ? "Saving…" : direction === "in" ? "Record Payment" : "Add Expense"}
        </button>
      </div>
    </div>
  );
}
