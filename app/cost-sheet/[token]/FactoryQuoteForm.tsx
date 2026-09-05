"use client";

import { useMemo, useState } from "react";
import { Check, Send } from "lucide-react";
import {
  SECTIONS, money, lineCost,
  type FactorySheetView, type CostSheetLine,
} from "@/lib/cost-sheet";
import { submitFactoryQuote } from "@/app/(app)/products/[id]/cost-sheet-actions";

export function FactoryQuoteForm({ token, sheet, lines: initial, productName }: {
  token: string;
  sheet: FactorySheetView;
  lines: CostSheetLine[];
  productName: string;
}) {
  const [lines, setLines] = useState(initial);
  const [labor, setLabor] = useState<string>(sheet.labor_cmt != null ? String(sheet.labor_cmt) : "");
  const [laborNotes, setLaborNotes] = useState(sheet.labor_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, field: keyof CostSheetLine, value: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, [field]: field === "unit_price" ? (value === "" ? null : parseFloat(value)) : value || null }
          : l,
      ),
    );
  }

  // What the factory is quoting: materials plus their own CMT. Nothing after
  // the factory gate belongs on this page.
  const total = useMemo(() => {
    const materials = lines.reduce((sum, l) => sum + lineCost(l), 0);
    const cmt = parseFloat(labor) || 0;
    return { materials, cmt, exFactory: materials + cmt };
  }, [lines, labor]);

  async function submit() {
    setBusy(true); setError(null);
    const res = await submitFactoryQuote(token, {
      lines: lines.map((l) => ({
        id: l.id,
        unit_price: l.unit_price,
        supplier: l.supplier,
        item_number: l.item_number,
        composition: l.composition,
        notes: l.notes,
      })),
      labor_cmt: labor === "" ? null : parseFloat(labor),
      labor_notes: laborNotes || null,
    });
    if (!res.success) { setError(res.error ?? "Could not send"); setBusy(false); return; }
    setSent(true);
    setBusy(false);
  }

  const inp = "w-full rounded-md px-2 py-1.5 text-[13px] outline-none";
  const inpStyle = { background: "var(--fill)", color: "var(--label)", boxShadow: "inset 0 0 0 .5px var(--sep)" };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--canvas)" }}>
        <div className="mac-card max-w-sm p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(31,122,76,.14)" }}>
            <Check size={18} style={{ color: "var(--green)" }} />
          </div>
          <h1 className="text-[16px] font-semibold tight" style={{ color: "var(--label)" }}>Quote sent</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--label-2)" }}>
            Thank you. Your prices for {productName} have been received.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "var(--canvas)", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4">
          <h1 className="text-[19px] font-semibold tight" style={{ color: "var(--label)" }}>{productName}</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--label-2)" }}>
            Cost breakdown{sheet.factory_name ? ` for ${sheet.factory_name}` : ""} · run of {sheet.quantity} units
          </p>
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--label-3)" }}>
            Please fill in your price for each line, plus your CMT. Prices are per unit shown, in {sheet.currency}.
          </p>
        </div>

        {SECTIONS.map((section) => {
          const rows = lines.filter((l) => l.section === section.id);
          if (rows.length === 0) return null;
          return (
            <section key={section.id} className="mac-card mb-3 p-4">
              <p className="text-[13px] font-semibold tight" style={{ color: "var(--label)" }}>{section.label}</p>
              <p className="mb-3 text-[11.5px]" style={{ color: "var(--label-3)" }}>{section.hint}</p>

              <div className="flex flex-col gap-3">
                {rows.map((l) => (
                  <div key={l.id} className="rounded-lg p-3" style={{ boxShadow: "inset 0 0 0 .5px var(--sep)" }}>
                    <p className="mb-2 text-[12.5px] font-medium" style={{ color: "var(--label)" }}>
                      {l.label}
                      {l.consumption != null && (
                        <span className="ml-1.5 tnum font-normal" style={{ color: "var(--label-3)" }}>
                          · {l.consumption} {l.unit} per garment
                        </span>
                      )}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <label className="sm:col-span-1">
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--label-3)" }}>Price / {l.unit}</span>
                        <input type="number" step="0.01" min="0" className={`${inp} tnum`} style={inpStyle}
                          value={l.unit_price ?? ""} onChange={(e) => patch(l.id, "unit_price", e.target.value)} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--label-3)" }}>Supplier</span>
                        <input className={inp} style={inpStyle} value={l.supplier ?? ""} onChange={(e) => patch(l.id, "supplier", e.target.value)} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--label-3)" }}>Item number</span>
                        <input className={inp} style={inpStyle} value={l.item_number ?? ""} onChange={(e) => patch(l.id, "item_number", e.target.value)} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px]" style={{ color: "var(--label-3)" }}>Composition</span>
                        <input className={inp} style={inpStyle} placeholder="e.g. 100% cotton"
                          value={l.composition ?? ""} onChange={(e) => patch(l.id, "composition", e.target.value)} />
                      </label>
                    </div>
                    {l.unit_price != null && l.consumption != null && (
                      <p className="mt-1.5 tnum text-[11.5px]" style={{ color: "var(--label-2)" }}>
                        = {money(lineCost(l), sheet.currency)} per garment
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section className="mac-card mb-3 p-4">
          <p className="text-[13px] font-semibold tight" style={{ color: "var(--label)" }}>Labour (CMT)</p>
          <p className="mb-3 text-[11.5px]" style={{ color: "var(--label-3)" }}>Your cut, make and trim charge per garment.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-[11px]" style={{ color: "var(--label-3)" }}>CMT per garment</span>
              <input type="number" step="0.01" min="0" className={`${inp} tnum`} style={inpStyle}
                value={labor} onChange={(e) => setLabor(e.target.value)} />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-[11px]" style={{ color: "var(--label-3)" }}>Notes</span>
              <input className={inp} style={inpStyle} placeholder="Lead time, minimums, anything we should know"
                value={laborNotes} onChange={(e) => setLaborNotes(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="mac-card mb-4 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px]" style={{ color: "var(--label-2)" }}>Materials per garment</span>
            <span className="tnum text-[13px]" style={{ color: "var(--label)" }}>{money(total.materials, sheet.currency)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[12.5px]" style={{ color: "var(--label-2)" }}>CMT</span>
            <span className="tnum text-[13px]" style={{ color: "var(--label)" }}>{money(total.cmt, sheet.currency)}</span>
          </div>
          <div className="my-2" style={{ height: ".5px", background: "var(--sep)" }} />
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold" style={{ color: "var(--label)" }}>Your price per garment</span>
            <span className="tnum text-[17px] font-semibold tighter" style={{ color: "var(--label)" }}>
              {money(total.exFactory, sheet.currency)}
            </span>
          </div>
          <p className="mt-1 tnum text-[11.5px]" style={{ color: "var(--label-3)" }}>
            × {sheet.quantity} units = {money(total.exFactory * sheet.quantity, sheet.currency)}
          </p>
        </section>

        {error && <p className="mb-3 text-[12.5px]" style={{ color: "var(--amber)" }}>{error}</p>}

        <button onClick={submit} disabled={busy} className="mac-button mac-button-primary flex items-center gap-1.5 disabled:opacity-50">
          <Send size={14} strokeWidth={1.6} /> {busy ? "Sending…" : "Send quote"}
        </button>
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--label-3)" }}>
          You can reopen this link and change your figures until we mark the sheet final.
        </p>
      </div>
    </div>
  );
}
