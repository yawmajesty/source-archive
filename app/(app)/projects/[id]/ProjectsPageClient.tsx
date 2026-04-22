"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Package, ArrowRight, Plus, X } from "lucide-react";
import { ResizablePanel } from "@/components/layout/ResizablePanel";
import { ProductRow } from "@/components/shared/ProductRow";
import { StageTrack } from "@/components/shared/StageTrack";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { Client, Project, Product, Factory, Stage } from "@/lib/mock-data";

interface ProductWithFactory {
  product: Product;
  factory: Factory | null;
}

interface Props {
  project: Project;
  client: Client | null;
  productsWithFactory: ProductWithFactory[];
  factories: Factory[];
}

type SortKey = "name" | "stage" | "cost";
type SortDir = "asc" | "desc";

const STAGE_ORDER: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];
const STAGES: Stage[] = STAGE_ORDER;

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
            <input
              ref={nameRef}
              autoFocus
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              placeholder="e.g. Ceramic Mug"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Category</label>
            <input
              ref={categoryRef}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              placeholder="e.g. Drinkware"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Stage</label>
              <select
                ref={stageRef}
                defaultValue="brief"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Factory</label>
              <select
                ref={factoryRef}
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
              <input
                ref={moqRef}
                type="number"
                min="0"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Target Cost</label>
              <input
                ref={targetCostRef}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">Client Price</label>
              <input
                ref={clientPriceRef}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-red-500">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Product"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

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
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] truncate">
            {product.name}
          </h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{product.category}</p>
        </div>
        <button
          onClick={onOpen}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity ml-3"
        >
          Open <ArrowRight size={11} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
            Stage
          </p>
          <StageTrack currentStage={product.stage} showLabels animated />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Target cost", value: `$${product.target_cost_usd}` },
            { label: "Quoted cost", value: product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "—" },
            { label: "MOQ", value: product.moq.toLocaleString() },
            { label: "Lead time", value: `${product.lead_time_days}d` },
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

        {product.colorways.length > 0 && (
          <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Colorways</p>
            <div className="flex flex-wrap gap-1.5">
              {product.colorways.map((c) => (
                <span key={c} className="rounded-full bg-[var(--sa-hover)] px-2.5 py-1 text-[11px] text-[var(--sa-text-secondary)] border border-[var(--sa-border)]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ProjectsPageClient({ project, client, productsWithFactory, factories }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    productsWithFactory[0]?.product.id ?? null
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAddProduct, setShowAddProduct] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...productsWithFactory].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.product.name.localeCompare(b.product.name);
    else if (sortKey === "stage") cmp = STAGE_ORDER.indexOf(a.product.stage) - STAGE_ORDER.indexOf(b.product.stage);
    else if (sortKey === "cost") cmp = (a.product.quoted_cost_usd ?? a.product.target_cost_usd) - (b.product.quoted_cost_usd ?? b.product.target_cost_usd);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const selectedItem = sorted.find((i) => i.product.id === selectedId);

  function openProduct(id: string) {
    router.push(`/products/${id}`);
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
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
      <div className="flex h-full overflow-hidden">
        {/* Panel 2 */}
        <ResizablePanel defaultWidth={380} storageKey="koru-project-panel2">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 panel-border-b bg-[var(--sa-window)]">
              <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)] flex-wrap min-w-0">
                <span className="truncate">{client?.name ?? "Client"}</span>
                <ChevronRight size={11} className="shrink-0" />
                <span className="text-[var(--sa-text-primary)] font-medium truncate">{project.name}</span>
              </div>
              <button
                onClick={() => setShowAddProduct(true)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--sa-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {/* Sort bar — collection breadcrumb already shown in header */}
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
              <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Stage</span>
              <span className="hidden w-32 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] xl:block">Factory</span>
              <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Cost</span>
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

        {/* Panel 3 */}
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
