"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, ChevronRight, Package,
  CheckCircle, Plus, Upload, Edit2, X, Trash2, Image as ImageIcon,
  FileText, TrendingUp, TrendingDown, DollarSign, Video, Sparkles,
} from "lucide-react";
import { StageTrack } from "@/components/shared/StageTrack";
import { StatusBadge, SampleStatusBadge } from "@/components/shared/StatusBadge";
import { MilestoneItem } from "@/components/shared/MilestoneItem";
import { UpdateItem } from "@/components/shared/UpdateItem";
import { TrafficDot } from "@/components/shared/TrafficLight";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/lib/storage";
import type { Product, Factory, Milestone, Update, Sample, Cost, Project, Client, Stage, BomItem, DocumentItem, PriceTier } from "@/lib/mock-data";
import { autoTagProduct, updateAutoTags } from "./actions";

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `${productId}/${Date.now()}-${file.name}`;
      const { url, error } = await uploadFile("product-media", path, file);
      if (error) { setUploadError(error); }
      else if (url) { newUrls.push(url); }
    }
    if (newUrls.length) {
      const updated = [...images, ...newUrls];
      const { error: dbErr } = await supabase.rpc("update_product_images", { p_id: productId, p_images: updated });
      if (dbErr) { setUploadError(`Saved to storage but DB update failed: ${dbErr.message}`); }
      else { setImages(updated); }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeImage(url: string) {
    const updated = images.filter((u) => u !== url);
    await supabase.rpc("update_product_images", { p_id: productId, p_images: updated });
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
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
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
      {uploadError && <p className="mt-2 text-[11px] text-[var(--sa-danger)]">Upload failed: {uploadError}</p>}
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AutoTagsSection({ product, onSaved }: { product: Product; onSaved: (p: Partial<Product>) => void }) {
  const initial = {
    auto_type: product.auto_type ?? "",
    auto_category: product.auto_category ?? "",
    auto_color: product.auto_color ?? "",
    auto_fabric: product.auto_fabric ?? "",
  };
  const hasImages = ((product.images ?? []) as string[]).length > 0;
  const hasTags = !!(product.auto_type || product.auto_category || product.auto_color || product.auto_fabric);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(initial);

  async function handleTag() {
    setRunning(true);
    setError(null);
    const res = await autoTagProduct(product.id);
    setRunning(false);
    if (!res.success) { setError(res.error); return; }
    onSaved({ ...res.tags, auto_tagged_at: new Date().toISOString() });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await updateAutoTags(product.id, draft);
    setSaving(false);
    if (!res.success) { setError(res.error ?? "Save failed"); return; }
    onSaved(draft);
    setEditing(false);
  }

  function startEdit() {
    setDraft({
      auto_type: product.auto_type ?? "",
      auto_category: product.auto_category ?? "",
      auto_color: product.auto_color ?? "",
      auto_fabric: product.auto_fabric ?? "",
    });
    setEditing(true);
  }

  const fields: Array<{ key: keyof typeof draft; label: string }> = [
    { key: "auto_type",     label: "Product type" },
    { key: "auto_category", label: "Category" },
    { key: "auto_color",    label: "Colour" },
    { key: "auto_fabric",   label: "Fabric" },
  ];

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[var(--sa-text-tertiary)]">
          {hasTags
            ? <>Tagged {product.auto_tagged_at ? new Date(product.auto_tagged_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""} · feeds analytics & future pricing suggestions</>
            : "Tag this product to feed the pricing dataset."}
        </p>
        <div className="flex items-center gap-2">
          {hasTags && !editing && (
            <button
              onClick={startEdit}
              className="rounded-md border border-[var(--sa-border)] px-2.5 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleTag}
            disabled={running || !hasImages}
            title={!hasImages ? "Add an image to enable auto-tagging" : "Run the AI tagger"}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Sparkles size={11} /> {running ? "Tagging…" : hasTags ? "Re-tag" : "Auto-tag"}
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {editing ? (
        <div className="grid grid-cols-2 gap-2.5">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-1">{label}</p>
              <input
                className={inputCls}
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="col-span-2 flex justify-end gap-2 mt-1">
            <button onClick={() => setEditing(false)} className="rounded-lg border border-[var(--sa-border)] px-3 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[var(--sa-accent)] px-3 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : hasTags ? (
        <div className="grid grid-cols-2 gap-2">
          {fields.map(({ key, label }) => {
            const value = product[key as keyof Product] as string | null | undefined;
            return (
              <div key={key} className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
                <p className="mt-0.5 text-[13px] font-medium text-[var(--sa-text-primary)] capitalize">{value || "—"}</p>
              </div>
            );
          })}
        </div>
      ) : (
        !hasImages && (
          <p className="text-[12px] text-[var(--sa-text-tertiary)] italic">Add at least one image above to enable auto-tagging.</p>
        )
      )}
    </div>
  );
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

function QuickAddTask({ projectId, productId, onClose }: { projectId: string; productId: string; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const assignedRef = useRef<HTMLInputElement>(null);

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";

  async function handleSave() {
    const title = titleRef.current?.value.trim();
    if (!title) { setError("Title is required"); return; }
    setSaving(true);
    const assigned = assignedRef.current?.value.trim() || "Unassigned";
    const initials = assigned.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    const { error: err } = await supabase.from("tasks").insert({
      id: "task-" + Date.now(),
      project_id: projectId,
      product_id: productId,
      title,
      status: "todo",
      assigned_to: assigned,
      assigned_initials: initials,
      due_date: dueDateRef.current?.value || null,
      notes: "",
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
        <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Add Task</h2>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={15} className="text-[var(--sa-text-tertiary)]" /></button>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Title *</label>
          <input ref={titleRef} autoFocus className={inputCls} placeholder="e.g. Book freight forwarder" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Due date</label>
            <input ref={dueDateRef} type="date" className={inputCls} /></div>
          <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Assigned to</label>
            <input ref={assignedRef} className={inputCls} placeholder="Your name" /></div>
        </div>
        {error && <p className="text-[12px] text-red-500">{error}</p>}
      </div>
      <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
        <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
          {saving ? "Saving…" : "Add Task"}
        </button>
      </div>
    </motion.div>
  );
}

interface TierRow { moq: string; unit_price_usd: string }

const MARGIN_PRESETS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "Low",  value: 0.30 },
  { label: "Med",  value: 0.50 },
  { label: "High", value: 0.65 },
];

// Looks up the supplier (internal) cost relevant to a given client MOQ.
// Picks the largest internal tier whose moq <= the row moq, or the smallest tier if below all,
// otherwise falls back to the flat quoted_cost_usd. Returns null if no reference is available.
function supplierCostForMoq(product: Product, moq: number): number | null {
  const internal = product.internal_price_tiers ?? [];
  if (internal.length > 0) {
    const sorted = [...internal].sort((a, b) => a.moq - b.moq);
    let best: PriceTier | null = null;
    for (const t of sorted) {
      if (t.moq <= moq) best = t;
      else break;
    }
    return (best ?? sorted[0]).unit_price_usd;
  }
  return product.quoted_cost_usd ?? null;
}

function VolumePricingCard({ product, onSaved, kind }: { product: Product; onSaved: (p: Partial<Product>) => void; kind: "client" | "internal" }) {
  const field = kind === "client" ? "price_tiers" : "internal_price_tiers";
  const title = kind === "client" ? "Volume pricing (client)" : "Volume pricing (internal)";
  const subtitle = kind === "client" ? "Shown to client when set" : "Supplier costs — internal only";
  const source = (kind === "client" ? product.price_tiers : product.internal_price_tiers) ?? [];

  const initial: TierRow[] = source.map((t) => ({
    moq: String(t.moq),
    unit_price_usd: String(t.unit_price_usd),
  }));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TierRow[]>(initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestRow, setSuggestRow] = useState<number | null>(null);

  function startEdit() {
    setRows(initial.length > 0 ? initial : [{ moq: "", unit_price_usd: "" }]);
    setSaveError(null);
    setEditing(true);
  }

  function cancel() {
    setRows(initial);
    setSaveError(null);
    setEditing(false);
  }

  function addRow() { setRows((prev) => [...prev, { moq: "", unit_price_usd: "" }]); }
  function updateRow(i: number, patch: Partial<TierRow>) { setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const parsed: PriceTier[] = rows
      .map((r) => ({ moq: parseInt(r.moq), unit_price_usd: parseFloat(r.unit_price_usd) }))
      .filter((r) => Number.isFinite(r.moq) && r.moq > 0 && Number.isFinite(r.unit_price_usd) && r.unit_price_usd > 0)
      .sort((a, b) => a.moq - b.moq);
    const updates: Partial<Product> = { [field]: parsed };
    const { error } = await supabase.from("products").update(updates).eq("id", product.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    onSaved(updates);
    setEditing(false);
  }

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors font-mono";
  const tiers = source;

  return (
    <section className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-bg)]">
      <div className="flex items-center justify-between px-4 py-3 panel-border-b">
        <div>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">{title}</span>
          <span className="ml-2 text-[10px] text-[var(--sa-text-tertiary)]">{subtitle}</span>
        </div>
        {!editing ? (
          <button onClick={startEdit} className="text-[11px] text-[var(--sa-accent)] hover:opacity-70 transition-opacity">
            {tiers.length > 0 ? "Edit" : "Add tiers"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancel} className="text-[11px] text-[var(--sa-text-tertiary)] hover:opacity-70">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-[11px] font-medium text-[var(--sa-accent)] hover:opacity-70 disabled:opacity-50 transition-opacity">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
      <div className="px-4 py-3">
        {!editing ? (
          tiers.length === 0 ? (
            <p className="text-[12px] text-[var(--sa-text-tertiary)] italic">
              {kind === "client"
                ? "No volume tiers set. The single Quoted price will be shown to the client."
                : "No supplier tiers set yet."}
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left">
                  <th className="pb-1.5 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] font-semibold">Units</th>
                  <th className="pb-1.5 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] font-semibold text-right">Unit price</th>
                  <th className="pb-1.5 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] font-semibold text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sa-border)]">
                {tiers.map((t, i) => (
                  <tr key={i}>
                    <td className="py-1.5 font-mono text-[var(--sa-text-secondary)]">{t.moq.toLocaleString()}</td>
                    <td className="py-1.5 font-mono font-semibold text-[var(--sa-text-primary)] text-right">${t.unit_price_usd.toFixed(2)}</td>
                    <td className="py-1.5 font-mono text-[var(--sa-text-tertiary)] text-right">${(t.moq * t.unit_price_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => {
              const moqNum = parseInt(r.moq);
              const cost = kind === "client" && Number.isFinite(moqNum) && moqNum > 0
                ? supplierCostForMoq(product, moqNum)
                : null;
              const showSuggest = kind === "client" && suggestRow === i && cost != null && cost > 0;
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        className={inputCls}
                        type="number"
                        min="1"
                        placeholder="Units (e.g. 100)"
                        value={r.moq}
                        onChange={(e) => updateRow(i, { moq: e.target.value })}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        className={inputCls}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit price USD"
                        value={r.unit_price_usd}
                        onFocus={() => kind === "client" && setSuggestRow(i)}
                        onBlur={() => setTimeout(() => setSuggestRow((cur) => cur === i ? null : cur), 150)}
                        onChange={(e) => updateRow(i, { unit_price_usd: e.target.value })}
                      />
                    </div>
                    <button
                      onClick={() => removeRow(i)}
                      className="rounded-md p-1.5 text-[var(--sa-text-tertiary)] hover:text-red-500 transition-colors"
                      title="Remove tier"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {showSuggest && (
                    <div className="flex items-center flex-wrap gap-1.5 pl-1">
                      <span className="flex items-center gap-1 text-[10px] text-[var(--sa-text-tertiary)]">
                        <Sparkles size={10} className="text-[var(--sa-accent)]" /> Suggested
                      </span>
                      {MARGIN_PRESETS.map((m) => {
                        const price = cost! / (1 - m.value);
                        return (
                          <button
                            key={m.label}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              updateRow(i, { unit_price_usd: price.toFixed(2) });
                              setSuggestRow(null);
                            }}
                            className="rounded-md border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-0.5 text-[10px] text-[var(--sa-text-primary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)] transition-colors"
                          >
                            {m.label} · ${price.toFixed(2)}
                            <span className="ml-1 text-[9px] text-[var(--sa-text-tertiary)]">{Math.round(m.value * 100)}% margin</span>
                          </button>
                        );
                      })}
                      <span className="text-[10px] text-[var(--sa-text-tertiary)] italic">based on ${cost!.toFixed(2)} cost</span>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={addRow}
              className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--sa-border)] py-1.5 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)] transition-colors"
            >
              <Plus size={11} /> Add tier
            </button>
            {saveError && (
              <p className="text-[11px] text-red-500 mt-1">
                Couldn't save: {saveError}
                {/column.*does not exist/i.test(saveError) && (
                  <span className="block text-[10px] text-[var(--sa-text-tertiary)] mt-0.5">
                    Run the ALTER TABLE migration in Supabase to add the price_tiers / internal_price_tiers columns.
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PricingCard({ product, onSaved }: { product: Product; onSaved: (p: Partial<Product>) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState(String(product.target_cost_usd));
  const [quoted, setQuoted] = useState(product.quoted_cost_usd != null ? String(product.quoted_cost_usd) : "");
  const [currency, setCurrency] = useState<"USD" | "GBP" | "EUR" | "CNY">((product.quoted_cost_currency as any) ?? "USD");
  const [orderQty, setOrderQty] = useState(product.order_qty != null ? String(product.order_qty) : "");
  const [sampleFee, setSampleFee] = useState(product.sample_fee_usd != null ? String(product.sample_fee_usd) : "");
  const [sampleCost, setSampleCost] = useState(product.sample_cost_usd != null ? String(product.sample_cost_usd) : "");
  const [sampleDate, setSampleDate] = useState(product.expected_sample_date ?? "");

  async function handleSave() {
    setSaving(true);
    const updates: Partial<Product> = {
      target_cost_usd: parseFloat(target) || 0,
      quoted_cost_usd: quoted ? parseFloat(quoted) : null,
      quoted_cost_currency: currency,
      order_qty: orderQty ? parseInt(orderQty) : null,
      sample_fee_usd: sampleFee ? parseFloat(sampleFee) : null,
      sample_cost_usd: sampleCost ? parseFloat(sampleCost) : null,
      expected_sample_date: sampleDate || null,
    };
    await supabase.from("products").update(updates).eq("id", product.id);
    onSaved(updates);
    setSaving(false);
    setEditing(false);
  }

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors font-mono";
  const labelCls = "text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-1";

  return (
    <section className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-bg)]">
      <div className="flex items-center justify-between px-4 py-3 panel-border-b">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Pricing</span>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-[11px] text-[var(--sa-accent)] hover:opacity-70 transition-opacity">Edit</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(false)} className="text-[11px] text-[var(--sa-text-tertiary)] hover:opacity-70">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-[11px] font-medium text-[var(--sa-accent)] hover:opacity-70 disabled:opacity-50 transition-opacity">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
      <div className="px-4 py-3 space-y-3">
        {editing ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={labelCls}>Target cost (USD)</p>
                <input className={inputCls} type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
              <div><p className={labelCls}>Quoted cost</p>
                <input className={inputCls} type="number" step="0.01" value={quoted} onChange={(e) => setQuoted(e.target.value)} placeholder="TBD" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><p className={labelCls}>Currency</p>
                <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                  {["USD", "GBP", "EUR", "CNY"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><p className={labelCls}>Order qty</p>
                <input className={inputCls} type="number" value={orderQty} onChange={(e) => setOrderQty(e.target.value)} placeholder="TBD" /></div>
            </div>
            <div className="border-t border-[var(--sa-border)] pt-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Sampling</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div><p className={labelCls}>Sample fee (client)</p>
                  <input className={inputCls} type="number" step="0.01" value={sampleFee} onChange={(e) => setSampleFee(e.target.value)} placeholder="0.00" /></div>
                <div><p className={labelCls}>Sample cost (internal)</p>
                  <input className={inputCls} type="number" step="0.01" value={sampleCost} onChange={(e) => setSampleCost(e.target.value)} placeholder="0.00" /></div>
              </div>
              <div><p className={labelCls}>Expected sample date</p>
                <input className={inputCls} type="date" value={sampleDate} onChange={(e) => setSampleDate(e.target.value)} /></div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Target", value: product.target_cost_usd != null ? `$${product.target_cost_usd.toFixed(2)}` : "—" },
                { label: "Quoted", value: product.quoted_cost_usd != null ? `${product.quoted_cost_currency} ${product.quoted_cost_usd.toFixed(2)}` : "—" },
                { label: "Order qty", value: product.order_qty?.toLocaleString() ?? "—" },
                { label: "Sample fee", value: product.sample_fee_usd != null ? `$${product.sample_fee_usd.toFixed(2)}` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-[var(--sa-window)] border border-[var(--sa-border)] p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
                  <p className="mt-0.5 font-mono text-[13px] font-semibold text-[var(--sa-text-primary)]">{value}</p>
                </div>
              ))}
            </div>
            {(product.sample_cost_usd != null || product.expected_sample_date) && (
              <div className="rounded-lg bg-[var(--sa-hover)] border border-[var(--sa-border)] px-3 py-2 space-y-1">
                {product.sample_cost_usd != null && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--sa-text-tertiary)]">Sample cost (internal)</span>
                    <span className="font-mono text-[var(--sa-text-secondary)]">${product.sample_cost_usd.toFixed(2)}</span>
                  </div>
                )}
                {product.expected_sample_date && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--sa-text-tertiary)]">Expected sample</span>
                    <span className="text-[var(--sa-text-secondary)]">{formatDate(product.expected_sample_date)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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

function AddMaterialModal({
  productId, existingBom, onClose, onSaved,
}: {
  productId: string;
  existingBom: BomItem[];
  onClose: () => void;
  onSaved: (bom: BomItem[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ material: "", supplier: "", unit_cost_usd: "", notes: "" });
  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors";

  async function handleSave() {
    if (!form.material.trim()) { setError("Material name is required"); return; }
    setSaving(true);
    const newItem: BomItem = {
      id: "bom-" + Date.now(),
      material: form.material.trim(),
      supplier: form.supplier.trim(),
      unit_cost_usd: parseFloat(form.unit_cost_usd) || 0,
      notes: form.notes.trim(),
    };
    const updated = [...existingBom, newItem];
    const { error: err } = await supabase.from("products").update({ bom_data: updated }).eq("id", productId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved(updated);
    onClose();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
            <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Add Material</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={15} className="text-[var(--sa-text-tertiary)]" /></button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Material *</label>
              <input className={inputCls} value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} autoFocus /></div>
            <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Supplier</label>
              <input className={inputCls} value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} /></div>
            <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Unit cost (USD)</label>
              <input className={inputCls} type="number" step="0.01" value={form.unit_cost_usd} onChange={(e) => setForm((f) => ({ ...f, unit_cost_usd: e.target.value }))} placeholder="0.00" /></div>
            <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Notes</label>
              <input className={inputCls} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            {error && <p className="text-[12px] text-red-500">{error}</p>}
          </div>
          <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {saving ? "Saving…" : "Add Material"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function AddSampleModal({
  productId, nextRound, onClose, onSaved,
}: {
  productId: string;
  nextRound: number;
  onClose: () => void;
  onSaved: (sample: Sample) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    courier: "",
    tracking_number: "",
    sent_date: new Date().toISOString().slice(0, 10),
    feedback: "",
  });
  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] transition-colors";

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `${productId}/samples/${Date.now()}-${file.name}`;
      const { url, error: uploadErr } = await uploadFile("product-media", path, file);
      if (uploadErr) { setError(uploadErr); }
      else if (url) { newUrls.push(url); }
    }
    setImages((prev) => [...prev, ...newUrls]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    const newSample: any = {
      id: "sample-" + Date.now(),
      product_id: productId,
      round: nextRound,
      status: "sent",
      courier: form.courier.trim(),
      tracking_number: form.tracking_number.trim(),
      sent_date: form.sent_date,
      received_date: null,
      feedback: form.feedback.trim(),
      approved_at: null,
      images,
    };
    const { error: err } = await supabase.from("samples").insert(newSample);
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved(newSample as Sample);
    onClose();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
            <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Add Sample — Round {nextRound}</h2>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={15} className="text-[var(--sa-text-tertiary)]" /></button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Courier</label>
                <input className={inputCls} value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} placeholder="e.g. DHL Express" /></div>
              <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Tracking #</label>
                <input className={inputCls} value={form.tracking_number} onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))} /></div>
            </div>
            <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Sent date</label>
              <input className={inputCls} type="date" value={form.sent_date} onChange={(e) => setForm((f) => ({ ...f, sent_date: e.target.value }))} /></div>
            <div><label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Notes / feedback</label>
              <textarea className={inputCls + " resize-none"} rows={3} value={form.feedback} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} /></div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Photos / Video</label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {images.map((url, i) => (
                    <div key={i} className="group relative aspect-square rounded-lg overflow-hidden border border-[var(--sa-border)]">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleUpload} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-60">
                <Upload size={12} /> {uploading ? "Uploading…" : "Upload photos/video"}
              </button>
            </div>
            {error && <p className="text-[12px] text-red-500">{error}</p>}
          </div>
          <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {saving ? "Saving…" : "Add Sample"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function DocumentsSection({ productId, initialDocs }: { productId: string; initialDocs: DocumentItem[] }) {
  const [docs, setDocs] = useState<DocumentItem[]>(initialDocs ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    const newDocs: DocumentItem[] = [];
    for (const file of files) {
      const path = `${productId}/documents/${Date.now()}-${file.name}`;
      const { url, error } = await uploadFile("product-media", path, file);
      if (error) { setUploadError(error); }
      else if (url) {
        newDocs.push({
          id: "doc-" + Date.now(),
          filename: file.name,
          url,
          size_kb: Math.round(file.size / 1024),
          uploaded_at: new Date().toISOString(),
          visible_to_client: true,
        });
      }
    }
    if (newDocs.length) {
      const updated = [...docs, ...newDocs];
      await supabase.rpc("update_product_documents", { p_id: productId, p_documents: updated });
      setDocs(updated);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeDoc(id: string) {
    const updated = docs.filter((d) => d.id !== id);
    await supabase.rpc("update_product_documents", { p_id: productId, p_documents: updated });
    setDocs(updated);
  }

  function formatSize(kb: number) {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  }

  return (
    <div className="space-y-2">
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-[var(--sa-border)] px-3 py-2 hover:bg-[var(--sa-hover)] group transition-colors">
              <FileText size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
              <div className="flex-1 min-w-0">
                <a href={doc.url} target="_blank" rel="noreferrer" className="text-[13px] text-[var(--sa-text-primary)] truncate block hover:text-[var(--sa-accent)] transition-colors">
                  {doc.filename}
                </a>
                <p className="text-[11px] text-[var(--sa-text-tertiary)]">{formatSize(doc.size_kb)} · {new Date(doc.uploaded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <span className="text-[10px] text-[var(--sa-text-tertiary)] shrink-0">{doc.visible_to_client ? "Client visible" : "Internal"}</span>
              <button onClick={() => removeDoc(doc.id)}
                className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md hover:bg-red-50 hover:text-[var(--sa-danger)] transition-colors text-[var(--sa-text-tertiary)]">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {docs.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--sa-border)] py-6">
          <FileText size={20} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.5} />
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">No documents yet</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*" multiple className="hidden" onChange={handleUpload} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors disabled:opacity-60">
        <Upload size={12} /> {uploading ? "Uploading…" : "Upload document"}
      </button>
      {uploadError && <p className="mt-2 text-[11px] text-[var(--sa-danger)]">Upload failed: {uploadError}</p>}
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localUpdates, setLocalUpdates] = useState(updates);
  const [newUpdate, setNewUpdate] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [localSamples, setLocalSamples] = useState(samples);
  const [showAddSample, setShowAddSample] = useState(false);
  const [localBom, setLocalBom] = useState<BomItem[]>(() => (product as any).bom_data ?? product.bom ?? []);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [localDocs, setLocalDocs] = useState<DocumentItem[]>(() => (product as any).documents ?? []);

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("products").delete().eq("id", product.id);
    setDeleting(false);
    router.back();
  }

  const variancePct =
    product.quoted_cost_usd != null && product.target_cost_usd != null && product.target_cost_usd !== 0
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
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
          >
            <Edit2 size={11} /> Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center justify-center rounded-lg border border-[var(--sa-border)] p-1.5 text-[var(--sa-text-tertiary)] hover:border-[var(--sa-danger)] hover:text-[var(--sa-danger)] transition-colors"
            title="Delete product"
          >
            <Trash2 size={13} />
          </button>
        </div>
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

      {/* Body — two-column on desktop, single-column scroll on mobile */}
      <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex">
        {/* Left column */}
        <div className="px-4 md:px-6 py-5 space-y-4 md:flex-[7] md:overflow-y-auto">

          {/* Details */}
          <CollapsibleSection title="Details">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "Factory", value: factory?.name ?? "Not assigned" },
                { label: "City / Country", value: factory ? `${factory.city}, ${factory.country}` : "—" },
                { label: "MOQ", value: product.moq != null ? product.moq.toLocaleString() : "—" },
                { label: "Order qty", value: product.order_qty ? product.order_qty.toLocaleString() : "—" },
                { label: "Lead time", value: product.lead_time_days != null ? `${product.lead_time_days} days` : "—" },
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
                        ? "text-[var(--sa-success)]"
                        : "text-[var(--sa-danger)]"
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
                      ? "bg-green-50 text-[var(--sa-success)] dark:bg-green-500/15"
                      : variancePct < -5
                      ? "bg-red-50 text-[var(--sa-danger)] dark:bg-red-500/15"
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

          {/* Auto tags */}
          <CollapsibleSection title="Auto tags">
            <AutoTagsSection product={product} onSaved={(updates) => setProduct((p) => ({ ...p, ...updates }))} />
          </CollapsibleSection>

          {/* BOM */}
          <CollapsibleSection title="Bill of Materials">
            {localBom.length === 0 ? (
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
                  {localBom.map((item) => (
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
            <button onClick={() => setShowAddMaterial(true)} className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--sa-accent)] hover:opacity-80 transition-opacity">
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
          <CollapsibleSection title={`Samples (${localSamples.length})`}>
            {localSamples.length === 0 ? (
              <p className="text-[13px] text-[var(--sa-text-tertiary)]">No samples yet.</p>
            ) : (
              <div className="space-y-3">
                {localSamples.map((s) => <SampleCard key={s.id} sample={s} />)}
              </div>
            )}
            <button onClick={() => setShowAddSample(true)} className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--sa-accent)] hover:opacity-80 transition-opacity">
              <Plus size={12} strokeWidth={2.5} /> Add sample
            </button>
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
          <CollapsibleSection title="Documents (Tech packs, Specs)">
            <DocumentsSection productId={product.id} initialDocs={localDocs} />
          </CollapsibleSection>

          {/* Profit & Sampling P&L */}
          {(product.quoted_cost_usd != null || product.sample_fee_usd != null || product.sample_cost_usd != null) && (
            <CollapsibleSection title="Profit & Sampling P&L">
              {(() => {
                const hasProd = product.quoted_cost_usd != null;
                const hasSampling = product.sample_fee_usd != null || product.sample_cost_usd != null;
                const unitMargin = hasProd && product.target_cost_usd != null ? product.quoted_cost_usd! - product.target_cost_usd : null;
                const marginPct = unitMargin != null && product.target_cost_usd != null && product.target_cost_usd > 0 ? (unitMargin / product.target_cost_usd) * 100 : null;
                const qty = product.order_qty ?? product.moq ?? 0;
                const totalMargin = unitMargin != null ? unitMargin * qty : null;
                const isProfit = unitMargin != null ? unitMargin >= 0 : null;
                const sampleFee = product.sample_fee_usd ?? 0;
                const sampleCost = product.sample_cost_usd ?? 0;
                const sampleMargin = sampleFee - sampleCost;
                const sampleMarginPct = sampleFee > 0 ? (sampleMargin / sampleFee) * 100 : null;

                return (
                  <div className="space-y-4">
                    {hasProd && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">Production Margin</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            { label: "Target cost", value: product.target_cost_usd != null ? `$${product.target_cost_usd.toFixed(2)}` : "—", neutral: true },
                            { label: "Quoted / sell", value: `$${product.quoted_cost_usd!.toFixed(2)}`, neutral: true },
                            { label: "Unit margin", value: unitMargin != null ? `${unitMargin >= 0 ? "+" : ""}$${unitMargin.toFixed(2)}` : "—", neutral: unitMargin == null, positive: isProfit ?? false },
                            { label: `Total (×${qty.toLocaleString()})`, value: totalMargin != null ? `${totalMargin >= 0 ? "+" : ""}$${totalMargin.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—", neutral: totalMargin == null, positive: isProfit ?? false },
                          ].map(({ label, value, neutral, positive }) => (
                            <div key={label} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
                              <p className={cn("mt-0.5 font-mono text-[15px] font-semibold", neutral ? "text-[var(--sa-text-primary)]" : positive ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-[var(--sa-hover)] px-3 py-2">
                          {isProfit ? <TrendingUp size={13} className="text-[var(--sa-success)] shrink-0" /> : <TrendingDown size={13} className="text-[var(--sa-danger)] shrink-0" />}
                          <span className={cn("text-[13px] font-semibold", isProfit ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                            {isProfit ? "In profit" : "Below target"} · {marginPct != null ? `${Math.abs(marginPct).toFixed(1)}% margin` : "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    {hasSampling && (
                      <div className="space-y-3">
                        {hasProd && <div className="border-t border-[var(--sa-border)]" />}
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">Sampling P&L</p>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "Fee charged", value: sampleFee > 0 ? `$${sampleFee.toFixed(2)}` : "—", neutral: true },
                            { label: "Internal cost", value: sampleCost > 0 ? `$${sampleCost.toFixed(2)}` : "—", neutral: true },
                            { label: "Sample margin", value: `${sampleMargin >= 0 ? "+" : ""}$${sampleMargin.toFixed(2)}`, positive: sampleMargin >= 0 },
                          ].map(({ label, value, neutral, positive }) => (
                            <div key={label} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
                              <p className={cn("mt-0.5 font-mono text-[15px] font-semibold", neutral ? "text-[var(--sa-text-primary)]" : positive ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-[var(--sa-hover)] px-3 py-2">
                          {sampleMargin >= 0 ? <TrendingUp size={13} className="text-[var(--sa-success)] shrink-0" /> : <TrendingDown size={13} className="text-[var(--sa-danger)] shrink-0" />}
                          <span className={cn("text-[13px] font-semibold", sampleMargin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                            {sampleMargin >= 0 ? "Sampling profitable" : "Sampling at a loss"}
                            {sampleMarginPct != null ? ` · ${Math.abs(sampleMarginPct).toFixed(1)}% margin` : ""}
                          </span>
                          {(sampleFee === 0 && sampleCost > 0) && (
                            <span className="ml-auto text-[11px] text-[var(--sa-text-tertiary)]">No fee set — unrecovered cost</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CollapsibleSection>
          )}
        </div>

        {/* Right column — below on mobile, sidebar on desktop */}
        <div className="px-4 py-5 space-y-4 bg-[var(--sa-window)] border-t md:border-t-0 md:border-l border-[var(--sa-border)] md:flex-[3] md:min-w-64 md:max-w-80 md:overflow-y-auto">

          {/* Pricing */}
          <PricingCard product={product} onSaved={(updates) => setProduct((p) => ({ ...p, ...updates }))} />

          {/* Volume pricing tiers */}
          <VolumePricingCard kind="client" product={product} onSaved={(updates) => setProduct((p) => ({ ...p, ...updates }))} />
          <VolumePricingCard kind="internal" product={product} onSaved={(updates) => setProduct((p) => ({ ...p, ...updates }))} />

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

          {/* Quick add task */}
          <section className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-bg)]">
            <div className="flex items-center justify-between px-4 py-3 panel-border-b">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Tasks</span>
              <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1 text-[11px] text-[var(--sa-accent)] hover:opacity-70 transition-opacity">
                <Plus size={11} strokeWidth={2.5} /> Add
              </button>
            </div>
            <p className="px-4 py-3 text-[12px] text-[var(--sa-text-tertiary)]">
              Tasks linked to this product appear on the Task board.
            </p>
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
        {showAddMaterial && (
          <AddMaterialModal
            productId={product.id}
            existingBom={localBom}
            onClose={() => setShowAddMaterial(false)}
            onSaved={(bom) => setLocalBom(bom)}
          />
        )}
        {showAddSample && (
          <AddSampleModal
            productId={product.id}
            nextRound={localSamples.length + 1}
            onClose={() => setShowAddSample(false)}
            onSaved={(s) => setLocalSamples((prev) => [...prev, s])}
          />
        )}
        {showAddTask && project && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddTask(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <QuickAddTask
              projectId={project.id}
              productId={product.id}
              onClose={() => setShowAddTask(false)}
            />
          </div>
        )}
        {showEdit && (
          <EditProductDrawer
            product={product}
            factories={factories}
            onClose={() => setShowEdit(false)}
            onSaved={handleSaved}
          />
        )}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl p-6"
            >
              <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-2">Delete product?</h2>
              <p className="text-[13px] text-[var(--sa-text-secondary)] mb-2">
                <span className="font-semibold text-[var(--sa-text-primary)]">{product.name}</span> will be permanently deleted.
              </p>
              <p className="text-[12px] text-[var(--sa-danger)] mb-5">This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-[var(--sa-danger)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
