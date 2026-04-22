"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Globe, Package, ChevronRight, Calendar, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ResizablePanel } from "@/components/layout/ResizablePanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StageTrack } from "@/components/shared/StageTrack";
import { EmptyState } from "@/components/shared/EmptyState";
import { ContextMenu, type ContextMenuItem } from "@/components/shared/ContextMenu";
import { cn } from "@/lib/utils";
import type { Client, Project, Product, Stage } from "@/lib/mock-data";

interface ProjectData {
  project: Project;
  products: Product[];
  totalCostGbp: number;
}

interface Props {
  client: Client;
  projectData: ProjectData[];
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

function ProjectDetailPanel({ data, portalEnabled, onNavigate, onBack }: { data: ProjectData; portalEnabled: boolean; onNavigate: () => void; onBack: () => void }) {
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
          {portalEnabled && (
            <a
              href={`/portal/${project.client_id}`}
              target="_blank"
              className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium bg-[var(--sa-success)] text-white hover:opacity-90 transition-opacity"
            >
              View portal
            </a>
          )}
        </section>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Products", value: products.length },
            { label: "Progress", value: `${progress}%` },
            { label: "Cost (GBP)", value: `£${totalCostGbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` },
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
    const { error: err } = await supabase.from("projects").insert({
      id: "proj-" + Date.now(),
      client_id: clientId,
      name,
      season: seasonRef.current?.value.trim() || null,
      status: "active",
      start_date: startRef.current?.value || new Date().toISOString().slice(0, 10),
      target_completion: targetRef.current?.value || null,
      portal_unlocked_at: null,
      notes: notesRef.current?.value.trim() || "",
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
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

export function ClientsPageClient({ client, projectData }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    projectData[0]?.project.id ?? null
  );
  const [showAddProject, setShowAddProject] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(!!client.portal_enabled);
  const [togglingPortal, setTogglingPortal] = useState(false);

  async function togglePortal() {
    setTogglingPortal(true);
    const next = !portalEnabled;
    await supabase.from("clients").update({ portal_enabled: next }).eq("id", client.id);
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
          {selected ? (
            <ProjectDetailPanel
              key={selected.project.id}
              data={selected}
              portalEnabled={portalEnabled}
              onNavigate={() => router.push(`/projects/${selected.project.id}`)}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <EmptyState
              title="Select a collection"
              description="Click a collection to see details"
            />
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
