"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Star, MapPin, Phone, Mail, Package, Trash2, X,
  Send, Clock, CheckCircle2, ChevronRight, Copy, Check,
  BarChart3, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { Factory, Product, Rfq } from "@/lib/mock-data";
import { createRfq, closeRfq, getRfqDetail } from "./actions";

interface Props {
  factories: Factory[];
  products: Product[];
  rfqs: Rfq[];
}

// ── Shared styles ────────────────────────────────────────
const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

// ── StarRating ────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={11} strokeWidth={1.5}
          className={i < rating ? "fill-[var(--sa-gold)] text-[var(--sa-gold)]" : "text-[var(--sa-border-strong)]"} />
      ))}
    </div>
  );
}

// ── CopyButton ────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--sa-border)] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] hover:bg-[var(--sa-hover)] transition-colors">
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

// ── RFQ status pill ────────────────────────────────────────
function RfqStatusPill({ status }: { status: Rfq["status"] }) {
  const map = {
    draft: "bg-[var(--sa-hover)] text-[var(--sa-text-secondary)]",
    sent: "bg-blue-50 text-blue-700",
    closed: "bg-[var(--sa-hover)] text-[var(--sa-text-tertiary)]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", map[status])}>
      {status}
    </span>
  );
}

// ── NewRfqDrawer ────────────────────────────────────────
function NewRfqDrawer({ factories, onClose }: { factories: Factory[]; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedFactories, setSelectedFactories] = useState<Set<string>>(new Set());
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

  function toggleFactory(id: string) {
    setSelectedFactories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const title = titleRef.current?.value.trim();
    if (!title) { setError("Title is required"); return; }
    if (selectedFactories.size === 0) { setError("Select at least one factory"); return; }
    setSaving(true);
    setError("");
    const result = await createRfq({
      title,
      description: descRef.current?.value.trim() || null,
      deadline: deadlineRef.current?.value || null,
      factory_ids: Array.from(selectedFactories),
    });
    setSaving(false);
    if ("error" in result) { setError(result.error); return; }
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
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">New RFQ</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className={labelCls}>Title *</label>
            <input ref={titleRef} autoFocus className={inputCls} placeholder="e.g. SS26 Knitwear Sampling Quote" />
          </div>
          <div>
            <label className={labelCls}>Brief / description</label>
            <textarea ref={descRef} className={inputCls + " resize-none"} rows={5}
              placeholder="Describe the items you need priced — fabrics, construction, quantities, any special requirements…" />
          </div>
          <div>
            <label className={labelCls}>Response deadline</label>
            <input ref={deadlineRef} type="date" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Select factories ({selectedFactories.size} selected)</label>
            {factories.length === 0 ? (
              <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-2">No factories in your network yet. Add factories first.</p>
            ) : (
              <div className="mt-2 flex flex-col gap-1.5">
                {factories.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFactory(f.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selectedFactories.has(f.id)
                        ? "border-[var(--sa-accent)] bg-[var(--sa-accent)]/5"
                        : "border-[var(--sa-border)] hover:bg-[var(--sa-hover)]"
                    )}
                  >
                    <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      selectedFactories.has(f.id) ? "border-[var(--sa-accent)] bg-[var(--sa-accent)]" : "border-[var(--sa-border)]")}>
                      {selectedFactories.has(f.id) && <Check size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--sa-text-primary)] truncate">{f.name}</p>
                      <p className="text-[11px] text-[var(--sa-text-tertiary)]">{f.city}, {f.country}</p>
                    </div>
                    <StarRating rating={f.rating} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            <Send size={13} /> {saving ? "Sending…" : "Send RFQ"}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ── RFQ detail panel ────────────────────────────────────────
type RfqDetailData = Awaited<ReturnType<typeof getRfqDetail>>;

function RfqDetailPanel({ rfq, onClose }: { rfq: Rfq; onClose: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<RfqDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, startClose] = useTransition();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    getRfqDetail(rfq.id).then((d) => { setData(d); setLoading(false); });
  }, [rfq.id]);

  function handleClose() {
    startClose(async () => {
      await closeRfq(rfq.id);
      router.refresh();
      onClose();
    });
  }

  const deadline = rfq.deadline
    ? new Date(rfq.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40 bg-black/30" />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[var(--sa-window)] shadow-xl"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--sa-border)]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <RfqStatusPill status={rfq.status} />
              {deadline && <span className="text-[11px] text-[var(--sa-text-tertiary)]">Due {deadline}</span>}
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">{rfq.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {rfq.status === "sent" && (
              <button onClick={handleClose} disabled={closing}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50 transition-colors">
                {closing ? "Closing…" : "Close RFQ"}
              </button>
            )}
            <button onClick={onClose} className="rounded-md p-1.5 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Brief */}
          {rfq.description && (
            <div className="px-5 py-4 border-b border-[var(--sa-border)]">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--sa-text-tertiary)] mb-2">Brief</p>
              <p className="text-[13px] text-[var(--sa-text-secondary)] leading-relaxed whitespace-pre-wrap">{rfq.description}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-[var(--sa-text-tertiary)]">Loading…</div>
          ) : (
            <>
              {/* Factory status */}
              <div className="px-5 py-4 border-b border-[var(--sa-border)]">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--sa-text-tertiary)] mb-3">
                  Factories invited ({data!.invites.length})
                </p>
                <div className="flex flex-col gap-2">
                  {data!.invites.map((inv) => {
                    const url = `${origin}/factory/${inv.token}`;
                    return (
                      <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-[var(--sa-border)] px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">{inv.factory_name}</p>
                          <p className="text-[11px] text-[var(--sa-text-tertiary)] truncate">{url}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {inv.submitted_at ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 size={12} /> Submitted
                            </span>
                          ) : inv.viewed_at ? (
                            <span className="flex items-center gap-1 text-[11px] text-blue-500">
                              <Clock size={11} /> Viewed
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--sa-text-tertiary)]">Pending</span>
                          )}
                          <CopyButton text={url} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comparison */}
              {data!.submissions.length > 0 && (
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={14} className="text-[var(--sa-accent)]" />
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--sa-text-tertiary)]">
                      Pricing comparison ({data!.submissions.length} response{data!.submissions.length !== 1 ? "s" : ""})
                    </p>
                  </div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(data!.submissions.length, 2)}, 1fr)` }}>
                    {data!.submissions.map((sub, si) => (
                      <div key={si} className="rounded-xl border border-[var(--sa-border)] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
                          <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">{sub.factory_name}</p>
                          <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                            {new Date(sub.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        <div className="divide-y divide-[var(--sa-border)]">
                          {sub.tiers.map((tier, ti) => (
                            <div key={ti} className="px-4 py-3">
                              <div className="flex items-baseline justify-between mb-1.5">
                                <span className="text-[11px] text-[var(--sa-text-tertiary)]">MOQ {tier.moq.toLocaleString()} units</span>
                                <span className="font-mono text-[15px] font-bold text-[var(--sa-text-primary)]">${tier.unit_price_usd.toFixed(2)}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--sa-text-tertiary)]">
                                {tier.lead_time_days != null && <span>{tier.lead_time_days}d lead time</span>}
                                {tier.sample_fee_usd != null && <span>${tier.sample_fee_usd} sample fee</span>}
                              </div>
                              {tier.notes && <p className="mt-1 text-[11px] text-[var(--sa-text-secondary)] italic">{tier.notes}</p>}
                            </div>
                          ))}
                        </div>
                        {sub.notes && (
                          <div className="px-4 py-3 border-t border-[var(--sa-border)] bg-[var(--sa-bg)]">
                            <p className="text-[11px] text-[var(--sa-text-secondary)] leading-relaxed">{sub.notes}</p>
                          </div>
                        )}
                        {sub.images.length > 0 && (
                          <div className="px-4 py-3 border-t border-[var(--sa-border)] flex gap-2 flex-wrap">
                            {sub.images.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover border border-[var(--sa-border)]" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data!.submissions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Clock size={24} className="text-[var(--sa-text-tertiary)]" />
                  <p className="text-[13px] text-[var(--sa-text-tertiary)]">Waiting for factory responses</p>
                  <p className="text-[11px] text-[var(--sa-text-tertiary)]">Copy the links above and send them to your factories</p>
                </div>
              )}
            </>
          )}
        </div>
      </motion.aside>
    </>
  );
}

// ── AddFactoryDrawer (unchanged) ────────────────────────────────────────
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

  const parseList = (val: string | undefined) => (val ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  async function handleSave() {
    const name = nameRef.current?.value.trim();
    if (!name) { setError("Factory name is required"); return; }
    setSaving(true);
    setError("");
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
          <button onClick={onClose} className="rounded-md p-1.5 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)] mb-3">Basic Info</p>
            <div className="space-y-3">
              <div><label className={labelCls}>Factory name *</label><input ref={nameRef} autoFocus className={inputCls} placeholder="e.g. Sunrise Textiles Ltd" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>City</label><input ref={cityRef} className={inputCls} placeholder="Guangzhou" /></div>
                <div><label className={labelCls}>Country</label><input ref={countryRef} className={inputCls} placeholder="China" /></div>
              </div>
              <div>
                <label className={labelCls}>Rating</label>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button key={i} type="button" onMouseEnter={() => setHoverRating(i + 1)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(i + 1)} className="p-0.5">
                      <Star size={18} strokeWidth={1.5} className={cn("transition-colors", i < (hoverRating || rating) ? "fill-[var(--sa-gold)] text-[var(--sa-gold)]" : "text-[var(--sa-border-strong)]")} />
                    </button>
                  ))}
                  <span className="ml-1 text-[12px] text-[var(--sa-text-tertiary)]">{hoverRating || rating}/5</span>
                </div>
              </div>
              <div><label className={labelCls}>Categories (comma separated)</label><input ref={categoriesRef} className={inputCls} placeholder="Apparel, Knitwear, Accessories" /></div>
              <div><label className={labelCls}>Specialities (comma separated)</label><input ref={specialitiesRef} className={inputCls} placeholder="Merino wool, Cut & sew, Private label" /></div>
            </div>
          </section>
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
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)] mb-3">Notes</p>
            <textarea ref={notesRef} className={inputCls + " resize-none"} rows={3} placeholder="Any additional notes about this factory…" />
          </section>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">{saving ? "Saving…" : "Add Factory"}</button>
        </div>
      </motion.aside>
    </>
  );
}

// ── DeleteFactoryModal (unchanged) ────────────────────────────────────────
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
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Delete factory?</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={16} className="text-[var(--sa-text-tertiary)]" /></button>
        </div>
        <p className="text-[13px] text-[var(--sa-text-secondary)] mb-2"><span className="font-semibold text-[var(--sa-text-primary)]">{factory.name}</span> will be permanently removed from your network.</p>
        <p className="text-[12px] text-[var(--sa-text-tertiary)] mb-4">Products assigned to this factory will keep their data but lose the factory link.</p>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-[var(--sa-danger)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">{deleting ? "Deleting…" : "Delete"}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── FactoryCard (unchanged) ────────────────────────────────────────
function FactoryCard({ factory, activeProductCount, onDelete }: { factory: Factory; activeProductCount: number; onDelete: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
      className="group flex flex-col gap-4 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 hover:border-[var(--sa-border-strong)] hover:shadow-sm transition-all cursor-default">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--sa-text-primary)] truncate">{factory.name}</h3>
          <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)]">
            <MapPin size={10} strokeWidth={1.8} /><span>{factory.city}, {factory.country}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StarRating rating={factory.rating} />
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg border border-transparent p-1 text-[var(--sa-text-tertiary)] hover:border-[var(--sa-danger)] hover:text-[var(--sa-danger)] transition-all" title="Delete factory">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {factory.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {factory.categories.map((cat) => <span key={cat} className="rounded-full bg-[var(--sa-hover)] border border-[var(--sa-border)] px-2 py-0.5 text-[10px] text-[var(--sa-text-secondary)]">{cat}</span>)}
        </div>
      )}
      {factory.specialities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {factory.specialities.map((s) => <span key={s} className="rounded-md bg-[var(--sa-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--sa-accent)] font-medium">{s}</span>)}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Min order value", `$${factory.min_order_value.toLocaleString()}`],
          ["MOQ (units)", factory.moq_units.toLocaleString()],
          ["Sample lead time", `${factory.sample_lead_time_days}d`],
          ["Production lead time", `${factory.lead_time_days}d`],
          ["Capacity / month", `${factory.capacity_per_month.toLocaleString()} units`],
          ["Est.", String(factory.established_year || "—")],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-[var(--sa-bg)] p-2.5">
            <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{k}</p>
            <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 text-[12px] text-[var(--sa-text-secondary)]">
        {factory.contact_name && <span className="font-medium text-[var(--sa-text-primary)]">{factory.contact_name}</span>}
        {factory.contact_email && <div className="flex items-center gap-1.5"><Mail size={10} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} /><span className="truncate">{factory.contact_email}</span></div>}
        {factory.contact_phone && <div className="flex items-center gap-1.5"><Phone size={10} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} /><span>{factory.contact_phone}</span></div>}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-[var(--sa-border)]">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--sa-text-secondary)]">
          <Package size={11} className="text-[var(--sa-text-tertiary)]" />
          <span>{activeProductCount > 0 ? `${activeProductCount} product${activeProductCount > 1 ? "s" : ""} in production` : "No active orders"}</span>
        </div>
      </div>
      {factory.notes && <p className="text-[11px] text-[var(--sa-text-tertiary)] italic leading-relaxed border-t border-[var(--sa-border)] pt-3">{factory.notes}</p>}
    </motion.div>
  );
}

// ── Main page ────────────────────────────────────────
export function FactoriesPageClient({ factories, products, rfqs }: Props) {
  const [tab, setTab] = useState<"factories" | "rfqs">("factories");
  const [showAdd, setShowAdd] = useState(false);
  const [showNewRfq, setShowNewRfq] = useState(false);
  const [deleteFactory, setDeleteFactory] = useState<Factory | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const activeStages = new Set(["production", "qc"]);

  function getActiveCount(factoryId: string) {
    return products.filter((p) => p.factory_id === factoryId && activeStages.has(p.stage)).length;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Factories</h1>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{factories.length} suppliers · {rfqs.length} RFQs</p>
          </div>
          <div className="flex rounded-lg border border-[var(--sa-border)] overflow-hidden">
            <button onClick={() => setTab("factories")} className={cn("px-3 py-1.5 text-[12px] font-medium transition-colors", tab === "factories" ? "bg-[var(--sa-accent)] text-white" : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]")}>Factories</button>
            <button onClick={() => setTab("rfqs")} className={cn("px-3 py-1.5 text-[12px] font-medium transition-colors border-l border-[var(--sa-border)]", tab === "rfqs" ? "bg-[var(--sa-accent)] text-white" : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]")}>
              RFQs {rfqs.length > 0 && <span className="ml-1 opacity-60">{rfqs.length}</span>}
            </button>
          </div>
        </div>
        {tab === "factories" ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity">
            <Plus size={13} strokeWidth={2.5} /> Add Factory
          </button>
        ) : (
          <button onClick={() => setShowNewRfq(true)} className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity">
            <Send size={13} /> New RFQ
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "factories" && (
          <>
            {factories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <p className="text-[14px] font-medium text-[var(--sa-text-secondary)]">No factories yet</p>
                <p className="text-[13px] text-[var(--sa-text-tertiary)]">Add your first factory to start assigning products.</p>
                <button onClick={() => setShowAdd(true)} className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity">
                  <Plus size={13} strokeWidth={2.5} /> Add Factory
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {factories.map((factory) => (
                  <FactoryCard key={factory.id} factory={factory} activeProductCount={getActiveCount(factory.id)} onDelete={() => setDeleteFactory(factory)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "rfqs" && (
          <>
            {rfqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Send size={28} className="text-[var(--sa-text-tertiary)]" />
                <p className="text-[14px] font-medium text-[var(--sa-text-secondary)]">No RFQs yet</p>
                <p className="text-[13px] text-[var(--sa-text-tertiary)]">Send a request for quotation to one or more factories.</p>
                <button onClick={() => setShowNewRfq(true)} className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity">
                  <Send size={13} /> New RFQ
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rfqs.map((rfq) => {
                  const deadline = rfq.deadline
                    ? new Date(rfq.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : null;
                  return (
                    <button
                      key={rfq.id}
                      onClick={() => setSelectedRfq(rfq)}
                      className="flex items-center justify-between rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-3.5 text-left hover:border-[var(--sa-border-strong)] hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RfqStatusPill status={rfq.status} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--sa-text-primary)] truncate">{rfq.title}</p>
                          <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                            {new Date(rfq.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {deadline && ` · Due ${deadline}`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-[var(--sa-text-tertiary)] shrink-0 group-hover:text-[var(--sa-text-primary)] transition-colors" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showAdd && <AddFactoryDrawer onClose={() => setShowAdd(false)} />}
        {showNewRfq && <NewRfqDrawer factories={factories} onClose={() => setShowNewRfq(false)} />}
        {deleteFactory && <DeleteFactoryModal factory={deleteFactory} onClose={() => setDeleteFactory(null)} />}
        {selectedRfq && <RfqDetailPanel rfq={selectedRfq} onClose={() => setSelectedRfq(null)} />}
      </AnimatePresence>
    </div>
  );
}
