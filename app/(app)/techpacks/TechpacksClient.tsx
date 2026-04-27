"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Download, ExternalLink } from "lucide-react";
import { supabaseData as supabase } from "@/lib/supabase-data";
import { cn } from "@/lib/utils";
import type { TechpackSubmission } from "@/lib/data";

interface Props { submissions: TechpackSubmission[] }

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  new:         { label: "New",         cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  reviewing:   { label: "Reviewing",   cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  in_progress: { label: "In progress", cls: "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  complete:    { label: "Complete",    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
  sent:        { label: "Sent",        cls: "bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400" },
};

const ALL_STATUSES = ["all", ...Object.keys(STATUS_CFG)] as const;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.new;
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap", cfg.cls)}>{cfg.label}</span>;
}

function Chip({ label }: { label: string }) {
  return <span className="rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[10px] text-[var(--sa-text-secondary)]">{label}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 border-t border-[var(--sa-border)]">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-3">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null | boolean }) {
  if (value == null || value === "" || value === false) return null;
  const display = value === true ? "Yes" : String(value);
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-[11px] text-[var(--sa-text-tertiary)] leading-relaxed">{label}</span>
      <span className="text-[12px] text-[var(--sa-text-primary)] leading-relaxed">{display}</span>
    </div>
  );
}

function ChipRow({ label, values }: { label: string; values: string[] }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-[11px] text-[var(--sa-text-tertiary)] leading-relaxed">{label}</span>
      <div className="flex flex-wrap gap-1">{values.map((v) => <Chip key={v} label={v} />)}</div>
    </div>
  );
}

function LinkRow({ label, urls }: { label: string; urls: string[] }) {
  const filtered = urls.filter(Boolean);
  if (!filtered.length) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-[11px] text-[var(--sa-text-tertiary)] leading-relaxed">{label}</span>
      <div className="flex flex-col gap-0.5">
        {filtered.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[12px] text-[var(--sa-accent)] hover:underline truncate"
          ><ExternalLink size={9} /> {url}</a>
        ))}
      </div>
    </div>
  );
}

// ── PDF generation ────────────────────────────────────────

function buildPDFHTML(s: TechpackSubmission): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const bool = (v: boolean | null) => v === true ? "Yes" : v === false ? "No" : "—";
  const chips = (arr: string[]) => arr.length ? arr.join(", ") : "—";
  const links = (arr: string[]) => arr.filter(Boolean).length
    ? arr.filter(Boolean).map((u) => `<a href="${u}" style="color:#1A1A2E">${u}</a>`).join("<br>")
    : "—";

  const row = (label: string, value: string) =>
    value && value !== "—"
      ? `<tr><td style="padding:6px 12px 6px 0;color:#6E6E73;font-size:12px;white-space:nowrap;vertical-align:top;width:180px">${label}</td><td style="padding:6px 0;font-size:12px;color:#1D1D1F">${value}</td></tr>`
      : "";

  const section = (title: string, rows: string) =>
    `<div style="margin-top:28px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#6E6E73;border-bottom:1px solid #E5E5EA;padding-bottom:6px;margin-bottom:12px">${title}</div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Tech Pack Brief — ${s.company_name}</title>
<style>
  @page { size: A4; margin: 30mm 20mm; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1D1D1F; background: #fff; -webkit-print-color-adjust: exact; }
  * { box-sizing: border-box; }
  @media print { .no-print { display: none; } }
</style>
</head><body>
<div class="no-print" style="background:#1A1A2E;color:#fff;padding:12px 20px;font-size:13px;display:flex;justify-content:space-between;align-items:center">
  <span>Tech Pack Brief — ${s.company_name}</span>
  <button onclick="window.print()" style="background:#fff;color:#1A1A2E;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Download PDF</button>
</div>

<div style="padding:40px 0 0">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1A1A2E;padding-bottom:20px;margin-bottom:8px">
    <div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#6E6E73;margin-bottom:6px">Tech Pack Brief</div>
      <div style="font-size:28px;font-weight:700;color:#1A1A2E;line-height:1.1">${s.company_name}</div>
      ${s.collection_name ? `<div style="font-size:16px;color:#6E6E73;margin-top:4px">${s.collection_name}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#6E6E73">Generated</div>
      <div style="font-size:13px;font-weight:600">${date}</div>
      <div style="font-size:11px;color:#6E6E73;margin-top:8px">Contact</div>
      <div style="font-size:13px">${s.contact_name}</div>
      <div style="font-size:12px;color:#6E6E73">${s.contact_email}</div>
      ${s.phone ? `<div style="font-size:12px;color:#6E6E73">${s.phone}</div>` : ""}
    </div>
  </div>

  ${section("Project Overview", [
    row("Category", s.product_category),
    row("Target quantity", s.target_quantity ? s.target_quantity.toLocaleString() + " units" : "—"),
    row("Launch date", s.launch_date ?? "—"),
    row("Retail price point", s.retail_price_point ?? "—"),
    row("Quality priority", s.quality_priority ?? "—"),
  ].join(""))}

  ${section("Creative Direction", [
    row("Description", s.product_description ?? "—"),
    row("Aesthetic feeling", chips(s.aesthetic_feeling)),
    row("Reference links", links(s.reference_urls)),
    row("Competitor refs", links(s.competitor_urls)),
  ].join(""))}

  ${section("Garment Construction", [
    row("Fit type", chips(s.fit_type)),
    row("Measurements", s.measurements_known === true ? "Provided" : s.measurements_known === false ? "To be defined" : "—"),
    s.measurements_notes ? row("Measurement notes", s.measurements_notes) : "",
    row("Fabric preference", chips(s.fabric_preference)),
    row("Suggest fabric", s.suggest_fabric ? "Yes — please recommend" : "No"),
    row("Fabric weight (GSM)", s.fabric_gsm ?? "—"),
  ].join(""))}

  ${section("Prints & Graphics", [
    row("Print type", chips(s.print_type)),
    row("Placement(s)", chips(s.print_placement)),
    row("Artwork links", links(s.artwork_urls)),
  ].join(""))}

  ${section("Washes & Finishes", [
    row("Wash type", chips(s.wash_type)),
    row("Desired effect", s.wash_effect ?? "—"),
  ].join(""))}

  ${section("Trims & Hardware", [
    row("Zips", s.zip_type ?? "—"),
    row("Buttons", s.button_type ?? "—"),
    row("Drawstrings", s.drawstring_type ?? "—"),
    row("Hardware finish", s.hardware_finish ?? "—"),
  ].join(""))}

  ${section("Labels & Branding", [
    row("Neck label", s.neck_label ?? "—"),
    row("Additional labels", chips(s.additional_labels)),
    row("Packaging", s.packaging ?? "—"),
  ].join(""))}

  ${section("Technical Complexity", [
    row("Custom pattern", bool(s.custom_pattern)),
    row("Multiple panels", bool(s.multiple_panels)),
    row("Special construction", bool(s.special_construction)),
    row("Custom hardware", bool(s.custom_hardware)),
  ].join(""))}

  ${section("Budget", [
    row("Sampling budget", s.sampling_budget ?? "—"),
    row("Target unit cost", s.target_unit_cost ?? "—"),
  ].join(""))}

  ${section("Client Notes", [
    row("Produced before", bool(s.produced_before)),
    row("Ready for sampling", bool(s.ready_for_sampling)),
  ].join(""))}

  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #E5E5EA;font-size:10px;color:#AEAEB2;display:flex;justify-content:space-between">
    <span>Generated by Source[Archive] · Confidential</span>
    <span>${date}</span>
  </div>
</div>
</body></html>`;
}

function handleDownload(s: TechpackSubmission) {
  const html = buildPDFHTML(s);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// ── Detail panel ────────────────────────────────────────

function TechpackDetail({
  sub: initial,
  onClose,
  onUpdate,
}: {
  sub: TechpackSubmission;
  onClose: () => void;
  onUpdate: (s: TechpackSubmission) => void;
}) {
  const [sub, setSub] = useState(initial);
  const [, startTransition] = useTransition();

  function setStatus(status: string) {
    const updated = { ...sub, status };
    setSub(updated);
    startTransition(async () => {
      await supabase.from("techpack_submissions").update({ status }).eq("id", sub.id);
      onUpdate(updated);
    });
  }

  function saveField(key: string, value: string | null) {
    const updated = { ...sub, [key]: value };
    setSub(updated as TechpackSubmission);
    startTransition(async () => {
      await supabase.from("techpack_submissions").update({ [key]: value }).eq("id", sub.id);
      onUpdate(updated as TechpackSubmission);
    });
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
          <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">{sub.company_name}</h2>
          <p className="text-[12px] text-[var(--sa-text-tertiary)] mt-0.5">{sub.product_category} · {formatDate(sub.created_at)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleDownload(sub)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
          >
            <Download size={12} /> PDF brief
          </button>
          <button onClick={onClose} className="text-[12px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)] px-2 py-1">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1">

        {/* Status */}
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(STATUS_CFG).map(([s, cfg]) => (
              <button key={s} onClick={() => setStatus(s)}
                className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                  sub.status === s
                    ? "border-[var(--sa-accent)] text-[var(--sa-accent)] bg-[var(--sa-selected)]"
                    : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                )}
              >{cfg.label}</button>
            ))}
          </div>
        </div>

        {/* Project Overview */}
        <Section title="Project Overview">
          <Row label="Category" value={sub.product_category} />
          <Row label="Collection" value={sub.collection_name} />
          <Row label="Launch date" value={sub.launch_date} />
          <Row label="Target qty" value={sub.target_quantity ? `${sub.target_quantity.toLocaleString()} units` : null} />
          <Row label="Retail price" value={sub.retail_price_point} />
        </Section>

        {/* Creative */}
        <Section title="Creative Direction">
          <Row label="Description" value={sub.product_description} />
          <ChipRow label="Aesthetic" values={sub.aesthetic_feeling} />
          <LinkRow label="References" urls={sub.reference_urls} />
          <LinkRow label="Competitors" urls={sub.competitor_urls} />
        </Section>

        {/* Construction */}
        <Section title="Construction">
          <ChipRow label="Fit" values={sub.fit_type} />
          <Row label="Measurements" value={sub.measurements_known === true ? "Provided" : sub.measurements_known === false ? "To define" : null} />
          <Row label="Notes" value={sub.measurements_notes} />
          <ChipRow label="Fabric" values={sub.fabric_preference} />
          <Row label="Suggest fabric" value={sub.suggest_fabric ? "Yes" : null} />
          <Row label="GSM" value={sub.fabric_gsm} />
        </Section>

        {/* Surface */}
        <Section title="Prints & Washes">
          <ChipRow label="Print type" values={sub.print_type} />
          <ChipRow label="Placement" values={sub.print_placement} />
          <LinkRow label="Artwork" urls={sub.artwork_urls} />
          <ChipRow label="Wash type" values={sub.wash_type} />
          <Row label="Wash effect" value={sub.wash_effect} />
        </Section>

        {/* Trims */}
        <Section title="Trims & Labels">
          <Row label="Zips" value={sub.zip_type} />
          <Row label="Buttons" value={sub.button_type} />
          <Row label="Drawstrings" value={sub.drawstring_type} />
          <Row label="Hardware" value={sub.hardware_finish} />
          <Row label="Neck label" value={sub.neck_label} />
          <ChipRow label="Extra labels" values={sub.additional_labels} />
          <Row label="Packaging" value={sub.packaging} />
        </Section>

        {/* Technical */}
        <Section title="Technical Complexity">
          <Row label="Custom pattern" value={sub.custom_pattern} />
          <Row label="Multiple panels" value={sub.multiple_panels} />
          <Row label="Special construction" value={sub.special_construction} />
          <Row label="Custom hardware" value={sub.custom_hardware} />
        </Section>

        {/* Budget */}
        <Section title="Budget">
          <Row label="Sampling" value={sub.sampling_budget} />
          <Row label="Unit cost" value={sub.target_unit_cost} />
          <Row label="Priority" value={sub.quality_priority} />
        </Section>

        {/* Client */}
        <Section title="Client">
          <Row label="Name" value={sub.contact_name} />
          <Row label="Email" value={sub.contact_email} />
          <Row label="Phone" value={sub.phone} />
          <Row label="Produced before" value={sub.produced_before === true ? "Yes" : sub.produced_before === false ? "No" : null} />
          <Row label="Ready to sample" value={sub.ready_for_sampling === true ? "Yes" : sub.ready_for_sampling === false ? "No" : null} />
        </Section>

        {/* Internal */}
        <div className="pt-4 border-t border-[var(--sa-border)] flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)]">Internal</p>
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Assigned to</p>
            <input
              type="text"
              defaultValue={sub.assigned_to ?? ""}
              placeholder="Team member…"
              onBlur={(e) => { if (e.target.value !== (sub.assigned_to ?? "")) saveField("assigned_to", e.target.value || null); }}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--sa-accent)]"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Internal notes</p>
            <textarea
              rows={3}
              defaultValue={sub.internal_notes ?? ""}
              placeholder="Notes not visible to client…"
              onBlur={(e) => { if (e.target.value !== (sub.internal_notes ?? "")) saveField("internal_notes", e.target.value || null); }}
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--sa-accent)] resize-none"
            />
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// ── Main board ────────────────────────────────────────

export function TechpacksClient({ submissions: initial }: Props) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initial);
  const [selected, setSelected] = useState<TechpackSubmission | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);
  const counts = Object.keys(STATUS_CFG).reduce((acc, s) => {
    acc[s] = submissions.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  function handleUpdate(updated: TechpackSubmission) {
    setSubmissions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setSelected(updated);
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn("flex flex-col overflow-hidden transition-all", selected ? "flex-1" : "w-full")}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Tech Packs</h1>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">{submissions.length} total · {counts.new ?? 0} new</p>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/techpack`)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
          >
            Copy form link
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 px-6 py-3 panel-border-b bg-[var(--sa-window)] overflow-x-auto">
          {ALL_STATUSES.map((s) => {
            const cfg = s === "all" ? null : STATUS_CFG[s];
            const count = s === "all" ? submissions.length : (counts[s] ?? 0);
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={cn("flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                  filter === s
                    ? "border-[var(--sa-accent)] text-[var(--sa-accent)] bg-[var(--sa-selected)]"
                    : "border-transparent text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                )}
              >
                {cfg
                  ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", cfg.cls)}>{cfg.label}</span>
                  : "All"
                }
                <span className="font-mono text-[11px] text-[var(--sa-text-tertiary)]">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_130px_120px_120px_100px] gap-3 px-5 py-2 bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
          {["Brand / Product", "Contact", "Budget", "Timeline", "Status"].map((h) => (
            <span key={h} className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{h}</span>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-[var(--sa-window)]">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--sa-text-tertiary)]">
              <p className="text-[13px]">No tech pack requests yet</p>
              <p className="text-[11px]">Share /techpack with potential clients</p>
            </div>
          ) : filtered.map((s) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setSelected(selected?.id === s.id ? null : s)}
              className={cn(
                "grid grid-cols-[1fr_130px_120px_120px_100px] gap-3 w-full items-center px-5 py-3 border-b border-[var(--sa-border)] text-left transition-colors",
                selected?.id === s.id ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
              )}
            >
              <div>
                <p className="text-[13px] font-medium text-[var(--sa-text-primary)] truncate">{s.company_name}</p>
                <p className="text-[11px] text-[var(--sa-text-tertiary)]">{s.product_category}{s.collection_name ? ` · ${s.collection_name}` : ""}</p>
              </div>
              <span className="text-[12px] text-[var(--sa-text-secondary)] truncate">{s.contact_name}</span>
              <span className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{s.sampling_budget || "—"}</span>
              <span className="text-[12px] text-[var(--sa-text-tertiary)] truncate">{s.launch_date || "—"}</span>
              <StatusPill status={s.status} />
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <div className="w-[420px] shrink-0 overflow-hidden">
            <TechpackDetail
              key={selected.id}
              sub={selected}
              onClose={() => setSelected(null)}
              onUpdate={handleUpdate}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
