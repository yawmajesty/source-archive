"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Send, CheckCircle2, FileText, Factory as FactoryIcon, Wallet, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, Product, Project, SavedInvoice, InvoiceLineItem, AgencySettings } from "@/lib/data";
import { createProjectQuote, sendQuote, deleteQuote } from "./actions";
import { downloadInvoicePDF } from "@/lib/invoice-pdf";

const SERVICE_PRESETS: string[] = [
  "Design",
  "Techpacking",
  "Sourcing fee",
  "Production management",
  "Quality control",
];

interface ServiceLine {
  id: string;
  name: string;
  amount: number;
}

interface Props {
  project: Project;
  client: Client;
  products: Product[];
  savedInvoices: SavedInvoice[];
  agencySettings: AgencySettings;
}

const STATUS_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--sa-hover)", fg: "var(--sa-text-secondary)" },
  sent:  { label: "Sent",  bg: "#FAEEDA",          fg: "#633806" },
  paid:  { label: "Paid",  bg: "#EAF3DE",          fg: "#27500A" },
};

type InvoiceKind = "sampling" | "production";

// Pick best available per-unit production price for a product.
function defaultProductionUnitPrice(p: Product): number {
  return p.client_unit_price_usd ?? p.quoted_cost_usd ?? p.target_cost_usd ?? 0;
}

function defaultProductionQty(p: Product): number {
  return p.order_qty ?? p.moq ?? 0;
}

export function QuoteBuilder({ project, client, products: allProducts, savedInvoices, agencySettings }: Props) {
  // Exclude products marked as not going to production from invoice building.
  const products = allProducts.filter((p) => !p.production_excluded_at);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<InvoiceKind>("sampling");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Sampling: amounts[id] = sample fee. Production: per-product qty/unit-price drive amount.
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [depositPct, setDepositPct] = useState<number>(100);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const svcIdRef = useRef(0);

  const nextRound = savedInvoices.length > 0 ? Math.max(...savedInvoices.map((i) => i.round)) + 1 : 1;

  const productsTotal = Array.from(selected).reduce((s, id) => {
    if (kind === "production") {
      const qty = qtys[id] ?? 0;
      const price = unitPrices[id] ?? 0;
      return s + qty * price;
    }
    return s + (amounts[id] ?? 0);
  }, 0);
  const servicesTotal = serviceLines.reduce((s, l) => s + (l.amount || 0), 0);
  const projectTotal = productsTotal + servicesTotal;
  const amountDueNow = projectTotal * (depositPct / 100);
  const balanceRemaining = projectTotal - amountDueNow;

  function initSamplingState() {
    const withFees = products.filter((p) => (p.sample_fee_usd ?? 0) > 0);
    setSelected(new Set(withFees.map((p) => p.id)));
    setAmounts(Object.fromEntries(products.map((p) => [p.id, p.sample_fee_usd ?? 0])));
    setQtys({});
    setUnitPrices({});
  }

  function initProductionState() {
    const withPrice = products.filter((p) => defaultProductionUnitPrice(p) > 0 && defaultProductionQty(p) > 0);
    setSelected(new Set(withPrice.map((p) => p.id)));
    setAmounts({});
    setQtys(Object.fromEntries(products.map((p) => [p.id, defaultProductionQty(p)])));
    setUnitPrices(Object.fromEntries(products.map((p) => [p.id, defaultProductionUnitPrice(p)])));
  }

  function openBuilder(forKind: InvoiceKind = "sampling") {
    setKind(forKind);
    setDepositPct(forKind === "production" ? 50 : 100);
    if (forKind === "production") initProductionState(); else initSamplingState();
    setServiceLines([]);
    setShowBuilder(true);
  }

  function switchKind(next: InvoiceKind) {
    if (next === kind) return;
    setKind(next);
    setDepositPct(next === "production" ? 50 : 100);
    if (next === "production") initProductionState(); else initSamplingState();
  }

  function toggleProduct(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function addService(name: string) {
    svcIdRef.current += 1;
    setServiceLines((prev) => [...prev, { id: `svc-${svcIdRef.current}`, name, amount: 0 }]);
  }

  function updateService(id: string, patch: Partial<ServiceLine>) {
    setServiceLines((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  }

  function removeService(id: string) {
    setServiceLines((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSave() {
    const productItems: InvoiceLineItem[] = Array.from(selected).map((id) => {
      const p = products.find((p) => p.id === id)!;
      if (kind === "production") {
        const qty = qtys[id] ?? 0;
        const unit = unitPrices[id] ?? 0;
        const firstImage = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
        return {
          name: p.name,
          category: p.category,
          project_name: project.name,
          amount_usd: qty * unit,
          expected_date: null,
          kind: "product",
          qty,
          unit_price_usd: unit,
          image_url: firstImage,
        };
      }
      return {
        name: p.name,
        category: p.category,
        project_name: project.name,
        amount_usd: amounts[id] ?? p.sample_fee_usd ?? 0,
        expected_date: p.expected_sample_date ?? null,
        kind: "product",
      };
    });
    const serviceItems: InvoiceLineItem[] = serviceLines
      .filter((l) => l.name.trim() && l.amount > 0)
      .map((l) => ({
        name: l.name.trim(),
        category: "Service",
        project_name: project.name,
        amount_usd: l.amount,
        expected_date: null,
        kind: "service",
      }));
    if (productItems.length === 0 && serviceItems.length === 0) return;
    setSaving(true);
    await createProjectQuote({
      client_id: client.id,
      project_id: project.id,
      round: nextRound,
      line_items: [...productItems, ...serviceItems],
      invoice_kind: kind,
      deposit_percent: depositPct,
      title: kind === "production" ? `Production invoice` : null,
    });
    setSaving(false);
    setShowBuilder(false);
    startTransition(() => router.refresh());
  }

  async function handleSend(id: string) {
    await sendQuote(id, client.id, project.id);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string, round: number) {
    if (!window.confirm(`Delete Round ${round} quote? This cannot be undone.`)) return;
    await deleteQuote(id, client.id, project.id);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--sa-bg)]">
      <div className="px-6 py-5 max-w-3xl mx-auto w-full space-y-5">
        {/* Header + New quote buttons */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Quotes & invoices</h2>
            <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">
              Sampling quotes and production invoices for {client.name}
            </p>
          </div>
          {!showBuilder && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openBuilder("sampling")}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
              >
                <Plus size={12} /> Sampling quote
              </button>
              <button
                onClick={() => openBuilder("production")}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
              >
                <FactoryIcon size={12} /> Production invoice
              </button>
            </div>
          )}
        </div>

        {/* Builder panel */}
        {showBuilder && (
          <div className="rounded-xl overflow-hidden border border-[var(--sa-border)] bg-[var(--sa-window)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
              <div>
                <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">
                  Round {nextRound} — New {kind === "production" ? "production invoice" : "sampling quote"}
                </p>
                <p className="text-[11px] mt-0.5 text-[var(--sa-text-tertiary)]">
                  {kind === "production"
                    ? "Set quantity and unit price per product, then choose how much to invoice now"
                    : "Select products and add any services"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-[var(--sa-border)] overflow-hidden">
                  <button
                    onClick={() => switchKind("sampling")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium transition-colors",
                      kind === "sampling" ? "bg-[var(--sa-accent)] text-white" : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
                    )}
                  >
                    Sampling
                  </button>
                  <button
                    onClick={() => switchKind("production")}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium transition-colors border-l border-[var(--sa-border)]",
                      kind === "production" ? "bg-[var(--sa-accent)] text-white" : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
                    )}
                  >
                    Production
                  </button>
                </div>
                <button onClick={() => setShowBuilder(false)} className="p-1 rounded text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Products section */}
            <div className="px-5 py-4 border-b border-[var(--sa-border)]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-3">
                Products in this collection
              </p>
              {products.length === 0 ? (
                <p className="text-[12px] text-[var(--sa-text-tertiary)]">No products in this collection yet.</p>
              ) : (
                <div className="rounded-lg border border-[var(--sa-border)] overflow-hidden">
                  {products.map((p, i) => (
                    <div
                      key={p.id}
                      className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                        selected.has(p.id) && "bg-[var(--sa-accent)]/5",
                        i < products.length - 1 && "border-b border-[var(--sa-border)]"
                      )}
                      onClick={() => toggleProduct(p.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ accentColor: "var(--sa-accent)", width: 14, height: 14, flexShrink: 0 }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--sa-text-tertiary)]">
                          {p.category || "—"}{(p.sample_round ?? 1) > 1 ? ` · R${p.sample_round}` : ""}
                        </p>
                      </div>
                      {selected.has(p.id) && kind === "sampling" && (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[11px] text-[var(--sa-text-tertiary)]">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amounts[p.id] ?? 0}
                            onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                            className="rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[12px] font-mono outline-none w-24 text-right text-[var(--sa-text-primary)]"
                          />
                        </div>
                      )}
                      {selected.has(p.id) && kind === "production" && (() => {
                        const qty = qtys[p.id] ?? 0;
                        const unit = unitPrices[p.id] ?? 0;
                        return (
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={qty}
                                onChange={(e) => setQtys((prev) => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                                className="rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[12px] font-mono outline-none w-20 text-right text-[var(--sa-text-primary)]"
                                placeholder="Qty"
                              />
                              <span className="text-[11px] text-[var(--sa-text-tertiary)]">×</span>
                              <span className="text-[11px] text-[var(--sa-text-tertiary)]">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={unit}
                                onChange={(e) => setUnitPrices((prev) => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                className="rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[12px] font-mono outline-none w-20 text-right text-[var(--sa-text-primary)]"
                                placeholder="Unit"
                              />
                            </div>
                            <span className="font-mono text-[12px] font-semibold text-[var(--sa-text-primary)] w-24 text-right whitespace-nowrap">
                              ${(qty * unit).toFixed(2)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Services section */}
            <div className="px-5 py-4 border-b border-[var(--sa-border)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">Services</p>
                <p className="text-[10px] text-[var(--sa-text-tertiary)]">Add design, techpacking and other fees</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SERVICE_PRESETS.map((name) => (
                  <button
                    key={name}
                    onClick={() => addService(name)}
                    className="flex items-center gap-1 rounded-full border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)] transition-colors"
                  >
                    <Plus size={10} /> {name}
                  </button>
                ))}
                <button
                  onClick={() => addService("")}
                  className="flex items-center gap-1 rounded-full border border-dashed border-[var(--sa-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text-tertiary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)] transition-colors"
                >
                  <Plus size={10} /> Custom
                </button>
              </div>
              {serviceLines.length > 0 && (
                <div className="rounded-lg border border-[var(--sa-border)] overflow-hidden">
                  {serviceLines.map((line, i) => (
                    <div
                      key={line.id}
                      className={cn("flex items-center gap-2 px-3 py-2",
                        i < serviceLines.length - 1 && "border-b border-[var(--sa-border)]"
                      )}
                    >
                      <input
                        type="text"
                        placeholder="Service name"
                        value={line.name}
                        onChange={(e) => updateService(line.id, { name: e.target.value })}
                        className="flex-1 rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[12px] outline-none min-w-0 text-[var(--sa-text-primary)]"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-[var(--sa-text-tertiary)]">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.amount}
                          onChange={(e) => updateService(line.id, { amount: parseFloat(e.target.value) || 0 })}
                          className="rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[12px] font-mono outline-none w-24 text-right text-[var(--sa-text-primary)]"
                        />
                      </div>
                      <button onClick={() => removeService(line.id)} className="p-1 rounded text-[var(--sa-text-tertiary)] hover:text-red-500">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deposit section (production only) */}
            {kind === "production" && (
              <div className="px-5 py-4 border-b border-[var(--sa-border)]">
                <div className="flex items-center justify-between mb-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                    <Wallet size={11} /> Invoice now
                  </p>
                  <p className="text-[10px] text-[var(--sa-text-tertiary)]">How much to bill on this invoice — balance can be sent later</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {[25, 30, 50, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setDepositPct(pct)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                        depositPct === pct
                          ? "border-[var(--sa-accent)] bg-[var(--sa-accent)] text-white"
                          : "border-[var(--sa-border)] bg-[var(--sa-bg)] text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)]",
                      )}
                    >
                      {pct === 100 ? "100% (full)" : `${pct}% deposit`}
                    </button>
                  ))}
                </div>

                {/* Custom amount — either as a percentage OR as a raw dollar
                    figure. Both inputs write to depositPct so the source of
                    truth stays a single value. */}
                <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] text-[var(--sa-text-tertiary)]">
                  <span>Or enter a custom amount:</span>
                  <div className="flex items-center gap-1">
                    <span>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={Number.isFinite(amountDueNow) ? amountDueNow.toFixed(2) : ""}
                      onChange={(e) => {
                        const dollars = parseFloat(e.target.value);
                        if (!Number.isFinite(dollars) || projectTotal <= 0) return;
                        const nextPct = (dollars / projectTotal) * 100;
                        setDepositPct(Math.max(0, Math.min(100, nextPct)));
                      }}
                      disabled={projectTotal <= 0}
                      className="rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[11px] font-mono outline-none w-28 text-right text-[var(--sa-text-primary)] disabled:opacity-50"
                    />
                  </div>
                  <span className="text-[var(--sa-text-tertiary)]">or</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={Number(depositPct.toFixed(2))}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) setDepositPct(Math.max(0, Math.min(100, v)));
                      }}
                      className="rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[11px] font-mono outline-none w-20 text-right text-[var(--sa-text-primary)]"
                    />
                    <span>%</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Project total</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--sa-text-primary)]">${projectTotal.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--sa-accent)] bg-[var(--sa-accent)]/5 p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--sa-accent)] font-semibold">Due now ({depositPct.toFixed(depositPct % 1 === 0 ? 0 : 2)}%)</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--sa-text-primary)]">${amountDueNow.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] p-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Balance</p>
                    <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--sa-text-primary)]">${balanceRemaining.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-[var(--sa-bg)]">
              <div>
                <span className="text-[11px] text-[var(--sa-text-tertiary)]">
                  {selected.size} product{selected.size !== 1 ? "s" : ""}
                  {serviceLines.length > 0 && ` · ${serviceLines.length} service${serviceLines.length !== 1 ? "s" : ""}`}
                </span>
                <span className="mx-2 text-[11px] text-[var(--sa-border)]">·</span>
                <span className="font-mono text-[13px] font-semibold text-[var(--sa-text-primary)]">
                  ${kind === "production" ? amountDueNow.toFixed(2) : projectTotal.toFixed(2)}
                </span>
                {kind === "production" && depositPct < 100 && (
                  <span className="ml-1 text-[10px] text-[var(--sa-text-tertiary)]">
                    ({depositPct.toFixed(depositPct % 1 === 0 ? 0 : 2)}% of ${projectTotal.toFixed(2)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowBuilder(false)} className="rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (selected.size === 0 && serviceLines.length === 0)}
                  className="rounded-lg bg-[var(--sa-accent)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? "Saving…" : "Save as draft"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saved quotes list */}
        {savedInvoices.length === 0 && !showBuilder ? (
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-8 text-center">
            <FileText size={24} className="text-[var(--sa-text-tertiary)] mx-auto mb-2" />
            <p className="text-[13px] text-[var(--sa-text-secondary)]">No quotes yet for this client.</p>
            <p className="text-[11px] text-[var(--sa-text-tertiary)] mt-1">Click "New quote" to build one.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {savedInvoices.slice().sort((a, b) => b.round - a.round).map((inv) => {
              const total = inv.line_items.reduce((s, li) => s + li.amount_usd, 0);
              const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.draft;
              const isProduction = inv.invoice_kind === "production";
              const deposit = inv.deposit_percent ?? 100;
              const dueNow = total * (deposit / 100);
              return (
                <div key={inv.id} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium leading-none" style={{ backgroundColor: cfg.bg, color: cfg.fg }}>
                        {cfg.label}
                      </span>
                      <span className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                        isProduction ? "bg-[var(--sa-accent)]/10 text-[var(--sa-accent)]" : "bg-[var(--sa-hover)] text-[var(--sa-text-secondary)]",
                      )}>
                        {isProduction ? <><FactoryIcon size={9} /> Production</> : <><FileText size={9} /> Sampling</>}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">
                          {isProduction ? "Production" : `Round ${inv.round}`}
                        </p>
                        <p className="text-[10px] text-[var(--sa-text-tertiary)]">
                          {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}{inv.line_items.length} line item{inv.line_items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-mono text-[14px] font-bold text-[var(--sa-text-primary)]">${(isProduction ? dueNow : total).toFixed(2)}</p>
                        {isProduction && deposit < 100 && (
                          <p className="text-[10px] text-[var(--sa-text-tertiary)]">{deposit}% of ${total.toFixed(2)}</p>
                        )}
                      </div>
                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleSend(inv.id)}
                          className="flex items-center gap-1 rounded-lg bg-[var(--sa-accent)] px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
                          title="Send to client"
                        >
                          <Send size={11} /> Send
                        </button>
                      )}
                      {inv.status !== "draft" && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                          <CheckCircle2 size={11} /> Visible to client
                        </span>
                      )}
                      <button
                        onClick={() => downloadInvoicePDF(inv, client, agencySettings)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
                        title="Download PDF"
                      >
                        <Download size={11} /> PDF
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id, inv.round)}
                        className="rounded p-1.5 text-[var(--sa-text-tertiary)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-[var(--sa-border)]">
                    {inv.line_items.map((li, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{li.name}</p>
                          {(li.category || li.project_name) && (
                            <p className="text-[10px] text-[var(--sa-text-tertiary)] mt-0.5">
                              {[li.category, li.project_name].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {li.qty != null && li.unit_price_usd != null && (
                            <p className="text-[10px] text-[var(--sa-text-tertiary)]">
                              {li.qty.toLocaleString()} × ${li.unit_price_usd.toFixed(2)}
                            </p>
                          )}
                          <span className="font-mono text-[12px] font-semibold text-[var(--sa-text-primary)] whitespace-nowrap">
                            ${li.amount_usd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
