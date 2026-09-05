"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Link2, Copy, Check, BookmarkPlus, Calculator } from "lucide-react";
import {
  SECTIONS, UNITS, STATUS_LABEL, money, lineCost, computeBreakdown, canSaveToLibrary,
  type CostSheet, type CostSheetLine, type CostSection, type CostUnit,
} from "@/lib/cost-sheet";
import {
  createCostSheet, updateCostSheet, upsertLine, deleteLine, getCostSheetLines,
  saveLineToFabricLibrary, shareWithFactory, revokeFactoryLink,
} from "./cost-sheet-actions";

export function CostSheetPanel({ productId, sheet: initialSheet, lines: initialLines, canEdit }: {
  productId: string;
  sheet: CostSheet | null;
  lines: CostSheetLine[];
  canEdit: boolean;
}) {
  const [sheet, setSheet] = useState(initialSheet);
  const [lines, setLines] = useState(initialLines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [factoryName, setFactoryName] = useState("");

  const totals = useMemo(
    () => (sheet ? computeBreakdown(sheet, lines) : null),
    [sheet, lines],
  );

  async function start() {
    setBusy(true); setError(null);
    const res = await createCostSheet(productId);
    if (!res.success) { setError(res.error); setBusy(false); return; }
    setSheet(res.sheet);
    // createCostSheet seeds the usual starter lines; pull them straight back
    // so the sheet is usable without a reload.
    try { setLines(await getCostSheetLines(res.sheet.id)); } catch { setLines([]); }
    setBusy(false);
  }

  async function patchSheet(patch: Partial<CostSheet>) {
    if (!sheet) return;
    setSheet({ ...sheet, ...patch });
    const res = await updateCostSheet(sheet.id, productId, patch);
    if (!res.success) setError(res.error ?? "Could not save");
  }

  async function patchLine(line: CostSheetLine, patch: Partial<CostSheetLine>) {
    const next = { ...line, ...patch };
    setLines((prev) => prev.map((l) => (l.id === line.id ? next : l)));
    const res = await upsertLine(next.sheet_id, next);
    if (!res.success) setError(res.error);
  }

  async function addLine(section: CostSection) {
    if (!sheet) return;
    const res = await upsertLine(sheet.id, {
      section,
      label: section === "trim" ? "New trim" : "New material",
      unit: section === "trim" ? "piece" : "metre",
      position: lines.filter((l) => l.section === section).length,
    });
    if (!res.success) { setError(res.error); return; }
    setLines((prev) => [...prev, res.line]);
  }

  async function removeLine(l: CostSheetLine) {
    setLines((prev) => prev.filter((x) => x.id !== l.id));
    await deleteLine(l.id);
  }

  async function toLibrary(l: CostSheetLine) {
    setError(null); setNotice(null);
    const res = await saveLineToFabricLibrary(l.id);
    if (!res.success) { setError(res.error); return; }
    setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, fabric_id: res.fabricId } : x)));
    setNotice(`Saved to the fabric library${res.code ? ` as ${res.code}` : ""}.`);
  }

  async function share() {
    if (!sheet) return;
    setBusy(true); setError(null);
    const res = await shareWithFactory(sheet.id, productId, factoryName);
    if (!res.success) { setError(res.error); setBusy(false); return; }
    setSheet({ ...sheet, share_token: res.token, status: "awaiting_factory" });
    setBusy(false);
  }

  async function revoke() {
    if (!sheet) return;
    await revokeFactoryLink(sheet.id, productId);
    setSheet({ ...sheet, share_token: null });
  }

  const shareUrl = sheet?.share_token && typeof window !== "undefined"
    ? `${window.location.origin}/cost-sheet/${sheet.share_token}`
    : "";

  const inp = "rounded-md border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1 text-[12.5px] text-[var(--sa-text-primary)] outline-none";

  if (!canEdit) return null;

  if (!sheet) {
    return (
      <div className="rounded-xl border border-[var(--sa-border)] p-4">
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-[var(--sa-text-tertiary)]" />
          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Production cost sheet</p>
        </div>
        <p className="mt-1 max-w-lg text-[12px] text-[var(--sa-text-tertiary)]">
          Break a garment down into every fabric, trim and the factory&apos;s CMT, then send it to a factory to
          fill in their own prices. It&apos;s the difference between negotiating a total and negotiating a line.
        </p>
        <button onClick={start} disabled={busy}
          className="mt-3 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">
          {busy ? "Creating…" : "Start a cost sheet"}
        </button>
        {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--sa-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Calculator size={15} className="text-[var(--sa-text-tertiary)]" />
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Production cost sheet</p>
        <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
          style={{ background: "var(--sa-hover)", color: "var(--sa-text-secondary)" }}>
          {STATUS_LABEL[sheet.status]}
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
          Run size
          <input type="number" min={1} className={`${inp} w-20 tabular-nums`} value={sheet.quantity}
            onChange={(e) => patchSheet({ quantity: parseInt(e.target.value, 10) || 1 })} />
        </label>
      </div>

      {notice && <p className="mb-2 text-[11.5px] text-emerald-600">{notice}</p>}
      {error && <p className="mb-2 text-[11.5px] text-red-500">{error}</p>}

      {SECTIONS.map((section) => {
        const rows = lines.filter((l) => l.section === section.id);
        return (
          <div key={section.id} className="mb-4">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">{section.label}</p>
              <span className="text-[11px] text-[var(--sa-text-tertiary)]">{section.hint}</span>
              <div className="flex-1" />
              <button onClick={() => addLine(section.id)}
                className="flex items-center gap-1 text-[11.5px] text-[var(--sa-accent)]">
                <Plus size={11} /> Add
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">Nothing yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {rows.map((l) => (
                  <div key={l.id} className="rounded-lg border border-[var(--sa-border)] p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input className={`${inp} min-w-[140px] flex-1 font-medium`} value={l.label}
                        onChange={(e) => patchLine(l, { label: e.target.value })} />
                      <input className={`${inp} w-28`} placeholder="Supplier" value={l.supplier ?? ""}
                        onChange={(e) => patchLine(l, { supplier: e.target.value })} />
                      <input className={`${inp} w-24`} placeholder="Item no." value={l.item_number ?? ""}
                        onChange={(e) => patchLine(l, { item_number: e.target.value })} />
                      <input className={`${inp} w-36`} placeholder="Composition" value={l.composition ?? ""}
                        onChange={(e) => patchLine(l, { composition: e.target.value })} />
                      <input type="number" step="0.01" className={`${inp} w-20 tabular-nums`} placeholder="Price"
                        value={l.unit_price ?? ""}
                        onChange={(e) => patchLine(l, { unit_price: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                      <select className={`${inp} w-20`} value={l.unit}
                        onChange={(e) => patchLine(l, { unit: e.target.value as CostUnit })}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" step="0.001" className={`${inp} w-20 tabular-nums`} placeholder="Use"
                        value={l.consumption ?? ""}
                        onChange={(e) => patchLine(l, { consumption: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                      <span className="w-20 text-right text-[12px] tabular-nums text-[var(--sa-text-primary)]">
                        {money(lineCost(l), sheet.currency)}
                      </span>
                      {canSaveToLibrary(l) && (
                        <button onClick={() => toLibrary(l)} title={l.fabric_id ? "Update in fabric library" : "Save to fabric library"}
                          className="text-[var(--sa-text-tertiary)] hover:text-[var(--sa-accent)]">
                          <BookmarkPlus size={13} />
                        </button>
                      )}
                      <button onClick={() => removeLine(l)} className="text-[var(--sa-text-tertiary)] hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Labour */}
      <div className="mb-4">
        <p className="mb-1.5 text-[12px] font-semibold text-[var(--sa-text-primary)]">Labour (CMT)</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="number" step="0.01" className={`${inp} w-28 tabular-nums`} placeholder="CMT / garment"
            value={sheet.labor_cmt ?? ""}
            onChange={(e) => patchSheet({ labor_cmt: e.target.value === "" ? null : parseFloat(e.target.value) })} />
          <input className={`${inp} min-w-[200px] flex-1`} placeholder="Factory notes" value={sheet.labor_notes ?? ""}
            onChange={(e) => patchSheet({ labor_notes: e.target.value })} />
        </div>
      </div>

      {/* After the factory gate */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([
          ["freight_per_unit", "Freight / unit"],
          ["duty_pct", "Duty %"],
          ["overhead_pct", "Overhead %"],
          ["target_margin_pct", "Target margin %"],
        ] as const).map(([field, label]) => (
          <label key={field} className="flex items-center gap-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
            {label}
            <input type="number" step="0.01" className={`${inp} w-20 tabular-nums`}
              value={(sheet[field] as number | null) ?? ""}
              onChange={(e) => patchSheet({ [field]: e.target.value === "" ? null : parseFloat(e.target.value) } as Partial<CostSheet>)} />
          </label>
        ))}
      </div>

      {/* Totals */}
      {totals && (
        <div className="rounded-lg p-3" style={{ background: "var(--sa-hover)" }}>
          {([
            ["Shell", totals.shell], ["Lining", totals.lining], ["Trims", totals.trim], ["Other", totals.other],
          ] as const).filter(([, v]) => v > 0).map(([label, v]) => (
            <Row key={label} label={label} value={money(v, sheet.currency)} muted />
          ))}
          <Row label="Materials" value={money(totals.materials, sheet.currency)} />
          <Row label="CMT" value={money(totals.labor, sheet.currency)} />
          <Row label="Ex-factory per garment" value={money(totals.exFactory, sheet.currency)} strong />
          {(totals.freight > 0 || totals.duty > 0 || totals.overhead > 0) && (
            <>
              {totals.freight > 0 && <Row label="Freight" value={money(totals.freight, sheet.currency)} muted />}
              {totals.duty > 0 && <Row label="Duty" value={money(totals.duty, sheet.currency)} muted />}
              {totals.overhead > 0 && <Row label="Overhead" value={money(totals.overhead, sheet.currency)} muted />}
              <Row label="Landed per garment" value={money(totals.landed, sheet.currency)} strong />
            </>
          )}
          <Row label={`Run of ${sheet.quantity}`} value={money(totals.runTotal, sheet.currency)} strong />
          {totals.suggestedRetail != null && (
            <Row label={`Retail at ${sheet.target_margin_pct}% margin`} value={money(totals.suggestedRetail, sheet.currency)} />
          )}
          {totals.incomplete > 0 && (
            <p className="mt-2 text-[11.5px] text-amber-600">
              {totals.incomplete} line{totals.incomplete === 1 ? "" : "s"} still missing a price or consumption — this total is low.
            </p>
          )}
        </div>
      )}

      {/* Factory link */}
      <div className="mt-4 border-t border-[var(--sa-border)] pt-3">
        <p className="mb-1.5 text-[12px] font-semibold text-[var(--sa-text-primary)]">Send to a factory</p>
        {!sheet.share_token ? (
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inp} min-w-[180px] flex-1`} placeholder="Factory name (optional)"
              value={factoryName} onChange={(e) => setFactoryName(e.target.value)} />
            <button onClick={share} disabled={busy}
              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50">
              <Link2 size={13} /> Create link
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className={`${inp} min-w-[200px] flex-1`} />
            <button
              onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white">
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
            <button onClick={revoke} className="text-[11.5px] text-[var(--sa-text-tertiary)] hover:text-red-500">Revoke</button>
          </div>
        )}
        <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
          The factory fills in prices, supplier and composition. They never see your margin, freight or the client.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className={`text-[12px] ${muted ? "text-[var(--sa-text-tertiary)]" : "text-[var(--sa-text-secondary)]"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-[13.5px] font-semibold" : "text-[12.5px]"} text-[var(--sa-text-primary)]`}>{value}</span>
    </div>
  );
}
