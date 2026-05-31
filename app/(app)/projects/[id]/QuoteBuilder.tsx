"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Send, CheckCircle2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, Product, Project, SavedInvoice, InvoiceLineItem } from "@/lib/data";
import { createProjectQuote, sendQuote, deleteQuote } from "./actions";

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
}

const STATUS_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--sa-hover)", fg: "var(--sa-text-secondary)" },
  sent:  { label: "Sent",  bg: "#FAEEDA",          fg: "#633806" },
  paid:  { label: "Paid",  bg: "#EAF3DE",          fg: "#27500A" },
};

export function QuoteBuilder({ project, client, products, savedInvoices }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showBuilder, setShowBuilder] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);
  const svcIdRef = useRef(0);

  const nextRound = savedInvoices.length > 0 ? Math.max(...savedInvoices.map((i) => i.round)) + 1 : 1;
  const productsTotal = Array.from(selected).reduce((s, id) => s + (amounts[id] ?? 0), 0);
  const servicesTotal = serviceLines.reduce((s, l) => s + (l.amount || 0), 0);
  const totalDue = productsTotal + servicesTotal;

  function openBuilder() {
    const withFees = products.filter((p) => (p.sample_fee_usd ?? 0) > 0);
    setSelected(new Set(withFees.map((p) => p.id)));
    setAmounts(Object.fromEntries(products.map((p) => [p.id, p.sample_fee_usd ?? 0])));
    setServiceLines([]);
    setShowBuilder(true);
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
        {/* Header + New quote button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Sampling quotes</h2>
            <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">
              Build a quote with this collection's products and services for {client.name}
            </p>
          </div>
          {!showBuilder && (
            <button
              onClick={openBuilder}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={12} /> New quote
            </button>
          )}
        </div>

        {/* Builder panel */}
        {showBuilder && (
          <div className="rounded-xl overflow-hidden border border-[var(--sa-border)] bg-[var(--sa-window)]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
              <div>
                <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Round {nextRound} — New quote</p>
                <p className="text-[11px] mt-0.5 text-[var(--sa-text-tertiary)]">Select products and add any services</p>
              </div>
              <button onClick={() => setShowBuilder(false)} className="p-1 rounded text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
                <X size={14} />
              </button>
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
                      {selected.has(p.id) && (
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

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-[var(--sa-bg)]">
              <div>
                <span className="text-[11px] text-[var(--sa-text-tertiary)]">
                  {selected.size} product{selected.size !== 1 ? "s" : ""}
                  {serviceLines.length > 0 && ` · ${serviceLines.length} service${serviceLines.length !== 1 ? "s" : ""}`}
                </span>
                <span className="mx-2 text-[11px] text-[var(--sa-border)]">·</span>
                <span className="font-mono text-[13px] font-semibold text-[var(--sa-text-primary)]">${totalDue.toFixed(2)}</span>
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
              return (
                <div key={inv.id} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium leading-none" style={{ backgroundColor: cfg.bg, color: cfg.fg }}>
                        {cfg.label}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Round {inv.round}</p>
                        <p className="text-[10px] text-[var(--sa-text-tertiary)]">
                          {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}{inv.line_items.length} line item{inv.line_items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[14px] font-bold text-[var(--sa-text-primary)]">${total.toFixed(2)}</span>
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
                        <span className="font-mono text-[12px] font-semibold text-[var(--sa-text-primary)] whitespace-nowrap">${li.amount_usd.toFixed(2)}</span>
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
