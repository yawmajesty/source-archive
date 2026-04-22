"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, ChevronRight, Package,
  Star, Clock, CheckCircle, AlertCircle, Plus, Upload,
  ExternalLink,
} from "lucide-react";
import { StageTrack } from "@/components/shared/StageTrack";
import { StatusBadge, SampleStatusBadge } from "@/components/shared/StatusBadge";
import { MilestoneItem } from "@/components/shared/MilestoneItem";
import { UpdateItem } from "@/components/shared/UpdateItem";
import { TrafficDot } from "@/components/shared/TrafficLight";
import { cn } from "@/lib/utils";
import type { Product, Factory, Milestone, Update, Sample, Cost, Project, Client } from "@/lib/mock-data";

interface Props {
  product: Product;
  factory: Factory | null;
  milestones: Milestone[];
  updates: Update[];
  samples: Sample[];
  costs: Cost[];
  project: Project | null;
  client: Client | null;
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
  product,
  factory,
  milestones,
  updates,
  samples,
  costs,
  project,
  client,
}: Props) {
  const router = useRouter();
  const [localUpdates, setLocalUpdates] = useState(updates);
  const [newUpdate, setNewUpdate] = useState("");

  const variancePct =
    product.quoted_cost_usd != null
      ? ((product.quoted_cost_usd - product.target_cost_usd) / product.target_cost_usd) * 100
      : null;

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
    </div>
  );
}
