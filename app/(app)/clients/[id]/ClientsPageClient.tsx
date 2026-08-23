"use client";

import { setClientStatus } from "../status-actions";
import { CLIENT_STATUSES } from "@/lib/client-status";
import { addClientMember, removeClientMember, type ClientMember } from "../member-actions";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Globe, Package, ChevronRight, Calendar, Plus, Activity, Clock, Copy, Check, Trash2 } from "lucide-react";
import { createProjectForClient, toggleClientPortal } from "../actions";
import { buildPublicUrl } from "@/lib/url";
import { ResizablePanel } from "@/components/layout/ResizablePanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StageTrack } from "@/components/shared/StageTrack";
import { EmptyState } from "@/components/shared/EmptyState";
import { ContextMenu, type ContextMenuItem } from "@/components/shared/ContextMenu";
import { cn } from "@/lib/utils";
import type { Client, Project, Product, Stage } from "@/lib/mock-data";
import type { PortalActivity } from "@/lib/data";

interface ProjectData {
  project: Project;
  products: Product[];
  totalCostGbp: number;
}

interface Props {
  client: Client;
  projectData: ProjectData[];
  portalActivity: PortalActivity;
  clientMembers?: ClientMember[];
}

const PATH_LABELS: Record<string, string> = {
  overview: "Overview",
  sampling: "Sampling quotes",
  projects: "Collections",
  files: "Files",
  contracts: "Contracts",
  references: "References",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "0s";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (mins < 60) return sec > 0 ? `${mins}m ${sec}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

function PortalActivityPanel({ activity, client, portalEnabled, onBack, backLabel }: { activity: PortalActivity; client: Client; portalEnabled: boolean; onBack?: () => void; backLabel?: string }) {
  const maxDayVisits = Math.max(1, ...activity.perDay.map((d) => d.visits));
  const portalUrl = `/portal/${client.id}`;
  const publicPortalUrl = buildPublicUrl(portalUrl);
  const [copied, setCopied] = useState(false);
  function copyPortalLink() {
    navigator.clipboard?.writeText(publicPortalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--sa-bg)]">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        {/* Back link */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] transition-colors"
          >
            <ArrowRight size={11} className="rotate-180" /> {backLabel ?? "Back"}
          </button>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[var(--sa-accent)]" />
              <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Portal activity</h2>
            </div>
            <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">
              How {client.name} is using their portal
            </p>
          </div>
          {portalEnabled && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={copyPortalLink}
                title={publicPortalUrl}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  copied
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10"
                    : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
                )}
              >
                {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy portal link</>}
              </button>
              <a href={portalUrl} target="_blank" rel="noreferrer"
                className="rounded-md border border-[var(--sa-border)] px-2 py-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
              >
                Open ↗
              </a>
            </div>
          )}
        </div>

        {!portalEnabled && (
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4 flex items-center gap-3">
            <Lock size={14} className="text-[var(--sa-text-tertiary)] shrink-0" />
            <p className="text-[12px] text-[var(--sa-text-secondary)]">
              The portal is locked. Enable it for this client to start collecting activity.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total visits", value: activity.totalVisits.toLocaleString() },
            { label: "Sessions", value: activity.uniqueSessions.toLocaleString() },
            { label: "Time on portal", value: formatDuration(activity.totalTimeMs) },
            { label: "Last seen", value: activity.lastVisitAt ? timeAgo(activity.lastVisitAt) : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
              <p className="mt-1 text-[16px] font-semibold text-[var(--sa-text-primary)]">{value}</p>
            </div>
          ))}
        </div>

        {/* 14-day timeline */}
        <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
          <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-3">Visits, last 14 days</p>
          {activity.totalVisits === 0 ? (
            <p className="text-[12px] text-[var(--sa-text-tertiary)] py-3">No activity yet.</p>
          ) : (
            <div className="flex items-end gap-1 h-16">
              {activity.perDay.map((d) => {
                const heightPct = d.visits === 0 ? 4 : Math.max(8, (d.visits / maxDayVisits) * 100);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}: ${d.visits} visit${d.visits === 1 ? "" : "s"}`}>
                    <div
                      className={cn("w-full rounded-sm", d.visits > 0 ? "bg-[var(--sa-accent)]" : "bg-[var(--sa-border)]")}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-[var(--sa-text-tertiary)]">
                      {new Date(d.date).getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top sections + Recent visits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-3">Most visited sections</p>
            {activity.topPaths.length === 0 ? (
              <p className="text-[12px] text-[var(--sa-text-tertiary)]">No data yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activity.topPaths.slice(0, 6).map((p) => {
                  const label = PATH_LABELS[p.path] ?? p.path;
                  const maxMs = activity.topPaths[0].totalMs || 1;
                  const widthPct = Math.max(4, (p.totalMs / maxMs) * 100);
                  return (
                    <div key={p.path}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-[12px] font-medium text-[var(--sa-text-primary)]">{label}</span>
                        <span className="text-[10px] text-[var(--sa-text-tertiary)]">
                          {p.visits} visit{p.visits === 1 ? "" : "s"} · {formatDuration(p.totalMs)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--sa-hover)] overflow-hidden">
                        <div className="h-full bg-[var(--sa-accent)] rounded-full" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] mb-3">Recent visits</p>
            {activity.recent.length === 0 ? (
              <p className="text-[12px] text-[var(--sa-text-tertiary)]">No visits recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                {activity.recent.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[var(--sa-text-primary)] truncate">{PATH_LABELS[v.path] ?? v.path}</span>
                    <span className="flex items-center gap-1 text-[10px] text-[var(--sa-text-tertiary)] shrink-0">
                      {v.duration_ms != null && (
                        <>
                          <Clock size={9} /> {formatDuration(v.duration_ms)} ·
                        </>
                      )}
                      <span>{timeAgo(v.visited_at)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function stageProgress(products: Product[]) {
  const stageOrder: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];
  const total = products.length;
  if (total === 0) return 0;
  const sum = products.reduce((s, p) => s + stageOrder.indexOf(p.stage), 0);
  return Math.round((sum / (total * (stageOrder.length - 1))) * 100);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ProjectDetailPanel({ data, portalEnabled, onNavigate, onBack, onShowActivity }: { data: ProjectData; portalEnabled: boolean; onNavigate: () => void; onBack: () => void; onShowActivity: () => void }) {
  const { project, products, totalCostGbp } = data;
  const progress = stageProgress(products);

  return (
    <motion.div
      key={project.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      {/* Panel 3 header */}
      <div className="flex items-start justify-between px-5 py-4 panel-border-b bg-[var(--sa-window)]">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onBack} className="md:hidden flex items-center justify-center h-7 w-7 rounded-md text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] shrink-0">
            <ArrowRight size={14} className="rotate-180" />
          </button>
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] truncate">{project.name}</h2>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{project.season}</p>
          </div>
        </div>
        <button
          onClick={onNavigate}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity ml-3"
        >
          Open <ArrowRight size={11} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Portal status */}
        <section className="rounded-xl border border-[var(--sa-border)] p-4 flex items-center gap-4 bg-[var(--sa-window)]">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              portalEnabled ? "bg-green-50 dark:bg-green-500/15" : "bg-[var(--sa-hover)]"
            )}
          >
            {portalEnabled
              ? <Globe size={18} className="text-[var(--sa-success)]" />
              : <Lock size={18} className="text-[var(--sa-text-tertiary)]" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
              Client Portal
            </p>
            <p className="text-[12px] text-[var(--sa-text-secondary)]">
              {portalEnabled
                ? "Portal is active — client can view all collections"
                : "Portal is off — toggle it in the panel header"
              }
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onShowActivity}
              className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
            >
              <Activity size={12} /> View activity
            </button>
            {portalEnabled && (
              <a
                href={`/portal/${project.client_id}`}
                target="_blank"
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium bg-[var(--sa-success)] text-white hover:opacity-90 transition-opacity"
              >
                View portal
              </a>
            )}
          </div>
        </section>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Products", value: products.length },
            { label: "Progress", value: `${progress}%` },
            { label: "Cost (USD)", value: `$${totalCostGbp.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-[var(--sa-border)] p-3 bg-[var(--sa-window)]">
              <p className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
              <p className="mt-0.5 font-mono text-[16px] font-semibold text-[var(--sa-text-primary)]">{value}</p>
            </div>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-[12px] text-[var(--sa-text-secondary)]">
          <Calendar size={12} className="text-[var(--sa-text-tertiary)]" />
          <span>{formatDate(project.start_date)}</span>
          <span className="text-[var(--sa-text-tertiary)]">→</span>
          <span>{formatDate(project.target_completion)}</span>
        </div>

        {/* Sampling P&L */}
        {products.some((p) => p.sample_fee_usd != null || p.sample_cost_usd != null) && (() => {
          const totalFee = products.reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);
          const totalCost = products.reduce((s, p) => s + (p.sample_cost_usd ?? 0), 0);
          const margin = totalFee - totalCost;
          const marginPct = totalFee > 0 ? (margin / totalFee) * 100 : null;
          return (
            <div className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-window)]">
              <div className="px-3 py-2 panel-border-b border-b border-[var(--sa-border)] flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">Sampling P&L</span>
                {marginPct != null && (
                  <span className={cn("text-[10px] font-semibold", margin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]")}>
                    {margin >= 0 ? "▲" : "▼"} {Math.abs(marginPct).toFixed(0)}% margin
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 divide-x divide-[var(--sa-border)]">
                {[
                  { label: "Fees charged", value: totalFee > 0 ? `$${totalFee.toFixed(2)}` : "—", color: "text-[var(--sa-text-primary)]" },
                  { label: "Internal costs", value: totalCost > 0 ? `$${totalCost.toFixed(2)}` : "—", color: "text-[var(--sa-text-primary)]" },
                  { label: "Net margin", value: `${margin >= 0 ? "+" : ""}$${margin.toFixed(2)}`, color: margin >= 0 ? "text-[var(--sa-success)]" : "text-[var(--sa-danger)]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{label}</p>
                    <p className={cn("mt-0.5 font-mono text-[13px] font-semibold", color)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Products list preview */}
        {products.length > 0 && (
          <div className="rounded-xl border border-[var(--sa-border)] overflow-hidden bg-[var(--sa-window)]">
            <div className="flex items-center justify-between px-3 py-2 panel-border-b">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
                Products ({products.length})
              </span>
            </div>
            {products.slice(0, 6).map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 px-3 py-2 border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-hover)] transition-colors"
              >
                <Package size={11} className="text-[var(--sa-text-tertiary)] shrink-0" />
                <span className="flex-1 min-w-0 text-[12px] text-[var(--sa-text-primary)] truncate">
                  {product.name}
                </span>
                <StatusBadge stage={product.stage} />
              </div>
            ))}
            {products.length > 6 && (
              <div className="px-3 py-2 text-[11px] text-[var(--sa-text-tertiary)]">
                +{products.length - 6} more products
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {project.notes && (
          <div className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] mb-1">Notes</p>
            <p className="text-[13px] text-[var(--sa-text-secondary)]">{project.notes}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AddProjectModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const seasonRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

  async function handleSave() {
    const name = nameRef.current?.value.trim();
    if (!name) { setError("Collection name is required"); return; }
    setSaving(true);
    setError("");
    const res = await createProjectForClient({
      client_id: clientId,
      name,
      season: seasonRef.current?.value.trim() || null,
      start_date: startRef.current?.value || new Date().toISOString().slice(0, 10),
      target_completion: targetRef.current?.value || null,
      notes: notesRef.current?.value.trim() || "",
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-xl p-6"
      >
        <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-4">Add new collection</h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={labelCls}>Collection name *</label><input ref={nameRef} className={inputCls} placeholder="SS26 Collection" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Season</label><input ref={seasonRef} className={inputCls} placeholder="SS26" /></div>
            <div><label className={labelCls}>Start date</label><input ref={startRef} type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          </div>
          <div><label className={labelCls}>Target completion</label><input ref={targetRef} type="date" className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><textarea ref={notesRef} className={inputCls + " resize-none"} rows={2} placeholder="Optional project notes…" /></div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Saving…" : "Add Collection"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function ClientsPageClient({ client, projectData, portalActivity, clientMembers }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedIdRaw] = useState<string | null>(
    projectData[0]?.project.id ?? null
  );
  const [showActivity, setShowActivity] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(!!client.portal_enabled);
  const [togglingPortal, setTogglingPortal] = useState(false);

  function setSelectedId(id: string | null) {
    setSelectedIdRaw(id);
    setShowActivity(false);
  }

  async function togglePortal() {
    setTogglingPortal(true);
    const next = !portalEnabled;
    await toggleClientPortal(client.id, next);
    setPortalEnabled(next);
    setTogglingPortal(false);
  }

  const selected = projectData.find((d) => d.project.id === selectedId);

  return (
    <div className="flex h-full overflow-hidden flex-col md:flex-row">
      {/* Panel 2 — full width on mobile, fixed width on desktop */}
      <ResizablePanel defaultWidth={360} storageKey="sa-client-panel2">
        <div className={cn("flex flex-col", selected ? "hidden md:flex h-full" : "flex h-full")}>
          {/* Panel 2 header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 panel-border-b bg-[var(--sa-window)]">
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--sa-text-tertiary)]">
              <span>Clients</span>
              <ChevronRight size={11} />
              <span className="text-[var(--sa-text-primary)] font-medium">{client.name}</span>
            </div>
            <button
              onClick={() => setShowAddProject(true)}
              className="flex items-center gap-1 rounded-lg bg-[var(--sa-accent)] px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={11} strokeWidth={2.5} /> New Collection
            </button>
          </div>

          {/* Client info row */}
          <div className="flex items-center gap-3 px-4 py-3 panel-border-b">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sa-accent-light)] text-[15px] font-bold text-[var(--sa-accent)]">
              {client.logo_initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">{client.name}</p>
              <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                {client.industry} · {client.country}
              </p>
            </div>
            {/* Portal toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {portalEnabled && (
                <a
                  href={`/portal/${client.id}`}
                  target="_blank"
                  className="text-[11px] text-[var(--sa-accent)] hover:opacity-80 transition-opacity"
                >
                  View
                </a>
              )}
              <button
                onClick={togglePortal}
                disabled={togglingPortal}
                title={portalEnabled ? "Lock client portal" : "Unlock client portal"}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                  portalEnabled
                    ? "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-500/15 dark:text-green-400"
                    : "bg-[var(--sa-hover)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-border)]"
                )}
              >
                {portalEnabled ? <><Globe size={11} />Portal on</> : <><Lock size={11} />Portal off</>}
              </button>
            </div>
          </div>

          <div className="px-4 pt-3">
            <ClientStatusControl client={client} />
          </div>
          <div className="px-4 pt-3">
            <ClientPeople clientId={client.id} initial={clientMembers ?? []} />
          </div>

          {/* Projects list */}
          <div className="flex-1 overflow-y-auto">
            {projectData.length === 0 ? (
              <EmptyState title="No collections yet" description="This client has no collections." />
            ) : (
              projectData.map(({ project, products }) => {
                const isSelected = project.id === selectedId;
                const contextItems: ContextMenuItem[] = [
                  { label: "Open collection", onClick: () => router.push(`/projects/${project.id}`) },
                  { label: "View portal", onClick: () => window.open(`/portal/${project.client_id}`, "_blank") },
                  { label: "Copy project ID", onClick: () => navigator.clipboard?.writeText(project.id) },
                ];
                return (
                  <ContextMenu key={project.id} items={contextItems}>
                    <div
                      onClick={() => setSelectedId(project.id)}
                      onDoubleClick={() => router.push(`/projects/${project.id}`)}
                      className={cn(
                        "flex flex-col gap-2 px-4 py-3 border-b border-[var(--sa-border)] cursor-default select-none transition-colors",
                        isSelected ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-[13px] font-medium text-[var(--sa-text-primary)] truncate">
                          {project.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            project.status === "active"
                              ? "bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          {project.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--sa-text-tertiary)]">
                        <span>{products.length} products</span>
                        <span>{project.season}</span>
                      </div>
                      {products.length > 0 && (
                        <StageTrack
                          currentStage={products[0].stage}
                          animated={false}
                          size="sm"
                        />
                      )}
                    </div>
                  </ContextMenu>
                );
              })
            )}
          </div>
        </div>
      </ResizablePanel>

      {/* Panel 3 — hidden on mobile when nothing selected, back button to return to list */}
      <div className={cn("flex-1 overflow-hidden bg-[var(--sa-bg)]", !selected && "hidden md:block")}>
        <AnimatePresence mode="wait">
          {selected && !showActivity ? (
            <ProjectDetailPanel
              key={selected.project.id}
              data={selected}
              portalEnabled={portalEnabled}
              onNavigate={() => router.push(`/projects/${selected.project.id}`)}
              onBack={() => setSelectedId(null)}
              onShowActivity={() => setShowActivity(true)}
            />
          ) : selected && showActivity ? (
            <PortalActivityPanel
              activity={portalActivity}
              client={client}
              portalEnabled={portalEnabled}
              onBack={() => setShowActivity(false)}
              backLabel={`Back to ${selected.project.name}`}
            />
          ) : (
            <PortalActivityPanel activity={portalActivity} client={client} portalEnabled={portalEnabled} />
          )}
        </AnimatePresence>
      </div>

      {showAddProject && (
        <AddProjectModal
          clientId={client.id}
          onClose={() => setShowAddProject(false)}
        />
      )}
    </div>
  );
}

// ── Relationship status ──────────────────────────────────────────
// Marking a client inactive is how a finished relationship stops competing
// for attention. Nothing is deleted: their products, tasks, history and
// portal all stay exactly as they are, so it is a single click to undo.
function ClientStatusControl({ client }: { client: Client }) {
  const [status, setStatus] = useState<string>(client.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    if (next === status || busy) return;
    setBusy(true); setError(null);
    const prev = status;
    setStatus(next);
    const res = await setClientStatus(client.id, next);
    if (!res.success) { setStatus(prev); setError(res.error ?? "Could not update"); }
    setBusy(false);
  }

  const isInactive = status === "inactive";

  return (
    <section
      className="rounded-xl border p-4"
      style={{
        borderColor: isInactive ? "var(--sa-warning)" : "var(--sa-border)",
        background: "var(--sa-window)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Relationship</p>
          <p className="text-[12px] text-[var(--sa-text-secondary)]">
            {CLIENT_STATUSES.find((s) => s.id === status)?.hint ?? "Set where this client stands."}
          </p>
        </div>
        <div className="flex gap-1.5">
          {CLIENT_STATUSES.map((s) => (
            <button
              key={s.id}
              disabled={busy}
              onClick={() => change(s.id)}
              title={s.hint}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{
                background: status === s.id ? "var(--sa-accent)" : "var(--sa-hover)",
                color: status === s.id ? "#fff" : "var(--sa-text-secondary)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
    </section>
  );
}

// ── The client's own people ──────────────────────────────────────
// Their founder, their designer — whoever they want on the portal. Adding
// the first person turns that portal from link-only into sign-in only.
function ClientPeople({ clientId, initial }: { clientId: string; initial: ClientMember[] }) {
  const [rows, setRows] = useState(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    const res = await addClientMember(clientId, email, role);
    if (!res.success) { setError(res.error); setBusy(false); return; }
    setRows((prev) => [...prev.filter((r) => r.id !== res.member.id), res.member]);
    if (res.invited === "failed") {
      setError(`Added, but the invite email didn't send. Send them the portal link yourself.`);
    }
    setEmail("");
    setBusy(false);
  }

  async function remove(m: ClientMember) {
    if (!window.confirm(`Remove ${m.email} from this portal?`)) return;
    const res = await removeClientMember(m.id, clientId);
    if (!res.success) { setError(res.error ?? "Could not remove"); return; }
    setRows((prev) => prev.filter((r) => r.id !== m.id));
  }

  const inp = "rounded-md border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1.5 text-[12.5px] text-[var(--sa-text-primary)] outline-none";

  return (
    <section className="rounded-xl border border-[var(--sa-border)] p-4 bg-[var(--sa-window)]">
      <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Portal access</p>
      <p className="mt-0.5 text-[12px] text-[var(--sa-text-secondary)]">
        {rows.length === 0
          ? "Anyone with the link can open this portal. Add someone to require a sign-in."
          : `${rows.length} ${rows.length === 1 ? "person" : "people"} — the link alone no longer works.`}
      </p>

      {rows.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-[var(--sa-text-primary)]">{m.email}</p>
                <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                  {m.role === "owner" ? "Owner" : "Member"}
                  {m.claimed_at ? " · signed in" : " · invite not used yet"}
                </p>
              </div>
              <button onClick={() => remove(m)} className="text-[var(--sa-text-tertiary)] hover:text-red-500" title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className={`${inp} min-w-0 flex-1`}
          placeholder="their@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        />
        <select className={inp} value={role} onChange={(e) => setRole(e.target.value as "owner" | "member")}>
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
        <button
          onClick={add}
          disabled={busy || !email.trim()}
          className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
    </section>
  );
}
