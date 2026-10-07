"use client";

import { useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { SAMPLE_TRIGGERS, BULK_TRIGGERS } from "@/lib/rfq-sheet";

// ─────────────────────────────────────────────────────────────
// The terms of the enquiry, before the sheet is generated.
//
// Lead times live here rather than on the project because they belong to
// this enquiry: the same styles asked about in November carry different
// dates from the same styles asked about in March. Each sheet records what
// it asked, which is what makes two quotes comparable.
// ─────────────────────────────────────────────────────────────

const INPUT =
  "rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">{children}</p>;
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function RfqSheetDialog({
  projectId, projectName, styleCount, onClose,
}: {
  projectId: string; projectName: string; styleCount: number; onClose: () => void;
}) {
  const [rfqNo, setRfqNo] = useState(`RFQ-${projectName.replace(/[^\w]+/g, "-").slice(0, 18).toUpperCase()}`);
  const [enquiryDate, setEnquiryDate] = useState(today());
  const [validUntil, setValidUntil] = useState(inDays(30));
  const [sampleDays, setSampleDays] = useState("14");
  const [sampleTrigger, setSampleTrigger] = useState<string>(SAMPLE_TRIGGERS[0]);
  const [bulkDays, setBulkDays] = useState("45");
  const [bulkTrigger, setBulkTrigger] = useState<string>(BULK_TRIGGERS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/rfq-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfqNo, enquiryDate, validUntil,
          sampleLeadTimeDays: sampleDays ? Number(sampleDays) : null, sampleTrigger,
          bulkLeadTimeDays: bulkDays ? Number(bulkDays) : null, bulkTrigger,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try { message = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* plain text body */ }
        setError(message || "Could not generate the sheet");
        setBusy(false);
        return;
      }

      // Hand the file over without leaving the page.
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${rfqNo}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-[var(--sa-window)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--sa-border)] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Generate RFQ sheet</p>
            <p className="truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
              {styleCount} style{styleCount === 1 ? "" : "s"} in {projectName}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Field label="RFQ number">
            <input value={rfqNo} onChange={(e) => setRfqNo(e.target.value)} className={`${INPUT} w-full`} />
            <Hint>The version is added automatically — generate again and it becomes v2.</Hint>
          </Field>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Enquiry date">
              <input type="date" value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} className={`${INPUT} w-full`} />
            </Field>
            <Field label="Quote valid until">
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={`${INPUT} w-full`} />
            </Field>
          </div>

          <div className="mt-4 border-t border-[var(--sa-border)] pt-3">
            <Field label="Sample lead time">
              <div className="flex gap-2">
                <input type="number" min={0} value={sampleDays} onChange={(e) => setSampleDays(e.target.value)} className={`${INPUT} w-24`} />
                <select value={sampleTrigger} onChange={(e) => setSampleTrigger(e.target.value)} className={`${INPUT} min-w-0 flex-1`}>
                  {SAMPLE_TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Hint>Days, counted from the point you pick. The factory can change it on the sheet.</Hint>
            </Field>

            <div className="mt-3">
              <Field label="Bulk lead time">
                <div className="flex gap-2">
                  <input type="number" min={0} value={bulkDays} onChange={(e) => setBulkDays(e.target.value)} className={`${INPUT} w-24`} />
                  <select value={bulkTrigger} onChange={(e) => setBulkTrigger(e.target.value)} className={`${INPUT} min-w-0 flex-1`}>
                    {BULK_TRIGGERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </Field>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-[var(--sa-bg)] px-3 py-2.5 text-[11.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
            Pattern fee, sample cost and bulk FOB are left blank and shaded for the factory. Headers are
            Chinese over English, style photos are embedded, and nothing is locked — they fill it in and send
            it back. Every sheet is archived so you can compare what came back.
          </p>

          {error && <p className="mt-2 text-[12px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--sa-border)] px-5 py-3">
          <button onClick={onClose}
            className="rounded-md px-3 py-2 text-[12.5px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]">
            Cancel
          </button>
          <button onClick={generate} disabled={busy || !rfqNo.trim()}
            className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-50">
            <FileSpreadsheet size={12} /> {busy ? "Building…" : "Generate and download"}
          </button>
        </div>
      </div>
    </div>
  );
}
