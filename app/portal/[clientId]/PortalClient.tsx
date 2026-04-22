"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, Upload, FileText, Download, ChevronUp, ChevronDown } from "lucide-react";
import type { Client, Contract, PortalFile } from "@/lib/data";
import type { Stage } from "@/lib/mock-data";
import type { PortalProject, PortalProduct } from "./page";

// ── Types ────────────────────────────────────────────────────
type Tab = "overview" | "projects" | "files" | "contracts";

interface Props {
  client: Client;
  locked: boolean;
  projects: PortalProject[];
  contracts: Contract[];
  files: PortalFile[];
}

// ── Stage config (from spec Prompt 3) ────────────────────────
const STAGE_CFG: Record<Stage, { bg: string; fg: string; label: string }> = {
  brief:      { bg: "#F1EFE8", fg: "#444441", label: "Brief received" },
  sourcing:   { bg: "#E1F5EE", fg: "#085041", label: "Finding manufacturer" },
  sampling:   { bg: "#E1F5EE", fg: "#085041", label: "Sampling" },
  approved:   { bg: "#EAF3DE", fg: "#27500A", label: "Sample approved" },
  production: { bg: "#FAEEDA", fg: "#633806", label: "In production" },
  qc:         { bg: "#FAEEDA", fg: "#633806", label: "Quality inspection" },
  shipped:    { bg: "#EEEDFE", fg: "#3C3489", label: "On the way" },
};
const STAGE_ORDER: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];

function StagePill({ stage }: { stage: Stage }) {
  const c = STAGE_CFG[stage];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const ms = now.getTime() - new Date(dateStr).getTime();
  const h = ms / 3600000;
  const d = ms / 86400000;
  if (h < 24) return "Today";
  if (d < 7) return `${Math.floor(d)} days ago`;
  if (d < 14) return "1 week ago";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// ── Locked gate ──────────────────────────────────────────────
function PortalGate({ client }: { client: Client }) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
      <header className="flex items-center justify-between px-8 py-5 border-b border-black/[0.08] bg-white">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1A2E] text-white text-[13px] font-bold">K</div>
          <span className="text-[15px] font-semibold text-[#1D1D1F]">Source[Archive]</span>
        </div>
        <span className="text-[13px] text-[#6E6E73]">{client.name}</span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6 text-center max-w-md"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white border border-black/[0.08]">
            <Clock size={36} strokeWidth={1.2} className="text-[#AEAEB2]" />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">Your portal is being prepared</h1>
            <p className="mt-2 text-[16px] text-[#6E6E73] leading-relaxed">We&apos;ll notify you when your products are ready to review.</p>
          </div>
          <p className="text-[13px] text-[#AEAEB2]">Questions? Reach out to your account manager.</p>
        </motion.div>
      </div>
    </div>
  );
}

// ── NavBar ───────────────────────────────────────────────────
function PortalNavBar({ client, tab, setTab }: { client: Client; tab: Tab; setTab: (t: Tab) => void }) {
  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",  label: "Overview" },
    { id: "projects",  label: "Projects" },
    { id: "files",     label: "Files" },
    { id: "contracts", label: "Contracts" },
  ];
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b border-black/[0.08] bg-white">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A2E] text-white text-[14px] font-bold select-none">
          {client.logo_initial}
        </div>
        <div>
          <p className="text-[15px] font-medium text-[#1D1D1F] leading-tight">{client.name}</p>
          <p className="text-[12px] text-[#8E8E93] leading-tight">Client portal</p>
        </div>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-full px-4 py-1.5 text-[12px] transition-colors"
            style={
              tab === t.id
                ? { backgroundColor: "#1A1A2E", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#6E6E73", border: "0.5px solid #D1D1D6" }
            }
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

// ── StatsRow ─────────────────────────────────────────────────
function StatsRow({ projects, files }: { projects: PortalProject[]; files: PortalFile[] }) {
  const allProducts = projects.flatMap((p) => p.products);
  const allMilestones = allProducts.flatMap((p) => p.milestones);
  const now = new Date();

  const activeProjects = projects.filter((p) => p.products.some((prod) => prod.stage !== "shipped")).length;
  const categories = new Set(allProducts.map((p) => p.category)).size;
  const samplesInReview = allProducts.filter((p) => p.stage === "sampling").length;

  const nextMs = allMilestones
    .filter((m) => !m.completed_at && new Date(m.due_date) >= now)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const latestUpload = files.length > 0
    ? Math.floor((now.getTime() - new Date(Math.max(...files.map((f) => new Date(f.uploaded_at).getTime()))).getTime()) / 86400000)
    : null;

  const cards = [
    { label: "Active projects",   value: activeProjects,  sub: `Across ${categories} ${categories === 1 ? "category" : "categories"}` },
    { label: "Samples in review", value: samplesInReview, sub: "Awaiting your approval" },
    { label: "Next milestone",    value: nextMs ? formatDate(nextMs.due_date) : "—", sub: nextMs ? "Upcoming deadline" : "No upcoming dates" },
    { label: "Files uploaded",    value: files.length,    sub: latestUpload != null ? (latestUpload === 0 ? "Last upload today" : `Last upload ${latestUpload}d ago`) : "No files yet" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg bg-white border border-[#E0E0E0] p-4">
          <p className="text-[11px] text-[#8E8E93] mb-1">{c.label}</p>
          <p className="text-[20px] font-medium text-[#1D1D1F] leading-tight">{c.value}</p>
          <p className="text-[11px] text-[#8E8E93] mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── ProductGrid ──────────────────────────────────────────────
// ── Product detail drawer ────────────────────────────────────
function ProductDetailDrawer({ product, files, onClose }: {
  product: PortalProduct;
  files: PortalFile[];
  onClose: () => void;
}) {
  const productFiles = files.filter((f) => f.project_id !== null);
  const sorted = [...product.milestones].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const clientUpdates = product.updates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/20" onClick={onClose} />
      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-lg bg-white flex flex-col h-full overflow-hidden shadow-2xl"
      >
        {/* Drawer header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#F0F0F0]">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1D1D1F]">{product.name}</h2>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">{product.category}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F5F5F7] text-[#8E8E93] transition-colors text-[18px] leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stage */}
          <div className="px-6 py-4 border-b border-[#F0F0F0]">
            <StagePill stage={product.stage} />
            <div className="mt-3 flex gap-0.5 h-1.5">
              {(["brief","sourcing","sampling","approved","production","qc","shipped"] as Stage[]).map((s, i) => {
                const idx = STAGE_ORDER.indexOf(product.stage);
                return (
                  <div key={s} className="flex-1 rounded-sm first:rounded-l last:rounded-r"
                    style={{ backgroundColor: i < idx ? "#C8963C" : i === idx ? "transparent" : "#E5E5EA", border: i === idx ? "1.5px solid #C8963C" : undefined }} />
                );
              })}
            </div>
          </div>

          {/* Images / media placeholders */}
          <div className="px-6 py-4 border-b border-[#F0F0F0]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] mb-3">Design & photos</p>
            <div className="grid grid-cols-3 gap-2">
              {["Design reference", "Fabric detail", "Sample photo"].map((label) => (
                <div key={label} className="aspect-square rounded-xl bg-[#F7F7F7] flex flex-col items-center justify-center gap-1.5 border border-dashed border-[#D1D1D6]">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" opacity={0.3}>
                    <rect x="1" y="1" width="18" height="18" rx="3" stroke="#1D1D1F" strokeWidth="1.5"/>
                    <circle cx="6.5" cy="6.5" r="1.5" fill="#1D1D1F"/>
                    <path d="M1 13l5-5 4 4 3-3 5 5" stroke="#1D1D1F" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p className="text-[9px] text-[#AEAEB2] text-center leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Product info */}
          <div className="px-6 py-4 border-b border-[#F0F0F0]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] mb-3">Product details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Category", product.category],
                ["MOQ", product.moq.toLocaleString() + " units"],
                ["Order qty", product.order_qty ? product.order_qty.toLocaleString() + " units" : "TBC"],
                ["Unit price", product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "TBC"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-[#F7F7F7] p-3">
                  <p className="text-[10px] text-[#AEAEB2] mb-0.5">{k}</p>
                  <p className="text-[13px] font-medium text-[#1D1D1F]">{v}</p>
                </div>
              ))}
            </div>
            {product.colorways.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-[#AEAEB2] mb-2">Colourways</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.colorways.map((c) => (
                    <span key={c} className="rounded-full border border-[#E0E0E0] bg-white px-2.5 py-1 text-[11px] text-[#6E6E73]">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Milestone timeline */}
          {sorted.length > 0 && (
            <div className="px-6 py-4 border-b border-[#F0F0F0]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] mb-3">Timeline</p>
              <div className="flex flex-col gap-0">
                {sorted.map((m, i) => {
                  const done = !!m.completed_at;
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${done ? "bg-emerald-500" : new Date(m.due_date) < now ? "bg-red-400" : "border-2 border-[#C8963C] bg-white"}`}>
                          {done && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        {i < sorted.length - 1 && <div className="w-px flex-1 min-h-[20px] bg-[#E5E5EA] mt-0.5" />}
                      </div>
                      <div className="pb-4">
                        <p className={`text-[12px] font-medium ${done ? "text-[#AEAEB2] line-through" : "text-[#1D1D1F]"}`}>{m.title}</p>
                        <p className="text-[11px] text-[#AEAEB2] mt-0.5">
                          {new Date(m.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files */}
          {productFiles.length > 0 && (
            <div className="px-6 py-4 border-b border-[#F0F0F0]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] mb-3">Files & documents</p>
              {productFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 py-2 border-b border-[#F5F5F7] last:border-0">
                  <FileText size={13} className="text-[#AEAEB2] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1D1D1F] truncate">{f.filename}</p>
                    <p className="text-[11px] text-[#AEAEB2]">{f.source === "agency" ? "Shared by agency" : "Your upload"}</p>
                  </div>
                  <button className="shrink-0 text-[11px] text-[#0066CC]">Download</button>
                </div>
              ))}
            </div>
          )}

          {/* Updates */}
          {clientUpdates.length > 0 && (
            <div className="px-6 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#AEAEB2] mb-3">Updates</p>
              <div className="flex flex-col gap-3">
                {clientUpdates.map((u) => {
                  const isRecent = (now.getTime() - new Date(u.created_at).getTime()) < 48 * 3600000;
                  return (
                    <div key={u.id} className="flex items-start gap-2.5">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: isRecent ? "#1D9E75" : "#D3D1C7" }} />
                      <div>
                        <p className="text-[12px] text-[#1D1D1F] leading-relaxed">{u.text}</p>
                        <p className="mt-0.5 text-[11px] text-[#8E8E93]">{u.author} · {relativeTime(u.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sample approval CTA */}
        {product.stage === "sampling" && (
          <div className="px-6 py-4 border-t border-[#F0F0F0]">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8963C] py-3 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity">
              <CheckCircle2 size={14} strokeWidth={2.5} />
              Approve Sample
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ProductCard({ product, onClick }: { product: PortalProduct; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-[#E0E0E0] bg-white overflow-hidden hover:border-[#1A1A2E]/40 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="h-20 bg-[#F7F7F7] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity={0.25}>
          <rect x="6" y="3" width="20" height="26" rx="2" stroke="#1D1D1F" strokeWidth="1.5"/>
          <line x1="10" y1="10" x2="22" y2="10" stroke="#1D1D1F" strokeWidth="1.5"/>
          <line x1="10" y1="15" x2="22" y2="15" stroke="#1D1D1F" strokeWidth="1.5"/>
          <line x1="10" y1="20" x2="17" y2="20" stroke="#1D1D1F" strokeWidth="1.5"/>
        </svg>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <p className="text-[12px] font-medium text-[#1D1D1F] truncate">{product.name}</p>
        <p className="text-[11px] text-[#8E8E93]">
          MOQ {product.moq.toLocaleString()} · {product.quoted_cost_usd ? `$${product.quoted_cost_usd}/unit` : "Price TBC"}
        </p>
        <StagePill stage={product.stage} />
      </div>
    </button>
  );
}

function ProductGrid({ projects, files, onSelect }: { projects: PortalProject[]; files: PortalFile[]; onSelect: (p: PortalProduct) => void }) {
  const all = projects.flatMap((p) => p.products);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-medium text-[#1D1D1F]">Your products ({all.length})</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {all.map((p) => <ProductCard key={p.id} product={p} onClick={() => onSelect(p)} />)}
      </div>
    </div>
  );
}

// ── UpdatesFeed ──────────────────────────────────────────────
function UpdatesFeed({ projects }: { projects: PortalProject[] }) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date();

  const all = projects
    .flatMap((proj) =>
      proj.products.flatMap((prod) =>
        prod.updates.map((u) => ({ ...u, productName: prod.name }))
      )
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const shown = expanded ? all : all.slice(0, 4);

  return (
    <div className="rounded-lg bg-white border border-[#E0E0E0] p-5">
      <p className="text-[13px] font-medium text-[#1D1D1F] mb-4">Latest updates</p>
      {all.length === 0 ? (
        <p className="text-[12px] text-[#8E8E93]">No updates yet — your agency will post progress notes here</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {shown.map((u) => {
              const isRecent = (now.getTime() - new Date(u.created_at).getTime()) < 48 * 3600000;
              return (
                <div key={u.id} className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: isRecent ? "#1D9E75" : "#D3D1C7" }} />
                  <div>
                    <p className="text-[12px] text-[#1D1D1F] leading-relaxed">{u.text}</p>
                    <p className="mt-0.5 text-[11px] text-[#8E8E93]">{u.productName} · {relativeTime(u.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {all.length > 4 && (
            <button onClick={() => setExpanded(!expanded)} className="mt-4 text-[11px] text-[#0066CC]">
              {expanded ? "Show less" : `View all (${all.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── ProjectsTable ────────────────────────────────────────────
type SortKey = "stage" | "moq" | "sample_due" | "delivery";

function getSampleDue(product: PortalProduct): string | null {
  const now = new Date();
  const upcoming = product.milestones
    .filter((m) => !m.completed_at && new Date(m.due_date) >= now)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  return upcoming[0]?.due_date ?? null;
}

function getDelivery(product: PortalProduct, projectTarget: string): string {
  const last = [...product.milestones].sort(
    (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
  )[0];
  return last?.due_date ?? projectTarget;
}

function downloadCSV(rows: { name: string; category: string; stage: Stage; moq: number; price: string; sampleDue: string; delivery: string; approved: string }[], clientName: string) {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `sourceos-projects-${clientName.toLowerCase().replace(/\s+/g, "-")}-${date}.csv`;
  const headers = ["Product name","Category","Stage","MOQ","Unit price","Sample due","Delivery","Approved"];
  const lines = [headers.join(","), ...rows.map((r) =>
    [r.name, r.category, r.stage, r.moq, r.price, r.sampleDue, r.delivery, r.approved].map((v) => `"${v}"`).join(",")
  )];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function ProjectsTable({ projects, client }: { projects: PortalProject[]; client: Client }) {
  const [sortKey, setSortKey] = useState<SortKey>("sample_due");
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    return projects.flatMap((proj) =>
      proj.products.map((p) => ({
        product: p,
        sampleDue: getSampleDue(p),
        delivery: getDelivery(p, proj.target_completion),
      }))
    );
  }, [projects]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "stage") {
        cmp = STAGE_ORDER.indexOf(a.product.stage) - STAGE_ORDER.indexOf(b.product.stage);
      } else if (sortKey === "moq") {
        cmp = a.product.moq - b.product.moq;
      } else if (sortKey === "sample_due") {
        if (!a.sampleDue && !b.sampleDue) cmp = 0;
        else if (!a.sampleDue) cmp = 1;
        else if (!b.sampleDue) cmp = -1;
        else cmp = new Date(a.sampleDue).getTime() - new Date(b.sampleDue).getTime();
      } else if (sortKey === "delivery") {
        cmp = new Date(a.delivery).getTime() - new Date(b.delivery).getTime();
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortAsc ? <ChevronUp size={10} className="inline ml-0.5" /> : <ChevronDown size={10} className="inline ml-0.5" />;
  }

  const csvRows = sorted.map(({ product, sampleDue, delivery }) => ({
    name: product.name,
    category: product.category,
    stage: product.stage,
    moq: product.moq,
    price: product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "—",
    sampleDue: sampleDue ? formatDate(sampleDue) : "—",
    delivery: formatDate(delivery),
    approved: STAGE_ORDER.indexOf(product.stage) >= STAGE_ORDER.indexOf("approved") ? "Yes" : "No",
  }));

  const TH = ({ label, sortable, k }: { label: string; sortable?: boolean; k?: SortKey }) => (
    <th
      className={`px-3 py-2 text-left text-[10px] font-medium text-[#8E8E93] uppercase tracking-wide whitespace-nowrap ${sortable ? "cursor-pointer select-none hover:text-[#1D1D1F]" : ""}`}
      onClick={sortable && k ? () => toggleSort(k) : undefined}
    >
      {label}{sortable && k && <SortIcon k={k} />}
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-medium text-[#1D1D1F]">All products ({sorted.length})</p>
        <button
          onClick={() => downloadCSV(csvRows, client.name)}
          className="flex items-center gap-1.5 rounded-lg border border-[#D1D1D6] px-3 py-1.5 text-[11px] text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors"
        >
          <Download size={11} />
          Export CSV
        </button>
      </div>
      <div className="rounded-xl border border-[#E0E0E0] overflow-hidden bg-white">
        <table className="w-full border-collapse">
          <thead className="bg-[#F7F7F7] border-b border-[#E0E0E0]">
            <tr>
              <TH label="Product" />
              <TH label="Category" />
              <TH label="Stage" sortable k="stage" />
              <TH label="MOQ" sortable k="moq" />
              <TH label="Unit price" />
              <TH label="Sample due" sortable k="sample_due" />
              <TH label="Delivery" sortable k="delivery" />
              <TH label="Approved" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ product, sampleDue, delivery }, i) => {
              const isApproved = STAGE_ORDER.indexOf(product.stage) >= STAGE_ORDER.indexOf("approved");
              return (
                <tr key={product.id} className={`border-b border-[#E0E0E0] last:border-0 ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}>
                  <td className="px-3 py-2.5 text-[12px] font-medium text-[#1D1D1F]">{product.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-[#6E6E73]">{product.category}</span>
                  </td>
                  <td className="px-3 py-2.5"><StagePill stage={product.stage} /></td>
                  <td className="px-3 py-2.5 text-[12px] text-[#6E6E73]">{product.moq.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#6E6E73]">
                    {product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-[#6E6E73]">{sampleDue ? formatDate(sampleDue) : "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#6E6E73]">{formatDate(delivery)}</td>
                  <td className="px-3 py-2.5">
                    {isApproved ? (
                      <CheckCircle2 size={14} strokeWidth={2} className="text-emerald-500" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="2.25" stroke="#D1D1D6" strokeWidth="1.5"/>
                      </svg>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── FilesSection ─────────────────────────────────────────────
function FileRow({ file }: { file: PortalFile }) {
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "ai", "psd"].includes(ext);
  const isDoc   = ["pdf", "docx"].includes(ext);
  const isZip   = ext === "zip";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#F0F0F0] last:border-0">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F5F5F7] shrink-0">
        {isImage ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="#8E8E93" strokeWidth="1.2"/><circle cx="4.5" cy="4.5" r="1" fill="#8E8E93"/><path d="M1 9.5l3-3 3 3 2-2 3 3" stroke="#8E8E93" strokeWidth="1.2" strokeLinecap="round"/></svg>
        ) : isDoc ? (
          <FileText size={14} strokeWidth={1.5} className="text-[#8E8E93]" />
        ) : isZip ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="#8E8E93" strokeWidth="1.2"/><path d="M6 1v12M6 4h2M6 7h2M6 10h2" stroke="#8E8E93" strokeWidth="1.2" strokeLinecap="round"/></svg>
        ) : (
          <FileText size={14} strokeWidth={1.5} className="text-[#8E8E93]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#1D1D1F] truncate">{file.filename}</p>
        <p className="text-[11px] text-[#8E8E93]">
          {file.source === "client" ? "Uploaded by you" : "Shared by agency"} · {formatDate(file.uploaded_at)} · {fmtSize(file.size_kb)}
        </p>
      </div>
      <button className="flex items-center gap-1 rounded-lg border border-[#D1D1D6] px-2.5 py-1 text-[11px] text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors shrink-0">
        <Download size={10} />
        Download
      </button>
    </div>
  );
}

function FilesSection({ files }: { files: PortalFile[] }) {
  const clientFiles = files.filter((f) => f.source === "client");
  const agencyFiles = files.filter((f) => f.source === "agency");

  return (
    <div className="flex flex-col gap-6">
      {/* Your uploads */}
      <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
        <p className="text-[13px] font-medium text-[#1D1D1F] mb-3">Your uploads</p>
        {clientFiles.length === 0 ? (
          <p className="text-[12px] text-[#8E8E93]">You have not uploaded any files yet — use the area below to upload artwork, references, or specifications</p>
        ) : (
          clientFiles.map((f) => <FileRow key={f.id} file={f} />)
        )}
      </div>

      {/* Shared by agency */}
      <div className="rounded-xl border border-[#E0E0E0] bg-white p-5">
        <p className="text-[13px] font-medium text-[#1D1D1F] mb-3">Shared by agency</p>
        {agencyFiles.length === 0 ? (
          <p className="text-[12px] text-[#8E8E93]">Your agency will share files here — tech packs, QC reports, and other documents will appear here</p>
        ) : (
          agencyFiles.map((f) => <FileRow key={f.id} file={f} />)
        )}
      </div>

      {/* Upload zone */}
      <div className="rounded-xl border-2 border-dashed border-[#D1D1D6] bg-white p-8 text-center hover:border-[#1A1A2E] transition-colors cursor-pointer group">
        <Upload size={22} strokeWidth={1.5} className="mx-auto mb-3 text-[#AEAEB2] group-hover:text-[#1A1A2E] transition-colors" />
        <p className="text-[13px] font-medium text-[#1D1D1F]">Upload artwork or references</p>
        <p className="mt-1 text-[11px] text-[#8E8E93]">Drop files here or click to browse · .ai .pdf .png .jpg .psd .zip .mov .mp4 · max 500 MB</p>
      </div>
    </div>
  );
}

// ── ContractsList ────────────────────────────────────────────
function ContractsList({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-xl border border-[#E0E0E0] bg-white p-8 text-center">
        <FileText size={28} strokeWidth={1.2} className="mx-auto mb-3 text-[#AEAEB2]" />
        <p className="text-[13px] text-[#8E8E93]">Your contracts will appear here once shared by your agency</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#E0E0E0] bg-white overflow-hidden">
      {contracts.map((c) => {
        const d = new Date(c.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
        const isSigned = c.status === "signed";
        return (
          <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-[#F0F0F0] last:border-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F5F5F7] shrink-0">
              <FileText size={14} strokeWidth={1.5} className="text-[#8E8E93]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#1D1D1F]">{c.name}</p>
              <p className="text-[11px] text-[#8E8E93]">{isSigned ? "Signed" : "Sent"} · {d}</p>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-medium leading-none shrink-0"
              style={isSigned ? { backgroundColor: "#EAF3DE", color: "#27500A" } : { backgroundColor: "#FAEEDA", color: "#633806" }}
            >
              {isSigned ? "Signed" : "Pending"}
            </span>
            <button className="flex items-center gap-1 rounded-lg border border-[#D1D1D6] px-2.5 py-1 text-[11px] text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors shrink-0">
              <Download size={10} />
              Download
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main portal ──────────────────────────────────────────────
export function PortalClient({ client, locked, projects, contracts, files }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedProduct, setSelectedProduct] = useState<PortalProduct | null>(null);

  if (locked) return <PortalGate client={client} />;

  return (
    <div
      className="min-h-screen bg-[#F5F5F7]"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}
    >
      <PortalNavBar client={client} tab={tab} setTab={setTab} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        {tab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >
            <StatsRow projects={projects} files={files} />
            <ProductGrid projects={projects} files={files} onSelect={setSelectedProduct} />
            <UpdatesFeed projects={projects} />
          </motion.div>
        )}

        {tab === "projects" && (
          <motion.div key="projects" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <ProjectsTable projects={projects} client={client} />
          </motion.div>
        )}

        {tab === "files" && (
          <motion.div key="files" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <FilesSection files={files} />
          </motion.div>
        )}

        {tab === "contracts" && (
          <motion.div key="contracts" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <p className="text-[13px] font-medium text-[#1D1D1F] mb-4">Contracts ({contracts.length})</p>
            <ContractsList contracts={contracts} />
          </motion.div>
        )}
      </main>

      <footer className="py-8 text-center text-[11px] text-[#AEAEB2]">
        Powered by Source[Archive]
      </footer>

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailDrawer
            product={selectedProduct}
            files={files}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
