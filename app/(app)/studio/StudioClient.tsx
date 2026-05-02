"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, Calculator, Upload, X, Plus, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, Check, Loader2, Pencil, ScanLine, DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  analyzeReceipt, createExpense, updateExpense, deleteExpense,
  createCostingProduct, updateCostingProduct, deleteCostingProduct,
  createCostingItem, updateCostingItem, deleteCostingItem,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────
interface Expense {
  id: string; date: string; description: string; vendor: string | null;
  amount: number; currency: string; category: string;
  project_tag: string | null; image_url: string | null; notes: string | null;
  created_at: string;
}
interface CostProduct {
  id: string; name: string; product_type: string | null; project_tag: string | null;
  base_currency: string; target_price: number | null; notes: string | null; created_at: string;
}
interface CostItem {
  id: string; product_id: string; description: string; category: string;
  quantity: number; unit_amount: number; currency: string; created_at: string;
}
interface Props {
  initialExpenses: Expense[];
  initialProducts: CostProduct[];
  initialItems: CostItem[];
}

// ── Config ────────────────────────────────────────────────────
const CURRENCIES = ["CNY", "USD", "GBP", "EUR", "HKD", "JPY"];

const DEFAULT_RATES: Record<string, number> = { CNY: 7.25, EUR: 0.92, GBP: 0.79, HKD: 7.82, JPY: 154 }; // per 1 USD

const EXPENSE_CATS: Record<string, { label: string; color: string }> = {
  meals:         { label: "Meals",          color: "#F59E0B" },
  transport:     { label: "Transport",      color: "#6366F1" },
  accommodation: { label: "Accommodation",  color: "#EC4899" },
  samples:       { label: "Samples",        color: "#8B5CF6" },
  materials:     { label: "Materials",      color: "#10B981" },
  shipping:      { label: "Shipping",       color: "#0EA5E9" },
  photography:   { label: "Photography",    color: "#F97316" },
  studio:        { label: "Studio / Space", color: "#14B8A6" },
  duties:        { label: "Duties & Tax",   color: "#DC2626" },
  software:      { label: "Software",       color: "#7C3AED" },
  other:         { label: "Other",          color: "#6B7280" },
};

const COST_CATS: Record<string, string> = {
  fabric: "Fabric", trims: "Trims & Hardware", packaging: "Packaging",
  labour: "Labour", samples: "Samples", photography: "Photography",
  shipping: "Shipping", duties: "Duties", other: "Other",
};

const PRODUCT_TYPES = ["Fashion", "Jewellery", "Accessories", "Art", "Other"];

// ── Helpers ───────────────────────────────────────────────────
function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function toUSD(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === "USD") return amount;
  const rate = rates[currency];
  if (!rate) return amount;
  return amount / rate;
}

function calcMargin(cogs: number, price: number) {
  if (!price || price <= cogs) return 0;
  return ((price - cogs) / price) * 100;
}

function priceForMargin(cogs: number, margin: number) {
  return cogs / (1 - margin / 100);
}

function CatPill({ cat }: { cat: string }) {
  const cfg = EXPENSE_CATS[cat] ?? EXPENSE_CATS.other;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap"
      style={{ background: cfg.color + "22", color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── EXPENSES TAB ──────────────────────────────────────────────
function ExpensesTab({ expenses: initial, rates }: { expenses: Expense[]; rates: Record<string, number> }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initial);
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);

  // Add form state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), description: "", vendor: "", amount: "", currency: "CNY", category: "other", project_tag: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = filter === "all" ? expenses : expenses.filter((e) => e.category === filter);

  // Stats
  const totalByCurrency: Record<string, number> = {};
  for (const e of expenses) {
    totalByCurrency[e.currency] = (totalByCurrency[e.currency] ?? 0) + e.amount;
  }
  const totalUSD = expenses.reduce((s, e) => s + toUSD(e.amount, e.currency, rates), 0);

  const byCat: Record<string, number> = {};
  for (const e of expenses) {
    byCat[e.category] = (byCat[e.category] ?? 0) + toUSD(e.amount, e.currency, rates);
  }
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);

  function resetForm() {
    setImageFile(null); setImagePreview(null); setAiResult(null);
    setForm({ date: new Date().toISOString().slice(0, 10), description: "", vendor: "", amount: "", currency: "CNY", category: "other", project_tag: "", notes: "" });
  }

  function handleFileSelect(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setAiResult(null);
  }

  async function handleAnalyze() {
    if (!imageFile || !imagePreview) return;
    setAnalyzing(true);
    const base64 = imagePreview.split(",")[1];
    const mediaType = imageFile.type;
    const result = await analyzeReceipt(base64, mediaType);
    setAnalyzing(false);
    if (result) {
      setAiResult(result);
      setForm((f) => ({
        ...f,
        amount: result.amount != null ? String(result.amount) : f.amount,
        currency: result.currency ?? f.currency,
        vendor: result.vendor ?? f.vendor,
        date: result.date ?? f.date,
        description: result.description || f.description,
        category: result.suggested_category ?? f.category,
      }));
    }
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);

    // Upload image to Supabase if present
    let imageUrl: string | null = null;
    if (imageFile) {
      const path = `receipts/${Date.now()}-${imageFile.name}`;
      const { data } = await supabase.storage.from("brand-receipts").upload(path, imageFile, { upsert: true });
      if (data) {
        const { data: urlData } = supabase.storage.from("brand-receipts").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const newExpense = await createExpense({
      date: form.date,
      description: form.description.trim(),
      vendor: form.vendor.trim() || null,
      amount: parseFloat(form.amount),
      currency: form.currency,
      category: form.category,
      project_tag: form.project_tag.trim() || null,
      image_url: imageUrl,
      notes: form.notes.trim() || null,
    });

    setSaving(false);
    setShowAdd(false);
    resetForm();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setSelected(null);
    await deleteExpense(id);
  }

  return (
    <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex">
      {/* Left: list + stats */}
      <div className="flex flex-col overflow-hidden bg-[var(--sa-window)] border-b md:border-b-0 md:w-[42%]" style={{ borderRight: "1px solid var(--sa-border)" }}>
        {/* Stats */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] text-[var(--sa-text-tertiary)]">Total spend (USD equiv.)</p>
            <p className="text-[18px] font-semibold font-mono text-[var(--sa-text-primary)]">{fmt(totalUSD)}</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {topCats.map(([cat, usd]) => (
              <div key={cat} className="flex items-center gap-1 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: EXPENSE_CATS[cat]?.color ?? "#6B7280" }} />
                <span className="text-[var(--sa-text-secondary)]">{EXPENSE_CATS[cat]?.label ?? cat}</span>
                <span className="text-[var(--sa-text-tertiary)]">{fmt(usd)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto shrink-0" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          <button onClick={() => setFilter("all")} className="rounded-full px-3 py-1 text-[11px] whitespace-nowrap shrink-0 transition-colors"
            style={filter === "all" ? { background: "var(--sa-accent)", color: "#fff" } : { border: "1px solid var(--sa-border)", color: "var(--sa-text-secondary)" }}>
            All
          </button>
          {Object.entries(EXPENSE_CATS).map(([id, { label }]) => (
            expenses.some((e) => e.category === id) && (
              <button key={id} onClick={() => setFilter(id)} className="rounded-full px-3 py-1 text-[11px] whitespace-nowrap shrink-0 transition-colors"
                style={filter === id ? { background: "var(--sa-accent)", color: "#fff" } : { border: "1px solid var(--sa-border)", color: "var(--sa-text-secondary)" }}>
                {label}
              </button>
            )
          ))}
        </div>

        {/* Expense list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-[13px] text-[var(--sa-text-tertiary)]">No expenses yet</p>
            </div>
          ) : (
            filtered.map((e) => (
              <button key={e.id} onClick={() => { setSelected(e); setShowAdd(false); }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--sa-hover)]"
                style={{ borderBottom: "1px solid var(--sa-border)", background: selected?.id === e.id ? "var(--sa-selected)" : undefined }}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5" style={{ background: (EXPENSE_CATS[e.category]?.color ?? "#6B7280") + "22" }}>
                  <span className="text-[11px]" style={{ color: EXPENSE_CATS[e.category]?.color ?? "#6B7280" }}>
                    {EXPENSE_CATS[e.category]?.label?.[0] ?? "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{e.description}</p>
                  <p className="text-[10px] text-[var(--sa-text-tertiary)] mt-0.5">{e.vendor ? `${e.vendor} · ` : ""}{e.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold font-mono text-[var(--sa-text-primary)]">{e.currency} {e.amount.toFixed(2)}</p>
                  <CatPill cat={e.category} />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Add button */}
        <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--sa-border)" }}>
          <button onClick={() => { setShowAdd(true); setSelected(null); resetForm(); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-colors bg-[var(--sa-accent)] text-white hover:opacity-90">
            <Plus size={13} /> Add expense
          </button>
        </div>
      </div>

      {/* Right: add form or detail */}
      <div className="flex-1 overflow-y-auto bg-[var(--sa-bg)]">
        {showAdd ? (
          <div className="p-6 flex flex-col gap-5 max-w-lg">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Add expense</p>
              <button onClick={() => setShowAdd(false)} className="text-[var(--sa-text-tertiary)]"><X size={16} /></button>
            </div>

            {/* Image upload */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] block mb-2">Receipt / Screenshot</label>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="receipt" className="w-full max-h-48 object-contain rounded-xl border border-[var(--sa-border)]" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); setAiResult(null); }}
                    className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                    <X size={12} />
                  </button>
                  {!aiResult && (
                    <button onClick={handleAnalyze} disabled={analyzing}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium transition-colors"
                      style={{ background: "var(--sa-accent)", color: "#fff" }}>
                      {analyzing ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                      {analyzing ? "Scanning…" : "Scan with AI"}
                    </button>
                  )}
                  {aiResult?.clarifying_question && (
                    <div className="mt-2 rounded-lg px-3 py-2.5 text-[12px]" style={{ background: "#EDE9FE", color: "#5B21B6" }}>
                      <strong>AI:</strong> {aiResult.clarifying_question}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl py-8 cursor-pointer transition-colors"
                  style={{ border: `2px dashed ${dragOver ? "var(--sa-accent)" : "var(--sa-border)"}`, background: dragOver ? "var(--sa-accent-light)" : "var(--sa-bg)" }}>
                  <Upload size={20} className="text-[var(--sa-text-tertiary)]" />
                  <p className="text-[12px] text-[var(--sa-text-secondary)]">Drop receipt or tap to upload</p>
                  <p className="text-[10px] text-[var(--sa-text-tertiary)]">JPEG, PNG, WEBP · WeChat Pay, Alipay, bank screenshots</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>

            {/* Form fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Amount</label>
                <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="field-input w-full" placeholder="0.00" />
              </div>
              <div>
                <label className="field-label">Currency</label>
                <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="field-input w-full">
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="field-label">Description *</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="field-input w-full" placeholder="What was this for?" />
            </div>
            <div>
              <label className="field-label">Vendor / Merchant</label>
              <input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} className="field-input w-full" placeholder="e.g. 海底捞, Taobao" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="field-input w-full" />
              </div>
              <div>
                <label className="field-label">Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="field-input w-full">
                  {Object.entries(EXPENSE_CATS).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="field-label">Project tag (optional)</label>
              <input value={form.project_tag} onChange={(e) => setForm((f) => ({ ...f, project_tag: e.target.value }))} className="field-input w-full" placeholder="e.g. SS26, AW26 shoot" />
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="field-input w-full resize-none" rows={2} placeholder="Any extra context…" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg py-2 text-[12px] border border-[var(--sa-border)] text-[var(--sa-text-secondary)]">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.description.trim() || !form.amount}
                className="flex-1 rounded-lg py-2 text-[12px] font-medium bg-[var(--sa-accent)] text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save expense"}
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className="p-6 flex flex-col gap-4 max-w-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[17px] font-semibold text-[var(--sa-text-primary)]">{selected.description}</p>
                <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">{selected.vendor ? `${selected.vendor} · ` : ""}{selected.date}</p>
              </div>
              <button onClick={() => handleDelete(selected.id)} className="p-1.5 rounded-lg transition-colors text-[var(--sa-text-tertiary)] hover:text-red-600 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </div>
            {selected.image_url && <img src={selected.image_url} alt="receipt" className="w-full max-h-56 object-contain rounded-xl border border-[var(--sa-border)]" />}
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--sa-window)", border: "1px solid var(--sa-border)" }}>
              <span className="text-[13px] text-[var(--sa-text-secondary)]">Amount</span>
              <span className="text-[20px] font-bold font-mono text-[var(--sa-text-primary)]">{selected.currency} {selected.amount.toFixed(2)}</span>
            </div>
            {selected.currency !== "USD" && <p className="text-[11px] text-[var(--sa-text-tertiary)]">≈ {fmt(toUSD(selected.amount, selected.currency, rates))} at working rate {rates[selected.currency]} {selected.currency}/USD</p>}
            <div className="flex items-center gap-2"><CatPill cat={selected.category} />{selected.project_tag && <span className="text-[11px] text-[var(--sa-text-tertiary)] bg-[var(--sa-bg)] border border-[var(--sa-border)] rounded-full px-2 py-0.5">{selected.project_tag}</span>}</div>
            {selected.notes && <p className="text-[12px] text-[var(--sa-text-secondary)] rounded-xl px-4 py-3" style={{ background: "var(--sa-window)", border: "1px solid var(--sa-border)" }}>{selected.notes}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Receipt size={28} className="text-[var(--sa-text-muted)]" strokeWidth={1.2} />
            <p className="text-[13px] text-[var(--sa-text-tertiary)]">Select an expense or add a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── COST BUILDER TAB ──────────────────────────────────────────
function CostBuilderTab({ products: initial, items: initialItems, rates, onRatesChange }: {
  products: CostProduct[]; items: CostItem[];
  rates: Record<string, number>; onRatesChange: (r: Record<string, number>) => void;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initial);
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [showRates, setShowRates] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductType, setNewProductType] = useState("Fashion");
  const [creatingProduct, setCreatingProduct] = useState(false);

  const selected = products.find((p) => p.id === selectedId) ?? null;
  const selectedItems = items.filter((i) => i.product_id === selectedId);

  // New item state
  const [newItem, setNewItem] = useState({ description: "", category: "fabric", quantity: "1", unit_amount: "", currency: selected?.base_currency ?? "USD" });
  const [savingItem, setSavingItem] = useState(false);

  // Target price state
  const [targetPrice, setTargetPrice] = useState(selected?.target_price ? String(selected.target_price) : "");

  useEffect(() => {
    setTargetPrice(selected?.target_price ? String(selected.target_price) : "");
    setNewItem((n) => ({ ...n, currency: selected?.base_currency ?? "USD" }));
  }, [selectedId, selected?.target_price, selected?.base_currency]);

  // COGS calculation (all items converted to base currency)
  const baseCurrency = selected?.base_currency ?? "USD";
  const cogs = selectedItems.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unit_amount;
    const inBase = baseCurrency === item.currency
      ? lineTotal
      : baseCurrency === "USD"
      ? toUSD(lineTotal, item.currency, rates)
      : toUSD(lineTotal, item.currency, rates) * (rates[baseCurrency] ?? 1);
    return sum + inBase;
  }, 0);

  const target = parseFloat(targetPrice) || 0;
  const margin = target > 0 ? calcMargin(cogs, target) : null;

  async function handleCreateProduct() {
    if (!newProductName.trim()) return;
    setCreatingProduct(true);
    const id = await createCostingProduct({ name: newProductName.trim(), product_type: newProductType, project_tag: null, base_currency: "USD", target_price: null, notes: null });
    const newProd: CostProduct = { id, name: newProductName.trim(), product_type: newProductType, project_tag: null, base_currency: "USD", target_price: null, notes: null, created_at: new Date().toISOString() };
    setProducts((p) => [newProd, ...p]);
    setSelectedId(id);
    setShowNewProduct(false);
    setNewProductName("");
    setCreatingProduct(false);
  }

  async function handleDeleteProduct(id: string) {
    if (!window.confirm("Delete this product and all its costs?")) return;
    setProducts((p) => p.filter((x) => x.id !== id));
    setItems((i) => i.filter((x) => x.product_id !== id));
    setSelectedId(products.find((p) => p.id !== id)?.id ?? null);
    await deleteCostingProduct(id);
  }

  async function handleAddItem() {
    if (!selected || !newItem.description.trim() || !newItem.unit_amount) return;
    setSavingItem(true);
    const id = await createCostingItem({
      product_id: selected.id,
      description: newItem.description.trim(),
      category: newItem.category,
      quantity: parseFloat(newItem.quantity) || 1,
      unit_amount: parseFloat(newItem.unit_amount),
      currency: newItem.currency,
    });
    const item: CostItem = { id, product_id: selected.id, description: newItem.description.trim(), category: newItem.category, quantity: parseFloat(newItem.quantity) || 1, unit_amount: parseFloat(newItem.unit_amount), currency: newItem.currency, created_at: new Date().toISOString() };
    setItems((prev) => [...prev, item]);
    setNewItem({ description: "", category: "fabric", quantity: "1", unit_amount: "", currency: baseCurrency });
    setSavingItem(false);
  }

  async function handleDeleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteCostingItem(id);
  }

  async function handleSaveTargetPrice() {
    if (!selected) return;
    const price = parseFloat(targetPrice) || null;
    await updateCostingProduct(selected.id, { target_price: price });
    setProducts((p) => p.map((x) => x.id === selected.id ? { ...x, target_price: price } : x));
  }

  const MARGIN_TIERS = [
    { label: "Break even", pct: 0 },
    { label: "Wholesale (50%)", pct: 50 },
    { label: "Retail (65%)", pct: 65 },
    { label: "Premium (75%)", pct: 75 },
  ];

  return (
    <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex">
      {/* Left: product list */}
      <div className="flex flex-col overflow-hidden bg-[var(--sa-window)] border-b md:border-b-0 md:w-[35%]" style={{ borderRight: "1px solid var(--sa-border)" }}>
        <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderBottom: "1px solid var(--sa-border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">Products</p>
          <button onClick={() => setShowNewProduct(true)} className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium bg-[var(--sa-accent)] text-white">
            <Plus size={11} /> New
          </button>
        </div>

        {showNewProduct && (
          <div className="px-4 py-3 flex flex-col gap-2 shrink-0" style={{ borderBottom: "1px solid var(--sa-border)", background: "var(--sa-bg)" }}>
            <input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Product name" className="field-input w-full text-[12px]" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateProduct(); if (e.key === "Escape") setShowNewProduct(false); }} />
            <select value={newProductType} onChange={(e) => setNewProductType(e.target.value)} className="field-input w-full text-[12px]">
              {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowNewProduct(false)} className="flex-1 rounded-lg py-1.5 text-[11px] border border-[var(--sa-border)] text-[var(--sa-text-secondary)]">Cancel</button>
              <button onClick={handleCreateProduct} disabled={creatingProduct || !newProductName.trim()} className="flex-1 rounded-lg py-1.5 text-[11px] font-medium bg-[var(--sa-accent)] text-white disabled:opacity-50">
                {creatingProduct ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-[12px] text-[var(--sa-text-tertiary)]">No products yet</p>
            </div>
          ) : (
            products.map((p) => {
              const prodItems = items.filter((i) => i.product_id === p.id);
              const prodCogs = prodItems.reduce((s, i) => s + toUSD(i.quantity * i.unit_amount, i.currency, rates), 0);
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--sa-hover)] transition-colors"
                  style={{ borderBottom: "1px solid var(--sa-border)", background: selectedId === p.id ? "var(--sa-selected)" : undefined }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{p.name}</p>
                    <p className="text-[10px] text-[var(--sa-text-tertiary)] mt-0.5">{p.product_type} · {prodItems.length} cost items</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-semibold font-mono text-[var(--sa-text-primary)]">{fmt(prodCogs)}</p>
                    <p className="text-[9px] text-[var(--sa-text-tertiary)]">COGS (USD)</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Exchange rates */}
        <div className="shrink-0" style={{ borderTop: "1px solid var(--sa-border)" }}>
          <button onClick={() => setShowRates((s) => !s)} className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">
            <span className="font-medium">Working exchange rates</span>
            {showRates ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showRates && (
            <div className="px-4 pb-3 flex flex-col gap-2">
              <p className="text-[10px] text-[var(--sa-text-tertiary)]">Set your current working rates (per 1 USD)</p>
              {Object.entries(rates).map(([cur, rate]) => (
                <div key={cur} className="flex items-center gap-2">
                  <span className="text-[11px] w-8 font-mono text-[var(--sa-text-secondary)]">{cur}</span>
                  <input type="number" value={rate} step="0.01"
                    onChange={(e) => onRatesChange({ ...rates, [cur]: parseFloat(e.target.value) || rate })}
                    className="field-input flex-1 text-[11px] font-mono" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: product detail */}
      {!selected ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[var(--sa-bg)]">
          <Calculator size={28} className="text-[var(--sa-text-muted)]" strokeWidth={1.2} />
          <p className="text-[13px] text-[var(--sa-text-tertiary)]">Select or create a product to build its costs</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-[var(--sa-bg)] p-6 flex flex-col gap-6">
          {/* Product header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[18px] font-semibold text-[var(--sa-text-primary)]">{selected.name}</p>
              <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">{selected.product_type}{selected.project_tag ? ` · ${selected.project_tag}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={baseCurrency} onChange={async (e) => {
                await updateCostingProduct(selected.id, { base_currency: e.target.value });
                setProducts((p) => p.map((x) => x.id === selected.id ? { ...x, base_currency: e.target.value } : x));
              }} className="field-input text-[11px]">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button onClick={() => handleDeleteProduct(selected.id)} className="p-1.5 rounded-lg text-[var(--sa-text-tertiary)] hover:text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Cost items */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sa-border)", background: "var(--sa-window)" }}>
            {/* Header */}
            <div className="grid px-4 py-2.5" style={{ gridTemplateColumns: "1fr 7rem 4.5rem 5.5rem 5.5rem 1.5rem", gap: "0.5rem", borderBottom: "1px solid var(--sa-border)", background: "var(--sa-bg)" }}>
              {["Item", "Category", "Qty", "Unit price", "Total", ""].map((h) => (
                <span key={h} className="text-[9px] font-semibold uppercase tracking-wide text-[var(--sa-text-muted)]">{h}</span>
              ))}
            </div>

            {/* Rows */}
            {selectedItems.map((item) => {
              const lineTotal = item.quantity * item.unit_amount;
              const lineTotalBase = baseCurrency === item.currency
                ? lineTotal
                : baseCurrency === "USD"
                ? toUSD(lineTotal, item.currency, rates)
                : toUSD(lineTotal, item.currency, rates) * (rates[baseCurrency] ?? 1);
              return (
                <div key={item.id} className="grid px-4 py-2.5 items-center" style={{ gridTemplateColumns: "1fr 7rem 4.5rem 5.5rem 5.5rem 1.5rem", gap: "0.5rem", borderBottom: "1px solid var(--sa-border)" }}>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{item.description}</p>
                  </div>
                  <span className="text-[11px] text-[var(--sa-text-secondary)]">{COST_CATS[item.category] ?? item.category}</span>
                  <span className="text-[11px] font-mono text-[var(--sa-text-secondary)]">{item.quantity}</span>
                  <span className="text-[11px] font-mono text-[var(--sa-text-secondary)]">{item.currency} {item.unit_amount.toFixed(2)}</span>
                  <span className="text-[12px] font-semibold font-mono text-[var(--sa-text-primary)]">{baseCurrency} {lineTotalBase.toFixed(2)}</span>
                  <button onClick={() => handleDeleteItem(item.id)} className="flex items-center justify-center text-[var(--sa-text-tertiary)] hover:text-red-600 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              );
            })}

            {/* Add item row */}
            <div className="grid px-4 py-2.5 items-center gap-1.5" style={{ gridTemplateColumns: "1fr 7rem 4.5rem 5.5rem 5.5rem 1.5rem", borderBottom: selectedItems.length > 0 ? "1px solid var(--sa-border)" : undefined, background: "var(--sa-bg)" }}>
              <input value={newItem.description} onChange={(e) => setNewItem((n) => ({ ...n, description: e.target.value }))} placeholder="Description" className="field-input text-[11px] w-full" />
              <select value={newItem.category} onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))} className="field-input text-[11px] w-full">
                {Object.entries(COST_CATS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <input type="number" value={newItem.quantity} onChange={(e) => setNewItem((n) => ({ ...n, quantity: e.target.value }))} className="field-input text-[11px] w-full font-mono" placeholder="1" />
              <input type="number" value={newItem.unit_amount} onChange={(e) => setNewItem((n) => ({ ...n, unit_amount: e.target.value }))} className="field-input text-[11px] w-full font-mono" placeholder="0.00" />
              <select value={newItem.currency} onChange={(e) => setNewItem((n) => ({ ...n, currency: e.target.value }))} className="field-input text-[11px] w-full">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <button onClick={handleAddItem} disabled={savingItem || !newItem.description.trim() || !newItem.unit_amount}
                className="flex items-center justify-center rounded-md p-1 bg-[var(--sa-accent)] text-white disabled:opacity-40">
                {savingItem ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              </button>
            </div>

            {/* COGS total */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "2px solid var(--sa-border)" }}>
              <span className="text-[12px] font-semibold text-[var(--sa-text-primary)]">Total COGS</span>
              <span className="text-[16px] font-bold font-mono text-[var(--sa-text-primary)]">{baseCurrency} {cogs.toFixed(2)}</span>
            </div>
          </div>

          {/* Pricing calculator */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--sa-border)", background: "var(--sa-window)" }}>
            <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--sa-border)" }}>
              <p className="text-[12px] font-semibold text-[var(--sa-text-primary)] mb-3">Pricing calculator</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--sa-text-secondary)]">Your selling price ({baseCurrency})</span>
                <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)}
                  onBlur={handleSaveTargetPrice}
                  className="field-input font-mono text-[13px] w-28 text-right"
                  placeholder="0.00" />
                {margin !== null && (
                  <span className={`text-[12px] font-semibold rounded-full px-2.5 py-0.5 ${margin < 50 ? "bg-red-100 text-red-700" : margin < 65 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                    {margin.toFixed(1)}% margin
                  </span>
                )}
              </div>
              {margin !== null && margin < 50 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} /> Margin below 50% — this price doesn&apos;t cover enough profit. Minimum: {baseCurrency} {priceForMargin(cogs, 50).toFixed(2)}
                </div>
              )}
            </div>

            <div className="divide-y divide-[var(--sa-border)]">
              {MARGIN_TIERS.map(({ label, pct }) => {
                const price = pct === 0 ? cogs : priceForMargin(cogs, pct);
                const isActive = target > 0 && Math.abs(calcMargin(cogs, target) - pct) < 3;
                return (
                  <div key={label} className="flex items-center justify-between px-4 py-3" style={{ background: isActive ? "var(--sa-selected)" : undefined }}>
                    <div>
                      <p className="text-[12px] font-medium text-[var(--sa-text-primary)]">{label}</p>
                      <p className="text-[10px] text-[var(--sa-text-tertiary)]">
                        {pct === 0 ? "COGS only — no profit" : `${pct}% gross margin`}
                      </p>
                    </div>
                    <button onClick={() => setTargetPrice(price.toFixed(2))} className="text-[14px] font-bold font-mono text-[var(--sa-text-primary)] hover:text-[var(--sa-accent)] transition-colors">
                      {baseCurrency} {price.toFixed(2)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────
export function StudioClient({ initialExpenses, initialProducts, initialItems }: Props) {
  const [tab, setTab] = useState<"expenses" | "costs">("expenses");
  const [rates, setRates] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try { return JSON.parse(localStorage.getItem("studio-rates") ?? ""); } catch {}
    }
    return DEFAULT_RATES;
  });

  function handleRatesChange(r: Record<string, number>) {
    setRates(r);
    localStorage.setItem("studio-rates", JSON.stringify(r));
  }

  const TABS = [
    { id: "expenses" as const, label: "Expenses", icon: Receipt },
    { id: "costs"    as const, label: "Cost Builder", icon: Calculator },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3.5 panel-border-b bg-[var(--sa-window)]">
        <div className="flex-1">
          <h1 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Studio</h1>
          <p className="text-[11px] text-[var(--sa-text-tertiary)]">Personal brand tools</p>
        </div>
        <nav className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "var(--sa-bg)", border: "1px solid var(--sa-border)" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors"
              style={tab === id ? { background: "var(--sa-window)", color: "var(--sa-text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } : { color: "var(--sa-text-tertiary)" }}>
              <Icon size={13} strokeWidth={tab === id ? 2.2 : 1.8} /> {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="flex-1 overflow-hidden flex">
          {tab === "expenses" ? (
            <ExpensesTab expenses={initialExpenses} rates={rates} />
          ) : (
            <CostBuilderTab products={initialProducts} items={initialItems} rates={rates} onRatesChange={handleRatesChange} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
