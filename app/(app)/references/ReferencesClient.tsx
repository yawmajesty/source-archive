"use client";

import { useState, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, ChevronDown } from "lucide-react";
import { supabaseData as supabase } from "@/lib/supabase-data";
import { supabase as browserClient } from "@/lib/supabase";
import { uploadFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { ReferenceSample, Factory } from "@/lib/data";

interface Props {
  samples: ReferenceSample[];
  factories: Factory[];
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  submitted:   { label: "Submitted",   cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  in_transit:  { label: "In transit",  cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  arrived:     { label: "Arrived",     cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
  in_factory:  { label: "At factory",  cls: "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  returned:    { label: "Returned",    cls: "bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400" },
};

const PURPOSE_CFG: Record<string, { label: string; cls: string }> = {
  shape:   { label: "Shape",   cls: "bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400" },
  fit:     { label: "Fit",     cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  fabric:  { label: "Fabric",  cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  other:   { label: "Other",   cls: "bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.submitted;
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap", cfg.cls)}>{cfg.label}</span>;
}

function PurposePill({ purpose }: { purpose: string }) {
  const cfg = PURPOSE_CFG[purpose] ?? PURPOSE_CFG.other;
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.cls)}>{cfg.label}</span>;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-0.5">{label}</p>
      <p className="text-[13px] text-[var(--sa-text-primary)]">{value}</p>
    </div>
  );
}

function ReferenceDetail({
  sample: initial,
  factories,
  onClose,
  onUpdate,
}: {
  sample: ReferenceSample;
  factories: Factory[];
  onClose: () => void;
  onUpdate: (updated: ReferenceSample) => void;
}) {
  const [sample, setSample] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [agencyImages, setAgencyImages] = useState<string[]>(initial.agency_images ?? []);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  async function save(patch: Partial<ReferenceSample>) {
    const merged = { ...sample, ...patch };
    setSample(merged);
    startTransition(async () => {
      await supabase.from("reference_samples").update(patch).eq("id", sample.id);
      onUpdate(merged);
    });
  }

  async function handleAgencyImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingImg(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `references/${sample.id}/agency-${Date.now()}-${file.name}`;
      const { url } = await uploadFile("product-media", path, file);
      if (url) newUrls.push(url);
    }
    if (newUrls.length) {
      const updated = [...agencyImages, ...newUrls];
      setAgencyImages(updated);
      await save({ agency_images: updated });
    }
    setUploadingImg(false);
    if (imgRef.current) imgRef.current.value = "";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-[var(--sa-window)] border-l border-[var(--sa-border)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--sa-border)]">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">{sample.item_description}</h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">
            {sample.client_name}{sample.brand ? ` · ${sample.brand}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] px-2 py-1">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

        {/* Status + purpose */}
        <div className="flex flex-wrap gap-1.5">
          <StatusPill status={sample.status} />
          {sample.reference_for.map((p) => <PurposePill key={p} purpose={p} />)}
          {sample.reference_for_other && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", PURPOSE_CFG.other.cls)}>{sample.reference_for_other}</span>
          )}
        </div>

        {/* Submission info */}
        <div className="flex flex-col gap-3">
          <DetailRow label="Submitted" value={formatDate(sample.submitted_at)} />
          <DetailRow label="Product linked" value={sample.product_name} />
          <DetailRow label="Brand" value={sample.brand} />
          <DetailRow label="Size" value={sample.size} />
          <DetailRow label="Courier" value={sample.courier} />
          <DetailRow label="Tracking number" value={sample.tracking_number} />
          <DetailRow label="Expected arrival" value={sample.expected_arrival_date} />
          <DetailRow label="Client notes" value={sample.client_notes} />
        </div>

        {/* Client photos */}
        {sample.client_images.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Client photos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {sample.client_images.map((url) => (
                <img key={url} src={url} alt="" className="aspect-square rounded-lg object-cover w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Status update */}
        <div className="border-t border-[var(--sa-border)] pt-4">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Update status</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_CFG).map(([s, cfg]) => (
              <button
                key={s}
                disabled={isPending}
                onClick={() => save({ status: s })}
                className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                  sample.status === s
                    ? "border-[var(--sa-accent)] text-[var(--sa-accent)] bg-[var(--sa-selected)]"
                    : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                )}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Location</p>
          <div className="flex gap-2 mb-2">
            {[{ value: "agency", label: "With us" }, { value: "factory", label: "At factory" }].map((opt) => (
              <button
                key={opt.value}
                disabled={isPending}
                onClick={() => save({ location: opt.value, factory_id: opt.value === "agency" ? null : sample.factory_id })}
                className={cn("rounded-lg px-3 py-1.5 text-[12px] border transition-colors",
                  sample.location === opt.value
                    ? "border-[var(--sa-accent)] text-[var(--sa-accent)] bg-[var(--sa-selected)] font-medium"
                    : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {sample.location === "factory" && (
            <div className="relative">
              <select
                value={sample.factory_id ?? ""}
                disabled={isPending}
                onChange={(e) => save({ factory_id: e.target.value || null })}
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-primary)] appearance-none pr-8"
              >
                <option value="">Select factory…</option>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sa-text-tertiary)] pointer-events-none" />
            </div>
          )}
        </div>

        {/* Agency fields */}
        <div className="flex flex-col gap-3">
          {[
            { label: "Received date", key: "received_date" as const, placeholder: "e.g. 2025-06-01" },
            { label: "Condition on arrival", key: "condition_notes" as const, placeholder: "e.g. Good condition, slight wear on collar" },
            { label: "Internal notes", key: "internal_notes" as const, placeholder: "Internal notes (not visible to client)" },
            { label: "Assigned to", key: "assigned_to" as const, placeholder: "Team member name" },
            { label: "Return tracking number", key: "return_tracking_number" as const, placeholder: "Return shipment tracking" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">{label}</p>
              <input
                type="text"
                defaultValue={sample[key] ?? ""}
                placeholder={placeholder}
                onBlur={(e) => { if (e.target.value !== (sample[key] ?? "")) save({ [key]: e.target.value || null }); }}
                className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--sa-accent)]"
              />
            </div>
          ))}
        </div>

        {/* Agency photos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)]">Agency photos (on arrival)</p>
            <button
              onClick={() => imgRef.current?.click()}
              disabled={uploadingImg}
              className="flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 border border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors disabled:opacity-50"
            >
              <Upload size={11} /> {uploadingImg ? "Uploading…" : "Add photo"}
            </button>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAgencyImageUpload} />
          </div>
          {agencyImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {agencyImages.map((url) => (
                <div key={url} className="group relative aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    onClick={() => {
                      const updated = agencyImages.filter((u) => u !== url);
                      setAgencyImages(updated);
                      save({ agency_images: updated });
                    }}
                    className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-[10px]"
                  >✕</button>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => imgRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-dashed border border-[var(--sa-border)] py-5 text-[11px] text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] transition-colors"
            >
              <Upload size={14} strokeWidth={1.5} /> Upload arrival photos
            </button>
          )}
        </div>

      </div>
    </motion.div>
  );
}

const ALL_STATUSES = ["all", ...Object.keys(STATUS_CFG)] as const;

export function ReferencesClient({ samples: initial, factories }: Props) {
  const [samples, setSamples] = useState(initial);
  const [selected, setSelected] = useState<ReferenceSample | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? samples : samples.filter((s) => s.status === filter);
  const counts = Object.keys(STATUS_CFG).reduce((acc, s) => {
    acc[s] = samples.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  function handleUpdate(updated: ReferenceSample) {
    setSamples((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setSelected(updated);
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn("flex flex-col overflow-hidden transition-all", selected ? "flex-1" : "w-full")}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Reference Samples</h1>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{samples.length} total</p>
          </div>
        </div>

        {/* Status filter bar */}
        <div className="flex items-center gap-3 px-6 py-3 panel-border-b bg-[var(--sa-window)] overflow-x-auto">
          {ALL_STATUSES.map((s) => {
            const cfg = s === "all" ? null : STATUS_CFG[s];
            const count = s === "all" ? samples.length : (counts[s] ?? 0);
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn("flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                  filter === s
                    ? "border-[var(--sa-accent)] text-[var(--sa-accent)] bg-[var(--sa-selected)]"
                    : "border-transparent text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                )}
              >
                {cfg ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", cfg.cls)}>{cfg.label}</span> : "All"}
                <span className="font-mono text-[11px] text-[var(--sa-text-tertiary)]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_140px_160px_140px_110px] gap-3 px-5 py-2 bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
          {["Item / Client", "Brand", "Purpose", "Status", "Submitted"].map((h) => (
            <span key={h} className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{h}</span>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-[var(--sa-window)]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--sa-text-tertiary)]">
              <p className="text-[13px]">No reference samples yet</p>
              <p className="text-[11px]">Clients submit them from their portal</p>
            </div>
          ) : filtered.map((s) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              className={cn(
                "grid grid-cols-[1fr_140px_160px_140px_110px] gap-3 w-full items-center px-5 py-3 border-b border-[var(--sa-border)] text-left transition-colors",
                selected?.id === s.id ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
              )}
            >
              <div>
                <p className="text-[13px] font-medium text-[var(--sa-text-primary)] truncate">{s.item_description}</p>
                <p className="text-[11px] text-[var(--sa-text-tertiary)]">{s.client_name}{s.product_name ? ` · ${s.product_name}` : ""}</p>
              </div>
              <span className="text-[12px] text-[var(--sa-text-secondary)] truncate">{s.brand || "—"}</span>
              <div className="flex flex-wrap gap-1">
                {s.reference_for.map((p) => <PurposePill key={p} purpose={p} />)}
              </div>
              <StatusPill status={s.status} />
              <span className="text-[11px] text-[var(--sa-text-tertiary)]">{formatDate(s.submitted_at)}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <div className="w-96 shrink-0 overflow-hidden">
            <ReferenceDetail
              key={selected.id}
              sample={selected}
              factories={factories}
              onClose={() => setSelected(null)}
              onUpdate={handleUpdate}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
