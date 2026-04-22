"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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

function PLView({ costs, projects, clients }: { costs: Cost[]; projects: Project[]; clients: Client[] }) {
  const gbp = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const byProject = projects.map((proj) => {
    const pc = costs.filter((c) => c.project_id === proj.id);
    const revenue   = pc.filter((c) => c.direction === "in").reduce((s, c) => s + c.amount_gbp, 0);
    const cogs      = pc.filter((c) => c.direction === "out" && c.cost_type === "cogs").reduce((s, c) => s + c.amount_gbp, 0);
    const operating = pc.filter((c) => c.direction === "out" && c.cost_type === "operating").reduce((s, c) => s + c.amount_gbp, 0);
    const gross     = revenue - cogs;
    const net       = gross - operating;
    const margin    = revenue > 0 ? (gross / revenue) * 100 : null;
    const clientName = clients.find((c) => c.id === proj.client_id)?.name ?? "";
    return { proj, clientName, revenue, cogs, operating, gross, net, margin };
  }).filter((r) => r.revenue + r.cogs + r.operating > 0);

  const totals = byProject.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue, cogs: acc.cogs + r.cogs,
    operating: acc.operating + r.operating, gross: acc.gross + r.gross, net: acc.net + r.net,
  }), { revenue: 0, cogs: 0, operating: 0, gross: 0, net: 0 });

  const TH = ({ c }: { c: string }) => (
    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] whitespace-nowrap">{c}</th>
  );
  const TD = ({ v, bold, pos }: { v: string; bold?: boolean; pos?: boolean }) => (
    <td className={cn("px-4 py-3 font-mono text-[12px] text-right whitespace-nowrap", bold ? "font-semibold text-[var(--sa-text-primary)]" : "text-[var(--sa-text-secondary)]", pos && parseFloat(v.replace(/[^-\d.]/g, "")) < 0 ? "text-[var(--sa-danger)]" : pos ? "text-[var(--sa-success)]" : "")}>{v}</td>
  );

  return (
    <div className="px-6 pb-6 flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4">
        {[
          { label: "Revenue",   value: gbp(totals.revenue),   sub: "Agency fees in" },
          { label: "COGS",      value: gbp(totals.cogs),       sub: "Billable production costs" },
          { label: "Gross profit", value: gbp(totals.gross),   sub: totals.revenue > 0 ? `${((totals.gross/totals.revenue)*100).toFixed(0)}% margin` : "—" },
          { label: "Operating", value: gbp(totals.operating),  sub: "Internal overhead" },
          { label: "Net profit",value: gbp(totals.net),        sub: "After all costs" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
            <p className="text-[10px] uppercase tracking-wider text-[var(--sa-text-tertiary)]">{label}</p>
            <p className={cn("mt-1 font-mono text-[18px] font-semibold", (label === "Gross profit" || label === "Net profit") && totals.net < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-text-primary)]")}>{value}</p>
            <p className="text-[10px] text-[var(--sa-text-tertiary)] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Per-project table */}
      <div className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-window)]">
        <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
            <tr>
              <TH c="Project" /><TH c="Client" /><TH c="Revenue" /><TH c="COGS" /><TH c="Gross profit" /><TH c="Gross margin" /><TH c="Operating" /><TH c="Net profit" />
            </tr>
          </thead>
          <tbody>
            {byProject.map(({ proj, clientName, revenue, cogs, gross, operating, net, margin }, i) => (
              <tr key={proj.id} className={cn("border-b border-[var(--sa-border)]", i % 2 === 1 ? "bg-[var(--sa-bg)]/50" : "")}>
                <td className="px-4 py-3 text-[12px] font-medium text-[var(--sa-text-primary)]">{proj.name}</td>
                <td className="px-4 py-3 text-[12px] text-[var(--sa-text-secondary)]">{clientName}</td>
                <TD v={gbp(revenue)} />
                <TD v={gbp(cogs)} />
                <TD v={gbp(gross)} pos bold />
                <td className={cn("px-4 py-3 font-mono text-[12px] text-right", margin !== null && margin < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]")}>
                  {margin !== null ? `${margin.toFixed(0)}%` : "—"}
                </td>
                <TD v={gbp(operating)} />
                <TD v={gbp(net)} pos bold />
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[var(--sa-bg)] border-t-2 border-[var(--sa-border-strong)]">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-[12px] font-semibold text-[var(--sa-text-secondary)]">Total</td>
              <TD v={gbp(totals.revenue)} bold />
              <TD v={gbp(totals.cogs)} bold />
              <TD v={gbp(totals.gross)} pos bold />
              <td className={cn("px-4 py-3 font-mono text-[12px] text-right font-semibold", totals.revenue > 0 && (totals.gross/totals.revenue)*100 < 0 ? "text-[var(--sa-danger)]" : "text-[var(--sa-success)]")}>
                {totals.revenue > 0 ? `${((totals.gross/totals.revenue)*100).toFixed(0)}%` : "—"}
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
      const group = map.get(c.project_id) ?? [];
      group.push(c);
      map.set(c.project_id, group);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const totalSpent = filtered.reduce((s, c) => s + c.amount_gbp, 0);
  const totalBillable = filtered.filter((c) => c.billable_to_client).reduce((s, c) => s + c.amount_gbp, 0);
  const netOverhead = totalSpent - totalBillable;

  function getProjectName(id: string) {
    return projects.find((p) => p.id === id)?.name ?? id;
  }
  function getClientName(projectId: string) {
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
          <Plus size={13} strokeWidth={2.5} /> Add Cost
        </button>
      </div>

      {view === "pl" && <PLView costs={costs} projects={projects} clients={clients} />}

      <div className={cn("flex-1 overflow-y-auto", view === "pl" && "hidden")}>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4">
          {[
            { label: "Total Spent", value: `£${totalSpent.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` },
            { label: "Total Billable", value: `£${totalBillable.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` },
            { label: "Net Overhead", value: `£${netOverhead.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` },
          ].map(({ label, value }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4"
            >
              <p className="text-[10px] uppercase tracking-wider text-[var(--sa-text-tertiary)]">{label}</p>
              <p className="mt-1 font-mono text-[20px] font-semibold text-[var(--sa-text-primary)]">{value}</p>
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
            <div className="hidden sm:grid grid-cols-[120px_1fr_1fr_100px_100px_80px_60px] gap-3 px-4 py-2 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
              {["Date", "Product", "Category", "Description", "Amount", "Billable", "Paid by"].map((h) => (
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
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", CATEGORY_COLORS[cost.category])}>{cost.category}</span>
                          <span className="font-mono font-semibold text-[var(--sa-text-primary)]">£{cost.amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
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
                      <div className="hidden sm:grid grid-cols-[120px_1fr_1fr_100px_100px_80px_60px] gap-3 items-center px-4 py-2.5 text-[12px]">
                        <span className="text-[var(--sa-text-tertiary)]">{formatDate(cost.date_paid)}</span>
                        <span className="truncate text-[var(--sa-text-secondary)]">{getProductName(cost.product_id)}</span>
                        <span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", CATEGORY_COLORS[cost.category])}>{cost.category}</span></span>
                        <span className="truncate text-[var(--sa-text-primary)]">{cost.description}</span>
                        <span className="font-mono text-[var(--sa-text-primary)]">
                          £{cost.amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
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
                £{totalSpent.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Cost Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg bg-[var(--sa-window)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--sa-text-primary)]">Add Cost</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <AddCostForm
              projects={projects}
              products={products}
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

function AddCostForm({ projects, products, onClose }: { projects: Project[]; products: Product[]; onClose: () => void }) {
  const [projectId, setProjectId] = useState("");
  const [currency, setCurrency] = useState("GBP");

  const filteredProducts = products.filter((p) => !projectId || p.project_id === projectId);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project">
          <SelectField value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Select project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
        </Field>
        <Field label="Product">
          <SelectField>
            <option value="">All products</option>
            {filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <SelectField>
            {["sampling", "shipping", "factory", "travel", "translation", "inspection", "other"].map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Currency">
          <SelectField value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {["GBP", "USD", "CNY", "EUR"].map((c) => <option key={c}>{c}</option>)}
          </SelectField>
        </Field>
      </div>
      <Field label="Description">
        <Input placeholder="e.g. DHL sample shipment — R1" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <Input type="number" placeholder="0.00" />
        </Field>
        {currency !== "GBP" && (
          <Field label="FX Rate (to GBP)">
            <Input type="number" placeholder="e.g. 0.79" step="0.001" />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid by">
          <Input placeholder="Agency or Client" />
        </Field>
        <Field label="Date paid">
          <Input type="date" />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="billable" className="rounded" />
        <label htmlFor="billable" className="text-[13px] text-[var(--sa-text-secondary)]">
          Billable to client
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          Add Cost
        </button>
      </div>
    </div>
  );
}
