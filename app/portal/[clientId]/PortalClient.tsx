"use client";

import { useState, useMemo, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CheckCircle2, Upload, FileText, Download, ChevronUp, ChevronDown, Send, Sun, Moon, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/lib/storage";
import type { Client, Contract, PortalFile, AgencySettings, SavedInvoice, InvoiceLineItem } from "@/lib/data";
import { createSamplingInvoice, updateInvoiceStatus, deleteInvoice } from "./actions";
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
type Tab = "overview" | "sampling" | "projects" | "files" | "contracts" | "references";

interface Props {
  client: Client;
  locked: boolean;
  projects: PortalProject[];
  contracts: Contract[];
  files: PortalFile[];
  agencySettings: AgencySettings;
  isAgency: boolean;
  savedInvoices: SavedInvoice[];
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
    { id: "overview",    label: "Overview" },
    { id: "sampling",    label: "Sampling" },
    { id: "projects",    label: "Projects" },
    { id: "files",       label: "Files" },
    { id: "contracts",   label: "Contracts" },
    { id: "references",  label: "References" },
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

// ── Lightbox ─────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, [index]);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, close]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.003)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    setOffset({ x: offsetStart.current.x + e.clientX - dragStart.current.x, y: offsetStart.current.y + e.clientY - dragStart.current.y });
  }
  function onMouseUp() { dragging.current = false; }

  function onImgClick() {
    if (scale > 1) { setScale(1); setOffset({ x: 0, y: 0 }); }
    else setScale(2.5);
  }

  const nav = (dir: 1 | -1) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => Math.max(0, Math.min(images.length - 1, i + dir)));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center select-none" style={{ background: "rgba(0,0,0,0.93)" }}>
      {/* Header */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-10">
        <span className="text-white/50 text-[13px]">{index + 1} / {images.length}</span>
        <button onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full text-white text-[18px]" style={{ background: "rgba(255,255,255,0.12)" }}>✕</button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex items-center justify-center"
        style={{ width: "100vw", height: "100vh", overflow: "hidden", cursor: scale > 1 ? "grab" : "zoom-in" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onImgClick}
      >
        <img
          src={images[index]}
          alt=""
          draggable={false}
          style={{
            maxWidth: "92vw",
            maxHeight: "88vh",
            objectFit: "contain",
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transition: dragging.current ? "none" : "transform 0.2s ease",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Prev */}
      {index > 0 && (
        <button onClick={nav(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white text-[22px]" style={{ background: "rgba(255,255,255,0.12)" }}>‹</button>
      )}
      {/* Next */}
      {index < images.length - 1 && (
        <button onClick={nav(1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white text-[22px]" style={{ background: "rgba(255,255,255,0.12)" }}>›</button>
      )}

      {scale === 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/30 pointer-events-none">Click or scroll to zoom · arrow keys to navigate</p>
      )}
    </div>
  );
}

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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
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
    <>
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
                    <button className="h-full w-full" onClick={() => setLightboxIdx(i)}>
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white pointer-events-none" style={{ background: "rgba(0,0,0,0.55)" }}>Preview</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(url); }}
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
              {product.sample_fee_usd != null && (
                <div className="col-span-2 rounded-lg p-3" style={{ background: "var(--portal-surface-raised)", border: "1px solid var(--portal-border)" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: "var(--portal-text-muted)" }}>Sample cost</p>
                  <p className="text-[16px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>${product.sample_fee_usd.toFixed(2)}</p>
                </div>
              )}
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

    {lightboxIdx !== null && (
      <Lightbox images={images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
    )}
    </>
  );
}

function ProductCard({ product, onClick }: { product: PortalProduct; onClick: () => void }) {
  const previewImg = product.images?.[0];
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col text-left rounded-xl overflow-hidden hover:shadow-sm transition-all cursor-pointer"
      style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}
    >
      <div className="w-full aspect-[4/5] overflow-hidden" style={{ background: "var(--portal-surface-raised)" }}>
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
        <div className="flex items-center justify-between">
          <StagePill stage={product.stage} />
          {product.sample_fee_usd != null && (
            <span className="text-[11px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
              ${product.sample_fee_usd.toFixed(2)} sample
            </span>
          )}
        </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
function buildInvoiceHTML(
  client: Client,
  byProject: Array<{ id: string; name: string; season: string; products: PortalProduct[] }>,
  grandTotal: number,
  date: string,
  agencySettings: AgencySettings,
): string {
  const rows = byProject.map((proj) => {
    const projTotal = proj.products.reduce((s, p) => s + (p.sample_fee_usd ?? 0), 0);
    const productRows = proj.products.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f7"}">
        <td style="padding:10px 16px;font-size:11px;color:#888;text-align:right">${i + 1}</td>
        <td style="padding:10px 16px">
          <div style="font-size:12px;font-weight:500;color:#1d1d1f">${p.name}</div>
          <div style="font-size:10px;color:#888;margin-top:2px">${p.category}</div>
        </td>
        <td style="padding:10px 16px;font-size:11px;color:#555;white-space:nowrap">${p.expected_sample_date ? new Date(p.expected_sample_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
        <td style="padding:10px 16px;font-size:13px;font-weight:600;font-family:monospace;white-space:nowrap;text-align:right">$${p.sample_fee_usd!.toFixed(2)}</td>
      </tr>`).join("");
    return `
      <tr style="background:#f5f5f0">
        <td colspan="3" style="padding:8px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#555">${proj.name}${proj.season ? ` · ${proj.season}` : ""}</td>
        <td style="padding:8px 16px;font-size:12px;font-weight:600;font-family:monospace;text-align:right;color:#555">$${projTotal.toFixed(2)}</td>
      </tr>
      ${productRows}`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sampling Invoice – ${client.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;background:#fff;color:#1d1d1f;padding:40px}
  @media print{body{padding:20px}button{display:none!important}@page{margin:20mm}}
  table{width:100%;border-collapse:collapse}
  th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;padding:8px 16px;text-align:left;border-bottom:1px solid #eee}
  th:last-child{text-align:right}
  tr{border-bottom:1px solid #eee}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
  <div>
    <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">Sampling Invoice</div>
    <div style="font-size:13px;color:#888;margin-top:4px">${client.name} · ${date}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#aaa">Total due</div>
    <div style="font-size:28px;font-weight:800;font-family:monospace;margin-top:2px">$${grandTotal.toFixed(2)}</div>
  </div>
</div>
<div style="border:1px solid #eee;border-radius:10px;overflow:hidden">
<table>
  <thead><tr><th style="width:2rem">#</th><th>Product</th><th>Expected Date</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-top:2px solid #eee">
  <span style="font-size:13px;font-weight:600">Total sampling charges</span>
  <span style="font-size:16px;font-weight:800;font-family:monospace">$${grandTotal.toFixed(2)}</span>
</div>
</div>
${(() => {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const row = (label: string, val: string) => val ? `<tr><td style="padding:4px 0;font-size:10px;color:#aaa;white-space:nowrap;width:140px">${label}</td><td style="padding:4px 0 4px 12px;font-size:11px;color:#333;font-weight:500">${esc(val)}</td></tr>` : "";
  const hasBankDetails = [agencySettings.account_name, agencySettings.bank_name, agencySettings.account_number, agencySettings.sort_code, agencySettings.iban, agencySettings.swift_code, agencySettings.account_location, agencySettings.bank_address, agencySettings.account_created_on].some(Boolean);
  const bankBlock = hasBankDetails ? `<div style="border:1px solid #eee;border-radius:10px;padding:16px;flex:1">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:10px">Bank details</div>
  <table style="border-collapse:collapse;width:100%">
    ${row("Account name", agencySettings.account_name)}
    ${row("Bank name", agencySettings.bank_name)}
    ${row("Account number", agencySettings.account_number)}
    ${row("Sort code", agencySettings.sort_code)}
    ${row("IBAN", agencySettings.iban)}
    ${row("SWIFT / BIC", agencySettings.swift_code)}
    ${row("Account location", agencySettings.account_location)}
    ${row("Bank address", agencySettings.bank_address)}
    ${row("Account created on", agencySettings.account_created_on)}
  </table>
</div>` : "";
  const termsBlock = agencySettings.invoice_terms ? `<div style="border:1px solid #eee;border-radius:10px;padding:16px;flex:1">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:10px">Terms &amp; conditions</div>
  <p style="font-size:11px;color:#333;line-height:1.7">${esc(agencySettings.invoice_terms)}</p>
</div>` : "";
  return (bankBlock || termsBlock) ? `<div style="margin-top:24px;display:flex;gap:16px;align-items:flex-start">${bankBlock}${termsBlock}</div>` : "";
})()}
<div style="margin-top:16px;font-size:10px;color:#aaa;text-align:center">Generated by Kōru · ${date}</div>
</body></html>`;
}

function buildSavedInvoiceHTML(invoice: SavedInvoice, client: Client, agencySettings: AgencySettings): string {
  const date = new Date(invoice.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const grandTotal = invoice.line_items.reduce((s, li) => s + li.amount_usd, 0);
  const rows = invoice.line_items.map((li, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f7"}">
      <td style="padding:10px 16px;font-size:11px;color:#888;text-align:right">${i + 1}</td>
      <td style="padding:10px 16px">
        <div style="font-size:12px;font-weight:500;color:#1d1d1f">${li.name}</div>
        <div style="font-size:10px;color:#888;margin-top:2px">${[li.category, li.project_name].filter(Boolean).join(" · ")}</div>
      </td>
      <td style="padding:10px 16px;font-size:11px;color:#555;white-space:nowrap">${li.expected_date ? new Date(li.expected_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;font-family:monospace;white-space:nowrap;text-align:right">$${li.amount_usd.toFixed(2)}</td>
    </tr>`).join("");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const bRow = (label: string, val: string) => val ? `<tr><td style="padding:4px 0;font-size:10px;color:#aaa;white-space:nowrap;width:140px">${label}</td><td style="padding:4px 0 4px 12px;font-size:11px;color:#333;font-weight:500">${esc(val)}</td></tr>` : "";
  const hasBankDetails = [agencySettings.account_name, agencySettings.bank_name, agencySettings.account_number, agencySettings.sort_code, agencySettings.iban, agencySettings.swift_code, agencySettings.account_location, agencySettings.bank_address].some(Boolean);
  const bankBlock = hasBankDetails ? `<div style="border:1px solid #eee;border-radius:10px;padding:16px;flex:1">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:10px">Bank details</div>
  <table style="border-collapse:collapse;width:100%">
    ${bRow("Account name", agencySettings.account_name)}
    ${bRow("Bank name", agencySettings.bank_name)}
    ${bRow("Account number", agencySettings.account_number)}
    ${bRow("Sort code", agencySettings.sort_code)}
    ${bRow("IBAN", agencySettings.iban)}
    ${bRow("SWIFT / BIC", agencySettings.swift_code)}
    ${bRow("Account location", agencySettings.account_location)}
    ${bRow("Bank address", agencySettings.bank_address)}
  </table>
</div>` : "";
  const termsBlock = agencySettings.invoice_terms ? `<div style="border:1px solid #eee;border-radius:10px;padding:16px;flex:1">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:10px">Terms &amp; conditions</div>
  <p style="font-size:11px;color:#333;line-height:1.7">${esc(agencySettings.invoice_terms)}</p>
</div>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${invoice.title ?? `Round ${invoice.round} Invoice`} – ${client.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;background:#fff;color:#1d1d1f;padding:40px}
  @media print{body{padding:20px}button{display:none!important}@page{margin:20mm}}
  table{width:100%;border-collapse:collapse}
  th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;padding:8px 16px;text-align:left;border-bottom:1px solid #eee}
  th:last-child{text-align:right}
  tr{border-bottom:1px solid #eee}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
  <div>
    <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">${invoice.title ?? `Sampling Invoice – Round ${invoice.round}`}</div>
    <div style="font-size:13px;color:#888;margin-top:4px">${client.name} · ${date}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#aaa">Total due</div>
    <div style="font-size:28px;font-weight:800;font-family:monospace;margin-top:2px">$${grandTotal.toFixed(2)}</div>
  </div>
</div>
${invoice.notes ? `<p style="font-size:12px;color:#555;margin-bottom:20px;line-height:1.6">${esc(invoice.notes)}</p>` : "<div style='margin-bottom:20px'></div>"}
<div style="border:1px solid #eee;border-radius:10px;overflow:hidden">
<table>
  <thead><tr><th style="width:2rem">#</th><th>Item</th><th>Expected Date</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-top:2px solid #eee">
  <span style="font-size:13px;font-weight:600">Total</span>
  <span style="font-size:16px;font-weight:800;font-family:monospace">$${grandTotal.toFixed(2)}</span>
</div>
</div>
${(bankBlock || termsBlock) ? `<div style="margin-top:24px;display:flex;gap:16px;align-items:flex-start">${bankBlock}${termsBlock}</div>` : ""}
<div style="margin-top:16px;font-size:10px;color:#aaa;text-align:center">Generated by Kōru · ${date}</div>
</body></html>`;
}

const STATUS_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft",  bg: "#F1EFE8", fg: "#444441" },
  sent:  { label: "Sent",   bg: "#FAEEDA", fg: "#633806" },
  paid:  { label: "Paid",   bg: "#EAF3DE", fg: "#27500A" },
};

function SamplingInvoice({
  projects, client, agencySettings, isAgency, savedInvoices: initialInvoices,
}: {
  projects: PortalProject[];
  client: Client;
  agencySettings: AgencySettings;
  isAgency: boolean;
  savedInvoices: SavedInvoice[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [invoices, setInvoices] = useState<SavedInvoice[]>(initialInvoices);
  const [activeRound, setActiveRound] = useState<number>(initialInvoices.length > 0 ? initialInvoices[0].round : 1);
  const [showSelector, setShowSelector] = useState(false);
  const [saving, setSaving] = useState(false);

  // Flat list of all products across projects
  const allProducts = projects.flatMap((proj) =>
    proj.products.map((p) => ({ ...p, project_name: proj.name }))
  );

  // Per-product selection + editable amounts
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  function openSelector() {
    const withFees = allProducts.filter((p) => (p.sample_fee_usd ?? 0) > 0);
    setSelected(new Set(withFees.map((p) => p.id)));
    setAmounts(Object.fromEntries(allProducts.map((p) => [p.id, p.sample_fee_usd ?? 0])));
    setShowSelector(true);
  }

  function toggleProduct(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const nextRound = invoices.length > 0 ? Math.max(...invoices.map((i) => i.round)) + 1 : 1;
  const selectedTotal = Array.from(selected).reduce((s, id) => s + (amounts[id] ?? 0), 0);

  async function handleCreate() {
    const items: InvoiceLineItem[] = Array.from(selected).map((id) => {
      const p = allProducts.find((p) => p.id === id)!;
      return {
        name: p.name,
        category: p.category,
        project_name: p.project_name,
        amount_usd: amounts[id] ?? p.sample_fee_usd ?? 0,
        expected_date: p.expected_sample_date,
      };
    });
    setSaving(true);
    await createSamplingInvoice({
      client_id: client.id,
      round: nextRound,
      title: null,
      line_items: items,
      notes: null,
    });
    setSaving(false);
    setShowSelector(false);
    startTransition(() => router.refresh());
  }

  async function handleStatusChange(id: string, status: string) {
    setInvoices((prev) => prev.map((inv) => inv.id === id ? { ...inv, status } : inv));
    await updateInvoiceStatus(id, client.id, status);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string, round: number) {
    if (!window.confirm(`Delete Round ${round} invoice? This cannot be undone.`)) return;
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    const remaining = invoices.filter((inv) => inv.id !== id);
    if (remaining.length > 0) setActiveRound(remaining[remaining.length - 1].round);
    await deleteInvoice(id, client.id);
    startTransition(() => router.refresh());
  }

  function handleDownload(invoice: SavedInvoice) {
    const html = buildSavedInvoiceHTML(invoice, client, agencySettings);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  useEffect(() => { setInvoices(initialInvoices); }, [initialInvoices]);
  useEffect(() => {
    if (initialInvoices.length > 0 && !initialInvoices.find((i) => i.round === activeRound)) {
      setActiveRound(initialInvoices[initialInvoices.length - 1].round);
    }
  }, [initialInvoices, activeRound]);

  const activeInvoice = invoices.find((i) => i.round === activeRound) ?? invoices[0] ?? null;

  return (
    <div className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-medium" style={{ color: "var(--portal-text-primary)" }}>Sampling quotes</p>
        {isAgency && !showSelector && (
          <button
            onClick={openSelector}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={{ background: "var(--portal-brand)", color: "#fff" }}
          >
            <Plus size={12} /> New quote
          </button>
        )}
      </div>

      {/* Product selector */}
      {showSelector && (
        <div className="rounded-xl mb-5 overflow-hidden" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)", background: "var(--portal-thead)" }}>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Round {nextRound} — Select products</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--portal-text-muted)" }}>Check the products to include and set the fee for each</p>
            </div>
            <button onClick={() => setShowSelector(false)} className="p-1 rounded" style={{ color: "var(--portal-text-muted)" }}>
              <X size={14} />
            </button>
          </div>

          {allProducts.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-center" style={{ color: "var(--portal-text-muted)" }}>No products in this collection yet.</p>
          ) : (
            allProducts.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                style={{
                  borderBottom: i < allProducts.length - 1 ? "1px solid var(--portal-border-subtle)" : undefined,
                  background: selected.has(p.id) ? "var(--portal-row-alt)" : "transparent",
                }}
                onClick={() => toggleProduct(p.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleProduct(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ accentColor: "var(--portal-brand)", width: 15, height: 15, flexShrink: 0 }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: "var(--portal-text-primary)" }}>{p.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--portal-text-muted)" }}>
                    {p.project_name}{p.category ? ` · ${p.category}` : ""}{p.sample_round > 1 ? ` · R${p.sample_round}` : ""}
                  </p>
                </div>
                {selected.has(p.id) && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amounts[p.id] ?? 0}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                      className="rounded px-2 py-1 text-[12px] font-mono outline-none w-24 text-right"
                      style={{ border: "1px solid var(--portal-border)", background: "var(--portal-bg)", color: "var(--portal-text-primary)" }}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "2px solid var(--portal-border)", background: "var(--portal-thead)" }}>
            <div>
              <span className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>{selected.size} product{selected.size !== 1 ? "s" : ""} selected</span>
              <span className="mx-2 text-[11px]" style={{ color: "var(--portal-border)" }}>·</span>
              <span className="font-mono text-[13px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>${selectedTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSelector(false)} className="rounded-lg px-3 py-1.5 text-[12px]" style={{ border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)" }}>
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || selected.size === 0}
                className="rounded-lg px-4 py-1.5 text-[12px] font-medium disabled:opacity-50"
                style={{ background: "var(--portal-brand)", color: "#fff" }}
              >
                {saving ? "Saving…" : "Add to quote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {invoices.length === 0 && !showSelector && (
        <div className="rounded-xl p-8 text-center" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
          <p className="text-[13px]" style={{ color: "var(--portal-text-secondary)" }}>
            {isAgency ? 'No quotes yet. Click "New quote" to create one.' : "No sampling quotes to show yet."}
          </p>
        </div>
      )}

      {/* Saved invoices */}
      {invoices.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
          {invoices.length > 1 && (
            <div className="flex gap-1 px-4 pt-3 pb-0" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
              {invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => setActiveRound(inv.round)}
                  className="px-3 py-2 text-[12px] font-medium rounded-t-lg transition-colors"
                  style={activeRound === inv.round
                    ? { color: "var(--portal-brand)", borderBottom: "2px solid var(--portal-brand)", marginBottom: "-1px" }
                    : { color: "var(--portal-text-secondary)" }}
                >
                  Round {inv.round}
                </button>
              ))}
            </div>
          )}

          {activeInvoice && (() => {
            const total = activeInvoice.line_items.reduce((s, li) => s + li.amount_usd, 0);
            const statusCfg = STATUS_CFG[activeInvoice.status] ?? STATUS_CFG.draft;
            const invoiceDate = new Date(activeInvoice.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
            return (
              <>
                <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--portal-border-subtle)", background: "var(--portal-thead)" }}>
                  <div>
                    <p className="text-[15px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
                      {activeInvoice.title ?? `Round ${activeInvoice.round} Sampling`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>{client.name} · {invoiceDate}</p>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium leading-none" style={{ backgroundColor: statusCfg.bg, color: statusCfg.fg }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>Total</p>
                    <p className="font-mono text-[22px] font-bold mt-0.5" style={{ color: "var(--portal-text-primary)" }}>${total.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid px-6 py-1.5" style={{ gridTemplateColumns: "2rem 1fr auto auto", gap: "0.75rem", borderBottom: "1px solid var(--portal-border-subtle)", background: "var(--portal-thead)" }}>
                  {["#", "Item", "Date", "Amount"].map((h) => (
                    <span key={h} className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--portal-text-muted)" }}>{h}</span>
                  ))}
                </div>
                {activeInvoice.line_items.map((li, i) => (
                  <div key={i} className="grid px-6 py-3 items-center"
                    style={{
                      gridTemplateColumns: "2rem 1fr auto auto",
                      gap: "0.75rem",
                      borderBottom: i < activeInvoice.line_items.length - 1 ? "1px solid var(--portal-border-subtle)" : undefined,
                      background: i % 2 === 0 ? "transparent" : "var(--portal-row-alt)",
                    }}
                  >
                    <span className="text-[11px] text-right" style={{ color: "var(--portal-text-muted)" }}>{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "var(--portal-text-primary)" }}>{li.name}</p>
                      {(li.category || li.project_name) && (
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--portal-text-secondary)" }}>
                          {[li.category, li.project_name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--portal-text-secondary)" }}>{li.expected_date ? formatDate(li.expected_date) : "—"}</span>
                    <span className="font-mono text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--portal-text-primary)" }}>${li.amount_usd.toFixed(2)}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "2px solid var(--portal-border)" }}>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Total</span>
                  <span className="font-mono text-[16px] font-bold" style={{ color: "var(--portal-text-primary)" }}>${total.toFixed(2)}</span>
                </div>

                {activeInvoice.notes && (
                  <div className="px-6 pb-4">
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--portal-text-secondary)" }}>{activeInvoice.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 px-6 py-3" style={{ borderTop: "1px solid var(--portal-border-subtle)", background: "var(--portal-thead)" }}>
                  <button onClick={() => handleDownload(activeInvoice)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
                    style={{ background: "var(--portal-brand)", color: "#fff" }}
                  >
                    <Download size={12} /> Download PDF
                  </button>
                  {isAgency && (
                    <>
                      <select
                        value={activeInvoice.status}
                        onChange={(e) => handleStatusChange(activeInvoice.id, e.target.value)}
                        className="rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                        style={{ border: "1px solid var(--portal-border)", background: "var(--portal-bg)", color: "var(--portal-text-primary)" }}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                      </select>
                      <button onClick={() => handleDelete(activeInvoice.id, activeInvoice.round)}
                        className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors"
                        style={{ color: "#c0392b", border: "1px solid #fbc9c6" }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            );
          })()}
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

// ── ReferencesTab ─────────────────────────────────────────────
const REF_PURPOSES = ["shape", "fit", "fabric", "other"] as const;
const REF_STATUS_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  submitted:  { label: "Submitted",  bg: "#DBEAFE", fg: "#1D4ED8" },
  in_transit: { label: "In transit", bg: "#FEF3C7", fg: "#92400E" },
  arrived:    { label: "Arrived",    bg: "#D1FAE5", fg: "#065F46" },
  in_factory: { label: "At factory", bg: "#EDE9FE", fg: "#5B21B6" },
  returned:   { label: "Returned",   bg: "#F3F4F6", fg: "#6B7280" },
};

function ReferencesTab({ client, projects }: { client: Client; projects: PortalProject[] }) {
  const allProducts = projects.flatMap((p) => p.products);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [clientImages, setClientImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    item_description: "",
    brand: "",
    size: "",
    reference_for: [] as string[],
    reference_for_other: "",
    product_id: "",
    courier: "",
    tracking_number: "",
    expected_arrival_date: "",
    client_notes: "",
  });

  useEffect(() => {
    supabase
      .from("reference_samples")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setSamples(data ?? []); setLoading(false); });
  }, [client.id]);

  function togglePurpose(p: string) {
    setForm((prev) => ({
      ...prev,
      reference_for: prev.reference_for.includes(p)
        ? prev.reference_for.filter((x) => x !== p)
        : [...prev.reference_for, p],
    }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingPhoto(true);
    const urls: string[] = [];
    for (const file of files) {
      const path = `references/portal-${client.id}-${Date.now()}-${file.name}`;
      const { url } = await uploadFile("product-media", path, file);
      if (url) urls.push(url);
    }
    setClientImages((prev) => [...prev, ...urls]);
    setUploadingPhoto(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!form.item_description.trim()) return;
    setSubmitting(true);
    const payload = {
      id: `ref-${Date.now()}`,
      client_id: client.id,
      product_id: form.product_id || null,
      item_description: form.item_description.trim(),
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      reference_for: form.reference_for,
      reference_for_other: form.reference_for.includes("other") ? form.reference_for_other.trim() || null : null,
      courier: form.courier.trim() || null,
      tracking_number: form.tracking_number.trim() || null,
      expected_arrival_date: form.expected_arrival_date || null,
      client_notes: form.client_notes.trim() || null,
      client_images: clientImages,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("reference_samples").insert(payload).select().single();
    if (!error && data) {
      setSamples((prev) => [data, ...prev]);
      setShowForm(false);
      setForm({ item_description: "", brand: "", size: "", reference_for: [], reference_for_other: "", product_id: "", courier: "", tracking_number: "", expected_arrival_date: "", client_notes: "" });
      setClientImages([]);
    }
    setSubmitting(false);
  }

  const inputCls = "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-colors";
  const inputStyle = { border: "1px solid var(--portal-border)", background: "var(--portal-input-bg)", color: "var(--portal-text-primary)" };
  const labelCls = "text-[11px] font-medium mb-1 block";

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Reference Garments</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--portal-text-secondary)" }}>Submit reference garments you are sending us to help guide production</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 rounded-xl px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--portal-brand)" }}
          >
            + Submit reference
          </button>
        )}
      </div>

      {/* Submission form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl mb-6 overflow-hidden"
            style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
              <p className="text-[14px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>Submit reference garment</p>
              <button onClick={() => setShowForm(false)} style={{ color: "var(--portal-text-secondary)" }}>✕</button>
            </div>

            <div className="px-5 py-5 flex flex-col gap-4">
              {/* Item + brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Item description <span style={{ color: "var(--portal-brand)" }}>*</span></label>
                  <input type="text" value={form.item_description} onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))} placeholder="e.g. Oversized bomber jacket" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Brand</label>
                  <input type="text" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="e.g. Acne Studios" className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Size + product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Size</label>
                  <input type="text" value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} placeholder="e.g. M / EU 48 / UK 12" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Link to product (optional)</label>
                  <select value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} className={inputCls} style={{ ...inputStyle, appearance: "none" }}>
                    <option value="">No product linked</option>
                    {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>What are you using this reference for?</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {REF_PURPOSES.map((p) => {
                    const active = form.reference_for.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePurpose(p)}
                        className="rounded-full px-3 py-1.5 text-[12px] font-medium capitalize transition-colors"
                        style={active
                          ? { background: "var(--portal-brand)", color: "#fff" }
                          : { border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)", background: "transparent" }
                        }
                      >{p}</button>
                    );
                  })}
                </div>
                {form.reference_for.includes("other") && (
                  <input type="text" value={form.reference_for_other} onChange={(e) => setForm((f) => ({ ...f, reference_for_other: e.target.value }))} placeholder="Describe what else…" className={`${inputCls} mt-2`} style={inputStyle} />
                )}
              </div>

              {/* Courier + tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Courier</label>
                  <input type="text" value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} placeholder="e.g. DHL, FedEx, Royal Mail" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Tracking number</label>
                  <input type="text" value={form.tracking_number} onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))} placeholder="e.g. 1234567890" className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Expected arrival */}
              <div>
                <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Expected arrival date</label>
                <input type="date" value={form.expected_arrival_date} onChange={(e) => setForm((f) => ({ ...f, expected_arrival_date: e.target.value }))} className={inputCls} style={inputStyle} />
              </div>

              {/* Photos */}
              <div>
                <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Photos of the garment</label>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                {clientImages.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {clientImages.map((url) => (
                      <div key={url} className="group relative aspect-square rounded-xl overflow-hidden" style={{ border: "1px solid var(--portal-border)" }}>
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => setClientImages((prev) => prev.filter((u) => u !== url))}
                          className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px]"
                          style={{ background: "rgba(0,0,0,0.6)" }}
                        >✕</button>
                      </div>
                    ))}
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto} className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50" style={{ border: "1px dashed var(--portal-border)", background: "var(--portal-surface-raised)" }}>
                      <Upload size={16} strokeWidth={1.5} style={{ color: "var(--portal-text-muted)" }} />
                      <span className="text-[10px]" style={{ color: "var(--portal-text-muted)" }}>{uploadingPhoto ? "…" : "Add"}</span>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto} className="flex w-full flex-col items-center gap-2 rounded-xl py-6 transition-colors disabled:opacity-50" style={{ border: "1px dashed var(--portal-border)", background: "var(--portal-surface-raised)" }}>
                    <Upload size={20} strokeWidth={1.5} style={{ color: "var(--portal-text-muted)" }} />
                    <p className="text-[12px]" style={{ color: "var(--portal-text-muted)" }}>{uploadingPhoto ? "Uploading…" : "Upload photos of the garment"}</p>
                  </button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls} style={{ color: "var(--portal-text-secondary)" }}>Additional notes</label>
                <textarea value={form.client_notes} onChange={(e) => setForm((f) => ({ ...f, client_notes: e.target.value }))} rows={3} placeholder="Any specific details or instructions…" className={`${inputCls} resize-none`} style={inputStyle} />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-1">
                <button onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2.5 text-[13px] transition-colors" style={{ border: "1px solid var(--portal-border)", color: "var(--portal-text-secondary)", background: "transparent" }}>Cancel</button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !form.item_description.trim()}
                  className="rounded-xl px-5 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--portal-brand)" }}
                >
                  {submitting ? "Submitting…" : "Submit reference"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing submissions */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-[13px]" style={{ color: "var(--portal-text-muted)" }}>Loading…</p>
        </div>
      ) : samples.length === 0 ? (
        <div className="rounded-2xl flex flex-col items-center justify-center py-14 gap-3" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
          <p className="text-[14px] font-medium" style={{ color: "var(--portal-text-primary)" }}>No references submitted yet</p>
          <p className="text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>Use the button above to submit your first reference garment</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {samples.map((s) => {
            const cfg = REF_STATUS_CFG[s.status] ?? REF_STATUS_CFG.submitted;
            return (
              <div key={s.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)" }}>
                <div className="flex items-start justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>{s.item_description}</p>
                    {s.brand && <p className="text-[12px] mt-0.5" style={{ color: "var(--portal-text-secondary)" }}>{s.brand}{s.size ? ` · Size ${s.size}` : ""}</p>}
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ml-3" style={{ background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>
                </div>
                <div className="px-5 py-3 flex flex-wrap gap-3 text-[12px]" style={{ color: "var(--portal-text-secondary)" }}>
                  {(s.reference_for ?? []).length > 0 && (
                    <span>Purpose: <strong style={{ color: "var(--portal-text-primary)" }}>{(s.reference_for as string[]).join(", ")}</strong></span>
                  )}
                  {s.courier && <span>Via {s.courier}</span>}
                  {s.tracking_number && <span>Tracking: <strong style={{ color: "var(--portal-text-primary)" }}>{s.tracking_number}</strong></span>}
                  {s.expected_arrival_date && <span>Expected: {new Date(s.expected_arrival_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
                </div>
                {s.client_images?.length > 0 && (
                  <div className="px-5 pb-4 grid grid-cols-4 gap-2">
                    {(s.client_images as string[]).map((url: string) => (
                      <img key={url} src={url} alt="" className="aspect-square rounded-xl object-cover w-full" style={{ border: "1px solid var(--portal-border)" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main portal ──────────────────────────────────────────────
export function PortalClient({ client, locked, projects, contracts, files, agencySettings, isAgency, savedInvoices }: Props) {
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
            <SamplingInvoice projects={projects} client={client} agencySettings={agencySettings} isAgency={isAgency} savedInvoices={savedInvoices} />
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

        {tab === "references" && (
          <motion.div key="references" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <ReferencesTab client={client} projects={projects} />
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
