"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, Upload, FileText, Download, ChevronUp, ChevronDown, Send, Sun, Moon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/lib/storage";
import type { Client, Contract, PortalFile } from "@/lib/data";
import type { Stage } from "@/lib/mock-data";
import type { PortalProject, PortalProduct } from "./page";

function usePortalTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sa-theme");
    const isDark = saved === "dark" || document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sa-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("sa-theme", "light");
    }
  }

  return { dark, toggle };
}

// ── Types ────────────────────────────────────────────────────
type Tab = "overview" | "sampling" | "projects" | "files" | "contracts";

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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--portal-bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
      <header className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid var(--portal-border)", background: "var(--portal-nav-bg)" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-[13px] font-bold" style={{ background: "var(--portal-brand)" }}>K</div>
          <span className="text-[15px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Source[Archive]</span>
        </div>
        <span className="text-[13px]" style={{ color: "var(--portal-text-secondary)" }}>{client.name}</span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6 text-center max-w-md"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: "var(--portal-surface)", border: "1px solid var(--portal-border)" }}>
            <Clock size={36} strokeWidth={1.2} style={{ color: "var(--portal-text-muted)" }} />
          </div>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight" style={{ color: "var(--portal-text-primary)" }}>Your portal is being prepared</h1>
            <p className="mt-2 text-[16px] leading-relaxed" style={{ color: "var(--portal-text-secondary)" }}>We&apos;ll notify you when your products are ready to review.</p>
          </div>
          <p className="text-[13px]" style={{ color: "var(--portal-text-muted)" }}>Questions? Reach out to your account manager.</p>
        </motion.div>
      </div>
    </div>
  );
}

// ── NavBar ───────────────────────────────────────────────────
function PortalNavBar({ client, tab, setTab, dark, onToggleTheme }: {
  client: Client; tab: Tab; setTab: (t: Tab) => void; dark: boolean; onToggleTheme: () => void;
}) {
  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",  label: "Overview" },
    { id: "sampling",  label: "Sampling" },
    { id: "projects",  label: "Projects" },
    { id: "files",     label: "Files" },
    { id: "contracts", label: "Contracts" },
  ];
  return (
    <header className="sticky top-0 z-10" style={{ borderBottom: "1px solid var(--portal-border)", background: "var(--portal-nav-bg)" }}>
      <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-white text-[13px] sm:text-[14px] font-bold select-none" style={{ background: "var(--portal-brand)" }}>
            {client.logo_initial}
          </div>
          <div>
            <p className="text-[14px] sm:text-[15px] font-medium leading-tight" style={{ color: "var(--portal-text-primary)" }}>{client.name}</p>
            <p className="text-[11px] sm:text-[12px] leading-tight" style={{ color: "var(--portal-text-tertiary)" }}>Client portal</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {/* Desktop tabs */}
          <nav className="flex items-center gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="rounded-full px-4 py-1.5 text-[12px] transition-colors"
                style={tab === t.id
                  ? { backgroundColor: "var(--portal-brand)", color: "#FFFFFF" }
                  : { backgroundColor: "transparent", color: "var(--portal-text-secondary)", border: "0.5px solid var(--portal-border)" }}
              >{t.label}</button>
            ))}
          </nav>
          {/* Theme toggle */}
          <button onClick={onToggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{ background: "var(--portal-hover)", color: "var(--portal-text-secondary)" }}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>
      {/* Mobile tabs row */}
      <div className="sm:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="rounded-full px-4 py-1.5 text-[12px] whitespace-nowrap transition-colors shrink-0"
            style={tab === t.id
              ? { backgroundColor: "var(--portal-brand)", color: "#FFFFFF" }
              : { backgroundColor: "transparent", color: "var(--portal-text-secondary)", border: "0.5px solid var(--portal-border)" }}
          >{t.label}</button>
        ))}
        <button onClick={onToggleTheme}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ml-auto"
          style={{ background: "var(--portal-hover)", color: "var(--portal-text-secondary)" }}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
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
        <div key={c.label} className="rounded-lg p-4" style={{ background: "var(--portal-surface)", border: "1px solid var(--portal-border)" }}>
          <p className="text-[11px] mb-1" style={{ color: "var(--portal-text-tertiary)" }}>{c.label}</p>
          <p className="text-[20px] font-medium leading-tight" style={{ color: "var(--portal-text-primary)" }}>{c.value}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-text-tertiary)" }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── ProductGrid ──────────────────────────────────────────────
// ── Product detail drawer ────────────────────────────────────
function ProductDetailDrawer({ product, files, client, onClose }: {
  product: PortalProduct;
  files: PortalFile[];
  client: Client;
  onClose: () => void;
}) {
  const productFiles = files.filter((f) => f.project_id !== null);
  const sorted = [...product.milestones].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const [updates, setUpdates] = useState(product.updates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  const [images, setImages] = useState<string[]>(product.images ?? []);
  const [feedback, setFeedback] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  async function submitFeedback() {
    if (!feedback.trim()) return;
    setSendingFeedback(true);
    const newUpdate = {
      id: "upd-" + Date.now(),
      product_id: product.id,
      author: client.name,
      author_initials: client.logo_initial ?? client.name[0].toUpperCase(),
      text: feedback.trim(),
      visible_to_client: true,
      created_at: new Date().toISOString(),
    };
    await supabase.from("updates").insert(newUpdate);
    setUpdates((prev) => [newUpdate, ...prev]);
    setFeedback("");
    setSendingFeedback(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    const newUrls: string[] = [];
    for (const file of files) {
      const path = `${product.id}/client-${Date.now()}-${file.name}`;
      const { url, error } = await uploadFile("product-media", path, file);
      if (error) { setPhotoError(error); }
      else if (url) { newUrls.push(url); }
    }
    if (newUrls.length) {
      const updated = [...images, ...newUrls];
      await supabase.from("products").update({ images: updated }).eq("id", product.id);
      setImages(updated);
    }
    setUploadingPhoto(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDeletePhoto(url: string) {
    const updated = images.filter((u) => u !== url);
    await supabase.from("products").update({ images: updated }).eq("id", product.id);
    setImages(updated);
  }

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
        className="w-full max-w-lg flex flex-col h-full overflow-hidden shadow-2xl"
        style={{ background: "var(--portal-surface)" }}
      >
        {/* Drawer header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
          <div>
            <h2 className="text-[18px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>{product.name}</h2>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--portal-text-secondary)" }}>{product.category}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors text-[18px] leading-none" style={{ color: "var(--portal-text-secondary)" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stage */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
            <StagePill stage={product.stage} />
            <div className="mt-3 flex gap-0.5 h-1.5">
              {(["brief","sourcing","sampling","approved","production","qc","shipped"] as Stage[]).map((s, i) => {
                const idx = STAGE_ORDER.indexOf(product.stage);
                return (
                  <div key={s} className="flex-1 rounded-sm first:rounded-l last:rounded-r"
                    style={{ backgroundColor: i < idx ? "#C8963C" : i === idx ? "transparent" : "var(--portal-border)", border: i === idx ? "1.5px solid #C8963C" : undefined }} />
                );
              })}
            </div>
          </div>

          {/* Images / media */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>Photos</p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingPhoto}
                className="flex items-center gap-1 text-[11px] rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                style={{ color: "var(--portal-text-primary)", border: "1px solid var(--portal-border)" }}
              >
                <Upload size={11} /> {uploadingPhoto ? "Uploading…" : "Add photo"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </div>
            {photoError && <p className="mt-2 text-[11px] text-red-500">Upload failed: {photoError}</p>}
            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {images.map((url, i) => (
                  <div key={url} className="group relative aspect-square rounded-xl overflow-hidden" style={{ background: "var(--portal-surface-raised)", border: "1px solid var(--portal-border)" }}>
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.55)" }}>Preview</span>
                    )}
                    <button
                      onClick={() => handleDeletePhoto(url)}
                      className="absolute top-1 right-1 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full text-white transition-colors"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-dashed py-6"
                style={{ border: "1px dashed var(--portal-border)", background: "var(--portal-surface-raised)" }}
              >
                <Upload size={18} strokeWidth={1.5} style={{ color: "var(--portal-text-muted)" }} />
                <p className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>Upload photos for this product</p>
              </button>
            )}
          </div>

          {/* Product info */}
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--portal-text-muted)" }}>Product details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Category", product.category],
                ["MOQ", product.moq.toLocaleString() + " units"],
                ["Order qty", product.order_qty ? product.order_qty.toLocaleString() + " units" : "TBC"],
                ["Unit price", product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "TBC"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg p-3" style={{ background: "var(--portal-surface-raised)" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: "var(--portal-text-muted)" }}>{k}</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--portal-text-primary)" }}>{v}</p>
                </div>
              ))}
            </div>
            {product.colorways.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] mb-2" style={{ color: "var(--portal-text-muted)" }}>Colourways</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.colorways.map((c) => (
                    <span key={c} className="rounded-full px-2.5 py-1 text-[11px]" style={{ border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)", background: "var(--portal-surface)" }}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Milestone timeline */}
          {sorted.length > 0 && (
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--portal-text-muted)" }}>Timeline</p>
              <div className="flex flex-col gap-0">
                {sorted.map((m, i) => {
                  const done = !!m.completed_at;
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${done ? "bg-emerald-500" : new Date(m.due_date) < now ? "bg-red-400" : "border-2 border-[#C8963C]"}`}
                          style={!done && new Date(m.due_date) >= now ? { background: "var(--portal-surface)" } : {}}>
                          {done && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        {i < sorted.length - 1 && <div className="w-px flex-1 min-h-[20px] mt-0.5" style={{ background: "var(--portal-border)" }} />}
                      </div>
                      <div className="pb-4">
                        <p className={`text-[12px] font-medium ${done ? "line-through" : ""}`} style={{ color: done ? "var(--portal-text-muted)" : "var(--portal-text-primary)" }}>{m.title}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-text-muted)" }}>
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
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--portal-text-muted)" }}>Files & documents</p>
              {productFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 py-2 last:border-0" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
                  <FileText size={13} className="shrink-0" style={{ color: "var(--portal-text-muted)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: "var(--portal-text-primary)" }}>{f.filename}</p>
                    <p className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>{f.source === "agency" ? "Shared by agency" : "Your upload"}</p>
                  </div>
                  <button className="shrink-0 text-[11px]" style={{ color: "#0066CC" }}>Download</button>
                </div>
              ))}
            </div>
          )}

          {/* Feedback & updates */}
          <div className="px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--portal-text-muted)" }}>Updates & Feedback</p>
            <div className="flex gap-2 mb-4">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitFeedback()}
                placeholder="Leave feedback or a comment…"
                className="flex-1 rounded-xl px-3 py-2 text-[12px] outline-none transition-colors"
                style={{ border: "1px solid var(--portal-border)", background: "var(--portal-input-bg)", color: "var(--portal-text-primary)" }}
              />
              <button
                onClick={submitFeedback}
                disabled={!feedback.trim() || sendingFeedback}
                className="flex items-center justify-center h-9 w-9 rounded-xl text-white hover:opacity-90 disabled:opacity-30 transition-opacity shrink-0"
                style={{ background: "var(--portal-brand)" }}
              >
                <Send size={13} />
              </button>
            </div>
            {updates.length > 0 ? (
              <div className="flex flex-col gap-3">
                {updates.map((u) => {
                  const isClientMessage = u.author === client.name;
                  return (
                    <div key={u.id} className="flex items-start gap-2.5">
                      <div className={`mt-1 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[8px] font-bold text-white`}
                        style={{ background: isClientMessage ? "#C8963C" : "var(--portal-brand)" }}>
                        {u.author_initials}
                      </div>
                      <div>
                        <p className="text-[12px] leading-relaxed" style={{ color: "var(--portal-text-primary)" }}>{u.text}</p>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>{u.author} · {relativeTime(u.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-center py-4" style={{ color: "var(--portal-text-muted)" }}>No updates yet. Be the first to leave feedback.</p>
            )}
          </div>
        </div>

        {/* Sample approval CTA */}
        {product.stage === "sampling" && (
          <div className="px-6 py-4" style={{ borderTop: "1px solid var(--portal-border-subtle)" }}>
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
  const previewImg = product.images?.[0];
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl overflow-hidden hover:shadow-sm transition-all cursor-pointer"
      style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}
    >
      <div className="h-28 overflow-hidden" style={{ background: "var(--portal-surface-raised)" }}>
        {previewImg ? (
          <img src={previewImg} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity={0.25}>
              <rect x="6" y="3" width="20" height="26" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10" y1="10" x2="22" y2="10" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10" y1="15" x2="22" y2="15" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10" y1="20" x2="17" y2="20" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <p className="text-[12px] font-medium truncate" style={{ color: "var(--portal-text-primary)" }}>{product.name}</p>
        <p className="text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>
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
    <div className="rounded-lg p-5" style={{ background: "var(--portal-surface)", border: "1px solid var(--portal-border)" }}>
      <p className="text-[13px] font-medium mb-4" style={{ color: "var(--portal-text-primary)" }}>Latest updates</p>
      {all.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>No updates yet — your agency will post progress notes here</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {shown.map((u) => {
              const isRecent = (now.getTime() - new Date(u.created_at).getTime()) < 48 * 3600000;
              return (
                <div key={u.id} className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: isRecent ? "#1D9E75" : "var(--portal-border)" }} />
                  <div>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--portal-text-primary)" }}>{u.text}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>{u.productName} · {relativeTime(u.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {all.length > 4 && (
            <button onClick={() => setExpanded(!expanded)} className="mt-4 text-[11px]" style={{ color: "#0066CC" }}>
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
      className={`px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${sortable ? "cursor-pointer select-none" : ""}`}
      style={{ color: "var(--portal-text-secondary)" }}
      onClick={sortable && k ? () => toggleSort(k) : undefined}
    >
      {label}{sortable && k && <SortIcon k={k} />}
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-medium" style={{ color: "var(--portal-text-primary)" }}>All products ({sorted.length})</p>
        <button
          onClick={() => downloadCSV(csvRows, client.name)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] transition-colors"
          style={{ border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)", background: "transparent" }}
        >
          <Download size={11} />
          Export CSV
        </button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
        <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead style={{ background: "var(--portal-thead)", borderBottom: "1px solid var(--portal-border)" }}>
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
                <tr key={product.id} style={{ borderBottom: "1px solid var(--portal-border-subtle)", background: i % 2 === 0 ? "transparent" : "var(--portal-row-alt)" }}>
                  <td className="px-3 py-2.5 text-[12px] font-medium" style={{ color: "var(--portal-text-primary)" }}>{product.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>{product.category}</span>
                  </td>
                  <td className="px-3 py-2.5"><StagePill stage={product.stage} /></td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>{product.moq.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>
                    {product.quoted_cost_usd ? `$${product.quoted_cost_usd}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>{sampleDue ? formatDate(sampleDue) : "—"}</td>
                  <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>{formatDate(delivery)}</td>
                  <td className="px-3 py-2.5">
                    {isApproved ? (
                      <CheckCircle2 size={14} strokeWidth={2} className="text-emerald-500" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="2.25" stroke="var(--portal-border)" strokeWidth="1.5"/>
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
    <div className="flex items-center gap-3 py-2.5 last:border-0" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
      <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0" style={{ background: "var(--portal-surface-raised)" }}>
        {isImage ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="var(--portal-text-muted)" strokeWidth="1.2"/><circle cx="4.5" cy="4.5" r="1" fill="var(--portal-text-muted)"/><path d="M1 9.5l3-3 3 3 2-2 3 3" stroke="var(--portal-text-muted)" strokeWidth="1.2" strokeLinecap="round"/></svg>
        ) : isDoc ? (
          <FileText size={14} strokeWidth={1.5} style={{ color: "var(--portal-text-muted)" }} />
        ) : isZip ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="var(--portal-text-muted)" strokeWidth="1.2"/><path d="M6 1v12M6 4h2M6 7h2M6 10h2" stroke="var(--portal-text-muted)" strokeWidth="1.2" strokeLinecap="round"/></svg>
        ) : (
          <FileText size={14} strokeWidth={1.5} style={{ color: "var(--portal-text-muted)" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: "var(--portal-text-primary)" }}>{file.filename}</p>
        <p className="text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>
          {file.source === "client" ? "Uploaded by you" : "Shared by agency"} · {formatDate(file.uploaded_at)} · {fmtSize(file.size_kb)}
        </p>
      </div>
      <button className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] transition-colors shrink-0" style={{ border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)", background: "transparent" }}>
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
      <div className="rounded-xl p-5" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
        <p className="text-[13px] font-medium mb-3" style={{ color: "var(--portal-text-primary)" }}>Your uploads</p>
        {clientFiles.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>You have not uploaded any files yet — use the area below to upload artwork, references, or specifications</p>
        ) : (
          clientFiles.map((f) => <FileRow key={f.id} file={f} />)
        )}
      </div>

      <div className="rounded-xl p-5" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
        <p className="text-[13px] font-medium mb-3" style={{ color: "var(--portal-text-primary)" }}>Shared by agency</p>
        {agencyFiles.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>Your agency will share files here — tech packs, QC reports, and other documents will appear here</p>
        ) : (
          agencyFiles.map((f) => <FileRow key={f.id} file={f} />)
        )}
      </div>

      <div className="rounded-xl p-8 text-center cursor-pointer group transition-colors" style={{ border: "2px dashed var(--portal-border)", background: "var(--portal-surface)" }}>
        <Upload size={22} strokeWidth={1.5} className="mx-auto mb-3 transition-colors" style={{ color: "var(--portal-text-muted)" }} />
        <p className="text-[13px] font-medium" style={{ color: "var(--portal-text-primary)" }}>Upload artwork or references</p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>Drop files here or click to browse · .ai .pdf .png .jpg .psd .zip .mov .mp4 · max 500 MB</p>
      </div>
    </div>
  );
}

// ── SamplingInvoice ──────────────────────────────────────────
function SamplingInvoice({ projects, client }: { projects: PortalProject[]; client: Client }) {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const byProject = projects
    .map((proj) => ({
      ...proj,
      products: proj.products.filter((p) => p.sample_fee_usd != null && p.sample_fee_usd > 0),
    }))
    .filter((p) => p.products.length > 0);

  const grandTotal = byProject.flatMap((p) => p.products).reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);

  return (
    <div className="mt-8">
      <p className="text-[13px] font-medium mb-4" style={{ color: "var(--portal-text-primary)" }}>Sampling charges</p>
      {grandTotal === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
          <p className="text-[13px]" style={{ color: "var(--portal-text-secondary)" }}>No sampling charges to show yet</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
          {/* Invoice header */}
          <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--portal-border-subtle)", background: "var(--portal-thead)" }}>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Sampling Summary</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--portal-text-secondary)" }}>{client.name} · As of {date}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>Total</p>
              <p className="font-mono text-[22px] font-bold mt-0.5" style={{ color: "var(--portal-text-primary)" }}>${grandTotal.toFixed(2)}</p>
            </div>
          </div>

          {/* Per-collection groups */}
          {byProject.map((proj) => {
            const projTotal = proj.products.reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);
            return (
              <div key={proj.id} style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
                {/* Collection header */}
                <div className="flex items-center justify-between px-6 py-2.5" style={{ background: "var(--portal-row-alt)", borderBottom: "1px solid var(--portal-border-subtle)" }}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--portal-text-secondary)" }}>{proj.name}</span>
                  <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--portal-text-secondary)" }}>${projTotal.toFixed(2)}</span>
                </div>

                {/* Column headers */}
                <div className="grid px-6 py-1.5" style={{ gridTemplateColumns: "2rem 1fr auto auto", gap: "0.75rem", borderBottom: "1px solid var(--portal-border-subtle)", background: "var(--portal-thead)" }}>
                  {["#", "Product", "Date", "Amount"].map((h) => (
                    <span key={h} className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--portal-text-muted)" }}>{h}</span>
                  ))}
                </div>

                {/* Product rows */}
                {proj.products.map((p, i) => (
                  <div
                    key={p.id}
                    className="grid px-6 py-3 items-center"
                    style={{
                      gridTemplateColumns: "2rem 1fr auto auto",
                      gap: "0.75rem",
                      borderBottom: i < proj.products.length - 1 ? "1px solid var(--portal-border-subtle)" : undefined,
                      background: i % 2 === 0 ? "transparent" : "var(--portal-row-alt)",
                    }}
                  >
                    <span className="text-[11px] text-right" style={{ color: "var(--portal-text-muted)" }}>{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "var(--portal-text-primary)" }}>{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px]" style={{ color: "var(--portal-text-secondary)" }}>{p.category}</span>
                        <span style={{ color: "var(--portal-border)" }}>·</span>
                        <StagePill stage={p.stage} />
                      </div>
                    </div>
                    <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--portal-text-secondary)" }}>
                      {p.expected_sample_date ? formatDate(p.expected_sample_date) : "—"}
                    </span>
                    <span className="font-mono text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--portal-text-primary)" }}>
                      ${p.sample_fee_usd!.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Grand total footer */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "2px solid var(--portal-border)" }}>
            <span className="text-[13px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Total sampling charges</span>
            <span className="font-mono text-[16px] font-bold" style={{ color: "var(--portal-text-primary)" }}>${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ContractsList ────────────────────────────────────────────
function ContractsList({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
        <FileText size={28} strokeWidth={1.2} className="mx-auto mb-3" style={{ color: "var(--portal-text-muted)" }} />
        <p className="text-[13px]" style={{ color: "var(--portal-text-secondary)" }}>Your contracts will appear here once shared by your agency</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
      {contracts.map((c) => {
        const d = new Date(c.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
        const isSigned = c.status === "signed";
        return (
          <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 last:border-0" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
            <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0" style={{ background: "var(--portal-surface-raised)" }}>
              <FileText size={14} strokeWidth={1.5} style={{ color: "var(--portal-text-secondary)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium" style={{ color: "var(--portal-text-primary)" }}>{c.name}</p>
              <p className="text-[11px]" style={{ color: "var(--portal-text-secondary)" }}>{isSigned ? "Signed" : "Sent"} · {d}</p>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-medium leading-none shrink-0"
              style={isSigned ? { backgroundColor: "#EAF3DE", color: "#27500A" } : { backgroundColor: "#FAEEDA", color: "#633806" }}
            >
              {isSigned ? "Signed" : "Pending"}
            </span>
            <button className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] transition-colors shrink-0" style={{ border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)", background: "transparent" }}>
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
  const { dark, toggle } = usePortalTheme();

  if (locked) return <PortalGate client={client} />;

  return (
    <div
      className="min-h-full"
      style={{ background: "var(--portal-bg)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}
    >
      <PortalNavBar client={client} tab={tab} setTab={setTab} dark={dark} onToggleTheme={toggle} />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-5 sm:py-8">
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

        {tab === "sampling" && (
          <motion.div key="sampling" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <SamplingInvoice projects={projects} client={client} />
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
            <p className="text-[13px] font-medium mb-4" style={{ color: "var(--portal-text-primary)" }}>Contracts ({contracts.length})</p>
            <ContractsList contracts={contracts} />
          </motion.div>
        )}
      </main>

      <footer className="py-8 text-center text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
        Powered by Source[Archive]
      </footer>

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailDrawer
            product={selectedProduct}
            files={files}
            client={client}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
