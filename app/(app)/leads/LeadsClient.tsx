"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Plus, Trash2, Copy, CheckCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateLeadStatus, convertLeadToClient, createLead, deleteLead } from "./actions";
import { buildPublicUrl } from "@/lib/url";
import type { Lead } from "@/lib/data";

interface Props { leads: Lead[] }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  new:           { label: "New",           cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  contacted:     { label: "Contacted",     cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  qualified:     { label: "Qualified",     cls: "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  proposal_sent: { label: "Proposal sent", cls: "bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" },
  converted:     { label: "Converted",     cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
  lost:          { label: "Lost",          cls: "bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400" },
};

const SOURCE_OPTIONS = ["brief_form", "referral", "direct", "cold_outreach", "event", "social", "other"];

function CopyLink({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(buildPublicUrl(path));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-center rounded-lg border border-[var(--sa-border)] overflow-hidden text-[11px]">
      <span className="px-2 py-1.5 text-[10px] text-[var(--sa-text-tertiary)] bg-[var(--sa-bg)] border-r border-[var(--sa-border)] whitespace-nowrap font-medium">{label}</span>
      <span className="px-2.5 py-1.5 font-mono text-[var(--sa-text-secondary)] bg-[var(--sa-window)]">{path}</span>
      <button
        onClick={copy}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 border-l border-[var(--sa-border)] font-medium transition-colors whitespace-nowrap",
          copied
            ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10"
            : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
        )}
      >
        {copied ? <><CheckCheck size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
      </button>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--sa-accent)]";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-0.5">{label}</p>
      <p className="text-[13px] text-[var(--sa-text-primary)]">{value}</p>
    </div>
  );
}

function AddLeadPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", contact_email: "",
    phone: "", country: "", industry: "",
    estimated_budget: "", source: "", message: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name || !form.contact_name || !form.contact_email) return;
    setSaving(true);
    await createLead({
      company_name: form.company_name,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      phone: form.phone || null,
      country: form.country || null,
      industry: form.industry || null,
      estimated_budget: form.estimated_budget || null,
      source: form.source || null,
      message: form.message || null,
    });
    onCreated();
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-[var(--sa-window)] border-l border-[var(--sa-border)]"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
        <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Add lead</h2>
        <button onClick={onClose} className="text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] px-2 py-1">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Company</p>
          <div className="flex flex-col gap-2">
            <input required placeholder="Company name *" value={form.company_name} onChange={set("company_name")} className={INPUT} />
            <input placeholder="Industry" value={form.industry} onChange={set("industry")} className={INPUT} />
            <input placeholder="Country" value={form.country} onChange={set("country")} className={INPUT} />
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Contact</p>
          <div className="flex flex-col gap-2">
            <input required placeholder="Contact name *" value={form.contact_name} onChange={set("contact_name")} className={INPUT} />
            <input required type="email" placeholder="Email *" value={form.contact_email} onChange={set("contact_email")} className={INPUT} />
            <input placeholder="Phone" value={form.phone} onChange={set("phone")} className={INPUT} />
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Details</p>
          <div className="flex flex-col gap-2">
            <input placeholder="Estimated budget" value={form.estimated_budget} onChange={set("estimated_budget")} className={INPUT} />
            <div className="relative">
              <select value={form.source} onChange={set("source")} className={cn(INPUT, "appearance-none pr-7")}>
                <option value="">Source…</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Notes</p>
          <textarea
            rows={3}
            placeholder="Any context or notes…"
            value={form.message}
            onChange={set("message")}
            className={cn(INPUT, "resize-none")}
          />
        </div>

        <div className="pt-2 border-t border-[var(--sa-border)] flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-[13px] border border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold bg-[var(--sa-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "Saving…" : "Add lead"}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function LeadDetail({ lead: initial, onClose, onDelete }: { lead: Lead; onClose: () => void; onDelete: () => void }) {
  const [lead, setLead] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [converting, setConverting] = useState(false);
  const [convertedClientId, setConvertedClientId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function setStatus(status: string) {
    startTransition(async () => {
      await updateLeadStatus(lead.id, status);
      setLead((prev) => ({ ...prev, status: status as Lead["status"] }));
    });
  }

  async function handleConvert() {
    setConverting(true);
    const { clientId } = await convertLeadToClient(lead.id);
    setLead((prev) => ({ ...prev, status: "converted" }));
    setConvertedClientId(clientId);
    setConverting(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete the lead for ${lead.company_name}? This cannot be undone.`)) return;
    setDeleting(true);
    await deleteLead(lead.id);
    onDelete();
  }

  const products = lead.brief_products as any[] | undefined;
  // Reference links: typed URLs only (drop accidental uploaded-file URLs from older brief submissions)
  const moodboardLinks = (lead.moodboard_links as string | null)?.split("\n").map((s) => s.trim()).filter(Boolean) ?? [];
  // Global files attached to the brief
  const briefFiles = (lead.brief_files as string[] | null) ?? [];
  // Legacy: older briefs that stuffed file URLs into moodboard_links — fish them out
  const legacyFileUrls = moodboardLinks.filter((l) => /\.(png|jpe?g|webp|gif|pdf|heic|heif|svg)(\?|$)/i.test(l));
  const cleanLinks = moodboardLinks.filter((l) => !/\.(png|jpe?g|webp|gif|pdf|heic|heif|svg)(\?|$)/i.test(l));
  const allFiles = [...briefFiles, ...legacyFileUrls];
  const isConverted = lead.status === "converted";

  function fileMeta(url: string) {
    const isImage = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url);
    const isPdf = /\.pdf(\?|$)/i.test(url);
    const name = decodeURIComponent(url.split("/").pop() ?? "file").split("?")[0];
    return { isImage, isPdf, name };
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full bg-[var(--sa-window)] border-l border-[var(--sa-border)]"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">{lead.company_name}</h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{lead.contact_name} · {formatDate(lead.created_at)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-[var(--sa-text-tertiary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
            title="Delete lead"
          >
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] px-2 py-1">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", STATUS_CFG[lead.status]?.cls)}>{STATUS_CFG[lead.status]?.label}</span>
          {lead.brand_stage && (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-[var(--sa-bg)] border border-[var(--sa-border)] text-[var(--sa-text-secondary)] capitalize">{lead.brand_stage}</span>
          )}
          {lead.how_found_us && (
            <span className="rounded-full px-2.5 py-1 text-[11px] text-[var(--sa-text-tertiary)]">via {lead.how_found_us}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" value={lead.contact_email} />
          <Field label="Phone" value={lead.phone} />
          <Field label="Country" value={lead.country} />
          <Field label="Industry" value={lead.industry} />
          {lead.website && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-0.5">Website</p>
              <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-[var(--sa-accent)] hover:underline">
                {lead.website} <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--sa-border)]">
          <Field label="Manufactured before" value={lead.manufactured_before === true ? "Yes" : lead.manufactured_before === false ? "No" : null} />
          <Field label="Target timeline" value={lead.timeline} />
          <Field label="Budget" value={lead.estimated_budget} />
          <Field label="Sustainability" value={lead.sustainability_requirements} />
        </div>

        {products && products.length > 0 && (
          <div className="pt-2 border-t border-[var(--sa-border)]">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-3">Products ({products.length})</p>
            <div className="flex flex-col gap-3">
              {products.map((p: any, i: number) => (
                <div key={i} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">{p.name}</p>
                    {p.category && <span className="text-[10px] rounded-full px-2 py-0.5 bg-[var(--sa-hover)] text-[var(--sa-text-secondary)] shrink-0">{p.category}</span>}
                  </div>
                  {p.description && <p className="text-[11px] text-[var(--sa-text-secondary)] mt-1 leading-relaxed">{p.description}</p>}
                  <div className="flex flex-wrap gap-3 mt-2">
                    {p.target_qty && <span className="text-[11px] text-[var(--sa-text-tertiary)]">{p.target_qty.toLocaleString()} units</span>}
                    {p.target_price_usd && <span className="text-[11px] text-[var(--sa-text-tertiary)]">${p.target_price_usd}/unit</span>}
                    {p.colorways && <span className="text-[11px] text-[var(--sa-text-tertiary)]">{p.colorways} colourways</span>}
                  </div>
                  {p.sustainability && <p className="text-[10px] text-[var(--sa-text-tertiary)] mt-1.5">♻ {p.sustainability}</p>}
                  {p.moodboard_link && (
                    <a href={p.moodboard_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-[var(--sa-accent)] hover:underline mt-1.5">
                      <ExternalLink size={9} /> View reference
                    </a>
                  )}
                  {Array.isArray(p.moodboard_files) && p.moodboard_files.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--sa-border)]">
                      <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-1.5">Attached files</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(p.moodboard_files as string[]).map((url, idx) => {
                          const { isImage, isPdf, name } = fileMeta(url);
                          return isImage ? (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="block">
                              <img src={url} alt={name} className="h-14 w-14 rounded-md object-cover border border-[var(--sa-border)] hover:opacity-90" />
                            </a>
                          ) : (
                            <a key={idx} href={url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-2 py-1 text-[10px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                            >
                              {isPdf ? "📄" : "📎"} {name}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {allFiles.length > 0 && (
          <div className="pt-2 border-t border-[var(--sa-border)]">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">
              Files & images ({allFiles.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {allFiles.map((url, i) => {
                const { isImage, isPdf, name } = fileMeta(url);
                return isImage ? (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="block group">
                    <img src={url} alt={name} className="h-20 w-20 rounded-lg object-cover border border-[var(--sa-border)] group-hover:opacity-90" />
                  </a>
                ) : (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] max-w-full truncate"
                  >
                    {isPdf ? "📄" : "📎"} <span className="truncate">{name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {cleanLinks.length > 0 && (
          <div className="pt-2 border-t border-[var(--sa-border)]">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Reference links</p>
            <div className="flex flex-col gap-1">
              {cleanLinks.map((link, i) => (
                <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] text-[var(--sa-accent)] hover:underline truncate">
                  <ExternalLink size={10} /> {link}
                </a>
              ))}
            </div>
          </div>
        )}

        {lead.message && (
          <div className="pt-2 border-t border-[var(--sa-border)]">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Notes</p>
            <p className="text-[13px] text-[var(--sa-text-primary)] leading-relaxed whitespace-pre-line">{lead.message}</p>
          </div>
        )}

        {!isConverted && (
          <div className="pt-2 border-t border-[var(--sa-border)]">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Update status</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_CFG) as string[]).filter((s) => s !== "converted").map((s) => (
                <button
                  key={s}
                  disabled={isPending}
                  onClick={() => setStatus(s)}
                  className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                    lead.status === s
                      ? "border-[var(--sa-accent)] text-[var(--sa-accent)] bg-[var(--sa-selected)]"
                      : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                  )}
                >
                  {STATUS_CFG[s].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--sa-border)]">
          {isConverted && convertedClientId ? (
            <a
              href={`/clients/${convertedClientId}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-[13px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Check size={14} /> View client profile <ArrowRight size={14} />
            </a>
          ) : isConverted ? (
            <div className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-[13px] font-semibold bg-emerald-50 text-emerald-700">
              <Check size={14} /> Already converted to client
            </div>
          ) : (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-[13px] font-semibold bg-[var(--sa-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {converting ? "Creating client…" : <><ArrowRight size={14} /> Convert to client</>}
            </button>
          )}
          {!isConverted && <p className="text-[10px] text-[var(--sa-text-tertiary)] text-center mt-2">Creates a client profile, project, and all brief products automatically.</p>}
        </div>

      </div>
    </motion.div>
  );
}

export function LeadsClient({ leads }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const counts = (Object.keys(STATUS_CFG) as string[]).reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const rightPanel = showAdd ? "add" : selected ? "detail" : null;

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn("flex flex-col overflow-hidden transition-all", rightPanel ? "flex-1" : "w-full")}>
        <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Leads</h1>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{leads.length} total · {counts.new ?? 0} new</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setSelected(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={12} /> Add lead
          </button>
        </div>

        {/* Shareable form links */}
        <div className="flex items-center gap-3 px-6 py-2.5 panel-border-b bg-[var(--sa-bg)] overflow-x-auto">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] shrink-0">Share forms</span>
          <CopyLink label="Quick enquiry" path="/enquire" />
          <CopyLink label="Full brief" path="/brief" />
        </div>

        <div className="flex items-center gap-3 px-6 py-3 panel-border-b bg-[var(--sa-window)] overflow-x-auto">
          {(Object.entries(STATUS_CFG) as [string, typeof STATUS_CFG[string]][]).map(([s, cfg]) => (
            <div key={s} className="flex items-center gap-1.5 shrink-0">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.cls)}>{cfg.label}</span>
              <span className="text-[12px] font-mono text-[var(--sa-text-secondary)]">{counts[s] ?? 0}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_130px_120px_110px_100px] gap-3 px-5 py-2 bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
          {["Company", "Contact", "Budget", "Timeline", "Status"].map((h) => (
            <span key={h} className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{h}</span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-[var(--sa-window)]">
          {leads.map((lead) => {
            const cfg = STATUS_CFG[lead.status];
            return (
              <motion.button
                key={lead.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { setSelected(selected?.id === lead.id ? null : lead); setShowAdd(false); }}
                className={cn(
                  "grid grid-cols-[1fr_130px_120px_110px_100px] gap-3 w-full items-center px-5 py-3 border-b border-[var(--sa-border)] text-left transition-colors",
                  selected?.id === lead.id ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
                )}
              >
                <div>
                  <p className="text-[13px] font-medium text-[var(--sa-text-primary)] truncate">{lead.company_name}</p>
                  <p className="text-[11px] text-[var(--sa-text-tertiary)]">{lead.country} · {formatDate(lead.created_at)}</p>
                </div>
                <span className="text-[12px] text-[var(--sa-text-secondary)] truncate">{lead.contact_name}</span>
                <span className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{lead.estimated_budget || "—"}</span>
                <span className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{lead.timeline || "—"}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium w-fit", cfg?.cls)}>{cfg?.label}</span>
              </motion.button>
            );
          })}
          {leads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--sa-text-tertiary)]">
              <p className="text-[13px]">No leads yet</p>
              <p className="text-[11px]">Share the brief link or add one manually</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {rightPanel === "add" && (
          <div className="w-96 shrink-0 overflow-hidden">
            <AddLeadPanel
              onClose={() => setShowAdd(false)}
              onCreated={() => { setShowAdd(false); router.refresh(); }}
            />
          </div>
        )}
        {rightPanel === "detail" && selected && (
          <div className="w-96 shrink-0 overflow-hidden">
            <LeadDetail
              key={selected.id}
              lead={selected}
              onClose={() => setSelected(null)}
              onDelete={() => { setSelected(null); router.refresh(); }}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
