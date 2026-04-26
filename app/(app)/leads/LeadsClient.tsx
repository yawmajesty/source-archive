"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateLeadStatus, convertLeadToClient } from "./actions";
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

function LeadDetail({ lead: initial, onClose }: { lead: Lead; onClose: () => void }) {
  const [lead, setLead] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [converting, setConverting] = useState(false);
  const [convertedClientId, setConvertedClientId] = useState<string | null>(null);

  function setStatus(status: string) {
    startTransition(async () => {
      await updateLeadStatus(lead.id, status);
      setLead((prev) => ({ ...prev, status: status as any }));
    });
  }

  async function handleConvert() {
    setConverting(true);
    const { clientId } = await convertLeadToClient(lead.id);
    setLead((prev) => ({ ...prev, status: "converted" as any }));
    setConvertedClientId(clientId);
    setConverting(false);
  }

  const products = (lead as any).brief_products as any[] | null;
  const moodboardLinks = ((lead as any).moodboard_links as string | null)?.split("\n").filter(Boolean) ?? [];
  const isConverted = lead.status === "converted";

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
        <button onClick={onClose} className="text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] px-2 py-1">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", STATUS_CFG[lead.status]?.cls)}>{STATUS_CFG[lead.status]?.label}</span>
          {(lead as any).brand_stage && (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-[var(--sa-bg)] border border-[var(--sa-border)] text-[var(--sa-text-secondary)] capitalize">{(lead as any).brand_stage}</span>
          )}
          {(lead as any).how_found_us && (
            <span className="rounded-full px-2.5 py-1 text-[11px] text-[var(--sa-text-tertiary)]">via {(lead as any).how_found_us}</span>
          )}
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" value={lead.contact_email} />
          <Field label="Phone" value={(lead as any).phone} />
          <Field label="Country" value={lead.country} />
          <Field label="Industry" value={lead.industry} />
          {(lead as any).website && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-0.5">Website</p>
              <a href={(lead as any).website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-[var(--sa-accent)] hover:underline">
                {(lead as any).website} <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>

        {/* Brand context */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--sa-border)]">
          <Field label="Manufactured before" value={(lead as any).manufactured_before === true ? "Yes" : (lead as any).manufactured_before === false ? "No" : null} />
          <Field label="Target timeline" value={(lead as any).timeline} />
          <Field label="Budget" value={lead.estimated_budget} />
          <Field label="Sustainability" value={(lead as any).sustainability_requirements} />
        </div>

        {/* Products */}
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Moodboard links */}
        {moodboardLinks.length > 0 && (
          <div className="pt-2 border-t border-[var(--sa-border)]">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Reference links</p>
            <div className="flex flex-col gap-1">
              {moodboardLinks.map((link, i) => (
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

        {/* Status update */}
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

        {/* Convert to client */}
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
  const [selected, setSelected] = useState<Lead | null>(null);

  const counts = (Object.keys(STATUS_CFG) as string[]).reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const briefLink = typeof window !== "undefined" ? `${window.location.origin}/brief` : "/brief";

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn("flex flex-col overflow-hidden transition-all", selected ? "flex-1" : "w-full")}>
        <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Leads</h1>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{leads.length} total · {counts.new ?? 0} new</p>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(briefLink)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
            title="Copy brief form link"
          >
            <ExternalLink size={12} />
            Copy brief link
          </button>
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
                onClick={() => setSelected(selected?.id === lead.id ? null : lead)}
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
                <span className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{(lead as any).timeline || "—"}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium w-fit", cfg?.cls)}>{cfg?.label}</span>
              </motion.button>
            );
          })}
          {leads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--sa-text-tertiary)]">
              <p className="text-[13px]">No leads yet</p>
              <p className="text-[11px]">Share the brief link to start collecting enquiries</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <div className="w-96 shrink-0 overflow-hidden">
            <LeadDetail lead={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
