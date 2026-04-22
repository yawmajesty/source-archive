"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, ChevronRight, Package,
  CheckCircle, Plus, Upload, Edit2, X, Trash2, Image as ImageIcon,
} from "lucide-react";
import { StageTrack } from "@/components/shared/StageTrack";
import { StatusBadge, SampleStatusBadge } from "@/components/shared/StatusBadge";
import { MilestoneItem } from "@/components/shared/MilestoneItem";
import { UpdateItem } from "@/components/shared/UpdateItem";
import { TrafficDot } from "@/components/shared/TrafficLight";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { Product, Factory, Milestone, Update, Sample, Cost, Project, Client, Stage } from "@/lib/mock-data";

const STAGES: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];
const CURRENCIES = ["USD", "GBP", "EUR", "CNY"];

interface Props {
  product: Product;
  factory: Factory | null;
  factories: Factory[];
  milestones: Milestone[];
  updates: Update[];
  samples: Sample[];
  costs: Cost[];
  project: Project | null;
  client: Client | null;
}

function EditProductDrawer({
  product, factories, onClose, onSaved,
}: {
  product: Product; factories: Factory[]; onClose: () => void; onSaved: (p: Partial<Product>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: product.name,
    category: product.category,
    stage: product.stage as Stage,
    factory_id: product.factory_id ?? "",
    moq: String(product.moq),
    order_qty: product.order_qty != null ? String(product.order_qty) : "",
    target_cost_usd: String(product.target_cost_usd),
    quoted_cost_usd: product.quoted_cost_usd != null ? String(product.quoted_cost_usd) : "",
    quoted_cost_currency: product.quoted_cost_currency,
    lead_time_days: String(product.lead_time_days),
    colorways: product.colorways.join(", "),
    notes: product.notes ?? "",
  });

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const updates: any = {
      name: form.name.trim(),
      category: form.category.trim(),
      stage: form.stage,
      factory_id: form.factory_id || null,
      moq: parseInt(form.moq) || 0,
      order_qty: form.order_qty ? parseInt(form.order_qty) : null,
      target_cost_usd: parseFloat(form.target_cost_usd) || 0,
      quoted_cost_usd: form.quoted_cost_usd ? parseFloat(form.quoted_cost_usd) : null,
      quoted_cost_currency: form.quoted_cost_currency,
      lead_time_days: parseInt(form.lead_time_days) || 0,
      colorways: form.colorways.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes?.trim() ?? "",
    };
    const { error: err } = await supabase.from("products").update(updates).eq("id", product.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved(updates);
    onClose();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-[var(--sa-window)] shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Edit Product</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div><label className={labelCls}>Product name *</label><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Category</label><input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
            <div>
              <label className={labelCls}>Stage</label>
              <select className={inputCls} value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                {STAGES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Factory</label>
            <select className={inputCls} value={form.factory_id} onChange={(e) => set("factory_id", e.target.value)}>
              <option value="">Not assigned</option>
              {factories.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.city}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>MOQ (units)</label><input className={inputCls} type="number" value={form.moq} onChange={(e) => set("moq", e.target.value)} /></div>
            <div><label className={labelCls}>Order qty</label><input className={inputCls} type="number" value={form.order_qty} onChange={(e) => set("order_qty", e.target.value)} placeholder="TBD" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Target cost (USD)</label><input className={inputCls} type="number" step="0.01" value={form.target_cost_usd} onChange={(e) => set("target_cost_usd", e.target.value)} /></div>
            <div><label className={labelCls}>Quoted cost</label><input className={inputCls} type="number" step="0.01" value={form.quoted_cost_usd} onChange={(e) => set("quoted_cost_usd", e.target.value)} placeholder="TBD" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Quote currency</label>
              <select className={inputCls} value={form.quoted_cost_currency} onChange={(e) => set("quoted_cost_currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Lead time (days)</label><input className={inputCls} type="number" value={form.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Colorways (comma separated)</label><input className={inputCls} value={form.colorways} onChange={(e) => set("colorways", e.target.value)} placeholder="White, Black, Navy" /></div>
          <div><label className={labelCls}>Notes</label><textarea className={inputCls + " resize-none"} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function MediaSection({ productId, initialImages }: { productId: string; initialImages: string[] }) {
  const [images, setImages] = useState<string[]>(initialImages ?? []);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `${productId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("product-media").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("product-media").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    if (newUrls.length) {
      const updated = [...images, ...newUrls];
      await supabase.from("products").update({ images: updated }).eq("id", productId);
      setImages(updated);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeImage(url: string) {
    const updated = images.filter((u) => u !== url);
    await supabase.from("products").update({ images: updated }).eq("id", productId);
    setImages(updated);
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {images.map((url) => (
            <div key={url} className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--sa-border)] bg-[var(--sa-bg)]">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => removeImage(url)}
                className="absolute top-1.5 right-1.5 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--sa-border)] py-8 mb-3">
          <ImageIcon size={24} className="text-[var(--sa-text-tertiary)]" />
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">No images yet</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors disabled:opacity-60"
      >
        <Upload size={12} /> {uploading ? "Uploading…" : "Upload images / video"}
      </button>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-window)]">
      <button
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-[var(--sa-hover)] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
          {title}
        </span>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} className="text-[var(--sa-text-tertiary)]" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--sa-border)] px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SampleCard({ sample }: { sample: Sample }) {
  const trafficStatus =
    sample.status === "approved"
      ? "green"
      : sample.status === "received"
      ? "amber"
      : sample.status === "rejected"
      ? "red"
      : "grey";

  return (
    <div className="rounded-xl border border-[var(--sa-border)] p-4 space-y-3 bg-[var(--sa-bg)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrafficDot status={trafficStatus} />
          <span className="text-[13px] font-semibold text-[var(--sa-text-primary)]">
            Round {sample.round}
          </span>
        </div>
        <SampleStatusBadge status={sample.status} />
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 text-[12px] text-[var(--sa-text-secondary)]">
        <span>Sent {formatDate(sample.sent_date)}</span>
        {sample.received_date && (
          <>
            <span className="text-[var(--sa-text-tertiary)]">→</span>
            <span>Received {formatDate(sample.received_date)}</span>
          </>
        )}
      </div>

      {/* Courier */}
      <div className="flex items-center gap-2 text-[12px] text-[var(--sa-text-tertiary)]">
        <span>{sample.courier}</span>
        {sample.tracking_number && (
          <>
            <span>·</span>
            <span className="font-mono">{sample.tracking_number}</span>
          </>
        )}
      </div>

      {/* Feedback */}
      {sample.feedback && (
        <div className="rounded-lg bg-[var(--sa-hover)] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-1">Feedback</p>
          <p className="text-[12px] text-[var(--sa-text-secondary)] leading-relaxed">{sample.feedback}</p>
        </div>
      )}

      {/* Approve button */}
      {sample.status === "received" && !sample.approved_at && (
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--sa-gold)] py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
          <CheckCircle size={13} strokeWidth={2.5} />
          Mark as Approved
        </button>
      )}
    </div>
  );
}

export function ProductDetailClient({
  product: initialProduct,
  factory: initialFactory,
  factories,
  milestones,
  updates,
  samples,
  costs,
  project,
  client,
}: Props) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [factory, setFactory] = useState(initialFactory);
  const [showEdit, setShowEdit] = useState(false);
  const [localUpdates, setLocalUpdates] = useState(updates);
  const [newUpdate, setNewUpdate] = useState("");

  const variancePct =
    product.quoted_cost_usd != null
      ? ((product.quoted_cost_usd - product.target_cost_usd) / product.target_cost_usd) * 100
      : null;

  function handleSaved(updates: Partial<Product>) {
    setProduct((p) => ({ ...p, ...updates }));
    const newFactory = updates.factory_id
      ? factories.find((f) => f.id === updates.factory_id) ?? null
      : updates.factory_id === null ? null : factory;
    setFactory(newFactory ?? null);
  }

  function addUpdate() {
    if (!newUpdate.trim()) return;
    const u: Update = {
      id: `upd-new-${Date.now()}`,
      product_id: product.id,
      author: "You",
      author_initials: "YO",
      text: newUpdate.trim(),
      visible_to_client: false,
      created_at: new Date().toISOString(),
    };
    setLocalUpdates((prev) => [u, ...prev]);
    setNewUpdate("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--sa-bg)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 panel-border-b bg-[var(--sa-window)]">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-text-primary)] transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back
        </button>
        <span className="text-[var(--sa-border-strong)]">/</span>
        {client && (
          <button
            onClick={() => router.push(`/clients/${client.id}`)}
            className="text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)] transition-colors"
          >
            {client.name}
          </button>
        )}
        {project && (
          <>
            <ChevronRight size={11} className="text-[var(--sa-text-tertiary)]" />
            <button
              onClick={() => router.push(`/projects/${project.id}`)}
              className="text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)] transition-colors"
            >
              {project.name}
            </button>
          </>
        )}
        <ChevronRight size={11} className="text-[var(--sa-text-tertiary)]" />
        <span className="text-[12px] font-medium text-[var(--sa-text-primary)] truncate">{product.name}</span>
        <button
          onClick={() => setShowEdit(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors shrink-0"
        >
          <Edit2 size={11} /> Edit
        </button>
      </div>

      {/* Product header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-6 pt-5 pb-4 bg-[var(--sa-window)] panel-border-b"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge stage={product.stage} />
              <span className="rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[11px] text-[var(--sa-text-secondary)] border border-[var(--sa-border)]">
                {product.category}
              </span>
              {factory && (
                <span className="rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[11px] text-[var(--sa-text-secondary)] border border-[var(--sa-border)]">
                  {factory.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stage track — animated, with labels */}
        <StageTrack currentStage={product.stage} animated showLabels size="md" />
      </motion.div>

      {/* Body — two-column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column (70%) */}
        <div className="flex-[7] overflow-y-auto px-6 py-5 space-y-4">

          {/* Details */}
          <CollapsibleSection title="Details">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "Factory", value: factory?.name ?? "Not assigned" },
                { label: "City / Country", value: factory ? `${factory.city}, ${factory.country}` : "—" },
                { label: "MOQ", value: product.moq.toLocaleString() },
                { label: "Order qty", value: product.order_qty ? product.order_qty.toLocaleString() : "—" },
                { label: "Lead time", value: `${product.lead_time_days} days` },
                { label: "Quote currency", value: product.quoted_cost_currency },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</span>
                  <span className="text-[13px] text-[var(--sa-text-primary)]">{value}</span>
                </div>
              ))}
            </div>

            {/* Cost comparison */}
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-[var(--sa-bg)] p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Target</span>
                <span className="font-mono text-[15px] font-semibold text-[var(--sa-text-primary)]">
                  ${product.target_cost_usd}
                </span>
              </div>
              <ChevronRight size={14} className="text-[var(--sa-text-tertiary)]" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Quoted</span>
                <span
                  className={cn(
                    "font-mono text-[15px] font-semibold",
                    product.quoted_cost_usd == null
                      ? "text-[var(--sa-text-tertiary)]"
                      : variancePct != null && Math.abs(variancePct) > 5
                      ? variancePct > 0
                        ? "text-[var(--sa-danger)]"
                        : "text-[var(--sa-success)]"
                      : "text-[var(--sa-text-primary)]"
                  )}
                >
                  {product.quoted_cost_usd != null ? `$${product.quoted_cost_usd}` : "—"}
                </span>
              </div>
              {variancePct != null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    variancePct > 5
                      ? "bg-red-50 text-[var(--sa-danger)] dark:bg-red-500/15"
                      : variancePct < -5
                      ? "bg-green-50 text-[var(--sa-success)] dark:bg-green-500/15"
                      : "bg-[var(--sa-hover)] text-[var(--sa-text-secondary)]"
                  )}
                >
                  {variancePct > 0 ? "+" : ""}{variancePct.toFixed(1)}%
                </span>
              )}
            </div>
          </CollapsibleSection>

          {/* Media */}
          <CollapsibleSection title="Images & Video">
            <MediaSection productId={product.id} initialImages={(product as any).images ?? []} />
          </CollapsibleSection>

          {/* BOM */}
          <CollapsibleSection title="Bill of Materials">
            {(product.bom ?? []).length === 0 ? (
              <p className="text-[13px] text-[var(--sa-text-tertiary)]">No materials added yet.</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--sa-border)]">
                    {["Material", "Supplier", "Unit cost", "Notes"].map((h) => (
                      <th key={h} className="pb-2 text-left font-semibold text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(product.bom ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-[var(--sa-border)] last:border-0">
                      <td className="py-2 pr-4 font-medium text-[var(--sa-text-primary)]">{item.material}</td>
                      <td className="py-2 pr-4 text-[var(--sa-text-secondary)]">{item.supplier}</td>
                      <td className="py-2 pr-4 font-mono text-[var(--sa-text-primary)]">${item.unit_cost_usd}</td>
                      <td className="py-2 text-[var(--sa-text-tertiary)] italic">{item.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--sa-accent)] hover:opacity-80 transition-opacity">
              <Plus size={12} strokeWidth={2.5} /> Add material
            </button>
          </CollapsibleSection>

          {/* Colorways */}
          {product.colorways.length > 0 && (
            <CollapsibleSection title="Colorways & Variants">
              <div className="flex flex-wrap gap-2">
                {product.colorways.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[var(--sa-border-strong)] px-3 py-1 text-[12px] font-medium text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)] transition-colors cursor-default"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Samples */}
          <CollapsibleSection title={`Samples (${samples.length})`}>
            {samples.length === 0 ? (
              <p className="text-[13px] text-[var(--sa-text-tertiary)]">No samples yet.</p>
            ) : (
              <div className="space-y-3">
                {samples.map((s) => <SampleCard key={s.id} sample={s} />)}
              </div>
            )}
          </CollapsibleSection>

          {/* Costs */}
          {costs.length > 0 && (
            <CollapsibleSection title="Production Costs">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--sa-border)]">
                    {["Date", "Category", "Description", "Amount", "Billable"].map((h) => (
                      <th key={h} className="pb-2 text-left font-semibold text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--sa-border)] last:border-0">
                      <td className="py-2 pr-4 text-[var(--sa-text-tertiary)]">{formatDate(c.date_paid)}</td>
                      <td className="py-2 pr-4">
                        <span className="rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[10px] capitalize text-[var(--sa-text-secondary)]">
                          {c.category}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-[var(--sa-text-primary)]">{c.description}</td>
                      <td className="py-2 pr-4 font-mono text-[var(--sa-text-primary)]">
                        £{c.amount_gbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2">
                        {c.billable_to_client ? (
                          <span className="text-[10px] text-[var(--sa-success)]">Yes</span>
                        ) : (
                          <span className="text-[10px] text-[var(--sa-text-tertiary)]">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CollapsibleSection>
          )}

          {/* Documents */}
          <CollapsibleSection title="Documents">
            <div className="rounded-xl border-2 border-dashed border-[var(--sa-border-strong)] p-6 text-center">
              <Upload size={20} className="mx-auto mb-2 text-[var(--sa-text-tertiary)]" strokeWidth={1.5} />
              <p className="text-[13px] text-[var(--sa-text-secondary)]">Drop files here to upload</p>
              <p className="text-[11px] text-[var(--sa-text-tertiary)]">PDF, images, spreadsheets</p>
            </div>
          </CollapsibleSection>
        </div>

        {/* Right column (30%) — sticky */}
        <div className="flex-[3] min-w-64 max-w-80 overflow-y-auto border-l border-[var(--sa-border)] px-4 py-5 space-y-4 bg-[var(--sa-window)]">

          {/* Milestones */}
          <section className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-bg)]">
            <div className="flex items-center justify-between px-4 py-3 panel-border-b">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
                Milestones
              </span>
              <span className="text-[11px] text-[var(--sa-text-tertiary)]">
                {milestones.filter((m) => m.completed_at).length}/{milestones.length}
              </span>
            </div>
            <div className="px-4 py-2 divide-y divide-[var(--sa-border)]">
              {milestones.length === 0 ? (
                <p className="py-4 text-[12px] text-center text-[var(--sa-text-tertiary)]">No milestones</p>
              ) : (
                milestones.map((m) => <MilestoneItem key={m.id} milestone={m} />)
              )}
            </div>
          </section>

          {/* Updates */}
          <section className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-bg)]">
            <div className="flex items-center justify-between px-4 py-3 panel-border-b">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
                Updates
              </span>
            </div>

            {/* Add update */}
            <div className="px-4 pt-3 pb-2 panel-border-b border-b border-[var(--sa-border)]">
              <div className="flex gap-2">
                <input
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUpdate()}
                  placeholder="Add an update…"
                  className="flex-1 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors"
                />
                <button
                  onClick={addUpdate}
                  disabled={!newUpdate.trim()}
                  className="rounded-lg bg-[var(--sa-accent)] px-2.5 py-1.5 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="px-4 py-1 max-h-96 overflow-y-auto">
              {localUpdates.length === 0 ? (
                <p className="py-4 text-[12px] text-center text-[var(--sa-text-tertiary)]">No updates yet</p>
              ) : (
                localUpdates.map((u) => <UpdateItem key={u.id} update={u} />)
              )}
            </div>
          </section>

          {/* Notes */}
          {product.notes && (
            <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-bg)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-2">Notes</p>
              <p className="text-[13px] text-[var(--sa-text-secondary)] leading-relaxed">{product.notes}</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showEdit && (
          <EditProductDrawer
            product={product}
            factories={factories}
            onClose={() => setShowEdit(false)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
