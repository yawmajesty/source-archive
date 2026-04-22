"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, MapPin, Phone, Mail, Package, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { Factory, Product } from "@/lib/mock-data";

interface Props {
  factories: Factory[];
  products: Product[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          strokeWidth={1.5}
          className={i < rating ? "fill-[var(--sa-gold)] text-[var(--sa-gold)]" : "text-[var(--sa-border-strong)]"}
        />
      ))}
    </div>
  );
}

function AddFactoryDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(3);
  const [hoverRating, setHoverRating] = useState(0);

  const nameRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const categoriesRef = useRef<HTMLInputElement>(null);
  const specialitiesRef = useRef<HTMLInputElement>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);
  const contactEmailRef = useRef<HTMLInputElement>(null);
  const contactPhoneRef = useRef<HTMLInputElement>(null);
  const minOrderRef = useRef<HTMLInputElement>(null);
  const moqRef = useRef<HTMLInputElement>(null);
  const sampleLeadRef = useRef<HTMLInputElement>(null);
  const prodLeadRef = useRef<HTMLInputElement>(null);
  const capacityRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

  async function handleSave() {
    const name = nameRef.current?.value.trim();
    if (!name) { setError("Factory name is required"); return; }
    setSaving(true);
    setError("");

    const parseList = (val: string | undefined) =>
      (val ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    const { error: err } = await supabase.from("factories").insert({
      id: "factory-" + Date.now(),
      name,
      city: cityRef.current?.value.trim() || "",
      country: countryRef.current?.value.trim() || "",
      categories: parseList(categoriesRef.current?.value),
      specialities: parseList(specialitiesRef.current?.value),
      rating,
      contact_name: contactNameRef.current?.value.trim() || "",
      contact_email: contactEmailRef.current?.value.trim() || "",
      contact_phone: contactPhoneRef.current?.value.trim() || "",
      min_order_value: parseFloat(minOrderRef.current?.value || "0") || 0,
      moq_units: parseInt(moqRef.current?.value || "0") || 0,
      sample_lead_time_days: parseInt(sampleLeadRef.current?.value || "0") || 0,
      lead_time_days: parseInt(prodLeadRef.current?.value || "0") || 0,
      capacity_per_month: parseInt(capacityRef.current?.value || "0") || 0,
      established_year: parseInt(yearRef.current?.value || "0") || null,
      notes: notesRef.current?.value.trim() || "",
    });

    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-[var(--sa-window)] shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Add Factory</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Basic info */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)] mb-3">Basic Info</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Factory name *</label>
                <input ref={nameRef} autoFocus className={inputCls} placeholder="e.g. Sunrise Textiles Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>City</label><input ref={cityRef} className={inputCls} placeholder="Guangzhou" /></div>
                <div><label className={labelCls}>Country</label><input ref={countryRef} className={inputCls} placeholder="China" /></div>
              </div>
              <div>
                <label className={labelCls}>Rating</label>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseEnter={() => setHoverRating(i + 1)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(i + 1)}
                      className="p-0.5"
                    >
                      <Star
                        size={18}
                        strokeWidth={1.5}
                        className={cn(
                          "transition-colors",
                          i < (hoverRating || rating)
                            ? "fill-[var(--sa-gold)] text-[var(--sa-gold)]"
                            : "text-[var(--sa-border-strong)]"
                        )}
                      />
                    </button>
                  ))}
                  <span className="ml-1 text-[12px] text-[var(--sa-text-tertiary)]">{hoverRating || rating}/5</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Categories (comma separated)</label>
                <input ref={categoriesRef} className={inputCls} placeholder="Apparel, Knitwear, Accessories" />
              </div>
              <div>
                <label className={labelCls}>Specialities (comma separated)</label>
                <input ref={specialitiesRef} className={inputCls} placeholder="Merino wool, Cut & sew, Private label" />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)] mb-3">Contact</p>
            <div className="space-y-3">
              <div><label className={labelCls}>Contact name</label><input ref={contactNameRef} className={inputCls} placeholder="Wei Zhang" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Email</label><input ref={contactEmailRef} type="email" className={inputCls} placeholder="wei@factory.com" /></div>
                <div><label className={labelCls}>Phone / WeChat</label><input ref={contactPhoneRef} className={inputCls} placeholder="+86 20 1234 5678" /></div>
              </div>
            </div>
          </section>

          {/* Capacity & pricing */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)] mb-3">Capacity & Pricing</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Min order value (USD)</label><input ref={minOrderRef} type="number" min="0" className={inputCls} placeholder="5000" /></div>
              <div><label className={labelCls}>MOQ (units)</label><input ref={moqRef} type="number" min="0" className={inputCls} placeholder="500" /></div>
              <div><label className={labelCls}>Sample lead time (days)</label><input ref={sampleLeadRef} type="number" min="0" className={inputCls} placeholder="14" /></div>
              <div><label className={labelCls}>Production lead time (days)</label><input ref={prodLeadRef} type="number" min="0" className={inputCls} placeholder="45" /></div>
              <div><label className={labelCls}>Capacity / month (units)</label><input ref={capacityRef} type="number" min="0" className={inputCls} placeholder="10000" /></div>
              <div><label className={labelCls}>Year established</label><input ref={yearRef} type="number" min="1900" max={new Date().getFullYear()} className={inputCls} placeholder="2005" /></div>
            </div>
          </section>

          {/* Notes */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)] mb-3">Notes</p>
            <textarea ref={notesRef} className={inputCls + " resize-none"} rows={3} placeholder="Any additional notes about this factory…" />
          </section>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            {saving ? "Saving…" : "Add Factory"}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function DeleteFactoryModal({ factory, onClose }: { factory: Factory; onClose: () => void }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    const { error: err } = await supabase.from("factories").delete().eq("id", factory.id);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Delete factory?</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={16} className="text-[var(--sa-text-tertiary)]" /></button>
        </div>
        <p className="text-[13px] text-[var(--sa-text-secondary)] mb-2">
          <span className="font-semibold text-[var(--sa-text-primary)]">{factory.name}</span> will be permanently removed from your network.
        </p>
        <p className="text-[12px] text-[var(--sa-text-tertiary)] mb-4">Products assigned to this factory will keep their data but lose the factory link.</p>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-[var(--sa-danger)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function FactoryCard({
  factory,
  activeProductCount,
  onDelete,
}: {
  factory: Factory;
  activeProductCount: number;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group flex flex-col gap-4 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 hover:border-[var(--sa-border-strong)] hover:shadow-sm transition-all cursor-default"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--sa-text-primary)] truncate">
            {factory.name}
          </h3>
          <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)]">
            <MapPin size={10} strokeWidth={1.8} />
            <span>{factory.city}, {factory.country}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StarRating rating={factory.rating} />
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg border border-transparent p-1 text-[var(--sa-text-tertiary)] hover:border-[var(--sa-danger)] hover:text-[var(--sa-danger)] transition-all"
            title="Delete factory"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Categories */}
      {factory.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {factory.categories.map((cat) => (
            <span
              key={cat}
              className="rounded-full bg-[var(--sa-hover)] border border-[var(--sa-border)] px-2 py-0.5 text-[10px] text-[var(--sa-text-secondary)]"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Specialities */}
      {factory.specialities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {factory.specialities.map((s) => (
            <span key={s} className="rounded-md bg-[var(--sa-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--sa-accent)] font-medium">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Min order value</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">${factory.min_order_value.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">MOQ (units)</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.moq_units.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Sample lead time</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.sample_lead_time_days}d</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Production lead time</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.lead_time_days}d</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Capacity / month</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.capacity_per_month.toLocaleString()} units</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Est.</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.established_year || "—"}</p>
        </div>
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-1.5 text-[12px] text-[var(--sa-text-secondary)]">
        {factory.contact_name && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[var(--sa-text-primary)]">{factory.contact_name}</span>
          </div>
        )}
        {factory.contact_email && (
          <div className="flex items-center gap-1.5">
            <Mail size={10} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} />
            <span className="truncate">{factory.contact_email}</span>
          </div>
        )}
        {factory.contact_phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={10} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} />
            <span>{factory.contact_phone}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--sa-border)]">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--sa-text-secondary)]">
          <Package size={11} className="text-[var(--sa-text-tertiary)]" />
          <span>
            {activeProductCount > 0
              ? `${activeProductCount} product${activeProductCount > 1 ? "s" : ""} in production`
              : "No active orders"}
          </span>
        </div>
      </div>

      {/* Notes */}
      {factory.notes && (
        <p className="text-[11px] text-[var(--sa-text-tertiary)] italic leading-relaxed border-t border-[var(--sa-border)] pt-3">
          {factory.notes}
        </p>
      )}
    </motion.div>
  );
}

export function FactoriesPageClient({ factories, products }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [deleteFactory, setDeleteFactory] = useState<Factory | null>(null);
  const activeStages = new Set(["production", "qc"]);

  function getActiveCount(factoryId: string) {
    return products.filter(
      (p) => p.factory_id === factoryId && activeStages.has(p.stage)
    ).length;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Factories</h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{factories.length} suppliers in your network</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={13} strokeWidth={2.5} /> Add Factory
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {factories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-[14px] font-medium text-[var(--sa-text-secondary)]">No factories yet</p>
            <p className="text-[13px] text-[var(--sa-text-tertiary)]">Add your first factory to start assigning products.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={13} strokeWidth={2.5} /> Add Factory
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {factories.map((factory) => (
              <FactoryCard
                key={factory.id}
                factory={factory}
                activeProductCount={getActiveCount(factory.id)}
                onDelete={() => setDeleteFactory(factory)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddFactoryDrawer onClose={() => setShowAdd(false)} />}
        {deleteFactory && (
          <DeleteFactoryModal factory={deleteFactory} onClose={() => setDeleteFactory(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
