"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/data";

interface Props { leads: Lead[] }

const STATUS_CFG: Record<Lead["status"], { label: string; cls: string }> = {
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

function LeadDetail({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const cfg = STATUS_CFG[lead.status];
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
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{lead.contact_name} · {lead.country}</p>
        </div>
        <button onClick={onClose} className="text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] px-2 py-1">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", cfg.cls)}>{cfg.label}</span>
          <span className="text-[11px] text-[var(--sa-text-tertiary)]">{formatDate(lead.created_at)}</span>
        </div>

        {[
          ["Email", lead.contact_email],
          ["Industry", lead.industry],
          ["Products of interest", lead.product_interest],
          ["Estimated budget", lead.estimated_budget],
          ["Source", lead.source.replace("_", " ")],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">{k}</p>
            <p className="text-[13px] text-[var(--sa-text-primary)]">{v}</p>
          </div>
        ))}

        {lead.message && (
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Message</p>
            <p className="text-[13px] text-[var(--sa-text-primary)] leading-relaxed whitespace-pre-line">{lead.message}</p>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--sa-border)]">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Update status</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_CFG) as Lead["status"][]).map((s) => (
              <button
                key={s}
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
      </div>
    </motion.div>
  );
}

export function LeadsClient({ leads }: Props) {
  const [selected, setSelected] = useState<Lead | null>(null);

  const counts = (Object.keys(STATUS_CFG) as Lead["status"][]).reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {} as Record<Lead["status"], number>);

  const briefLink = typeof window !== "undefined" ? `${window.location.origin}/brief` : "/brief";

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn("flex flex-col overflow-hidden transition-all", selected ? "flex-1" : "w-full")}>
        {/* Header */}
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

        {/* Status summary */}
        <div className="flex items-center gap-3 px-6 py-3 panel-border-b bg-[var(--sa-window)] overflow-x-auto">
          {(Object.entries(STATUS_CFG) as [Lead["status"], typeof STATUS_CFG[Lead["status"]]][]).map(([s, cfg]) => (
            <div key={s} className="flex items-center gap-1.5 shrink-0">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.cls)}>{cfg.label}</span>
              <span className="text-[12px] font-mono text-[var(--sa-text-secondary)]">{counts[s] ?? 0}</span>
            </div>
          ))}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_160px_140px_120px_100px] gap-3 px-5 py-2 bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
          {["Company", "Contact", "Interest", "Budget", "Status"].map((h) => (
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
                  "grid grid-cols-[1fr_160px_140px_120px_100px] gap-3 w-full items-center px-5 py-3 border-b border-[var(--sa-border)] text-left transition-colors",
                  selected?.id === lead.id
                    ? "bg-[var(--sa-selected)]"
                    : "hover:bg-[var(--sa-hover)]"
                )}
              >
                <div>
                  <p className="text-[13px] font-medium text-[var(--sa-text-primary)] truncate">{lead.company_name}</p>
                  <p className="text-[11px] text-[var(--sa-text-tertiary)]">{lead.country} · {formatDate(lead.created_at)}</p>
                </div>
                <span className="text-[12px] text-[var(--sa-text-secondary)] truncate">{lead.contact_name}</span>
                <span className="text-[12px] text-[var(--sa-text-secondary)] truncate">{lead.product_interest}</span>
                <span className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{lead.estimated_budget || "—"}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium w-fit", cfg.cls)}>{cfg.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0 overflow-hidden">
          <LeadDetail lead={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
