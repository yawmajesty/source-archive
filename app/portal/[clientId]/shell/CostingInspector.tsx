"use client";

import { useState } from "react";
import { RailSection } from "./PortalShell";
import type { PortalProduct } from "../page";

// ─────────────────────────────────────────────────────────────
// Live costing inspector.
//
// Costing as a persistent inspector rather than a buried tab is the
// difference between a brand checking margin once and checking it every time
// they change a spec.
//
// quoted_cost_usd is the client sell price — what the brand pays us — not our
// supplier cost. So from the brand's side it is their unit cost, and the
// retail price is theirs to set. Retail is editable inline and drives the
// margin line; nothing here is persisted, it is a sandbox.
// ─────────────────────────────────────────────────────────────

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function Figure({ label, value, tone }: { label: string; value: string; tone?: "amber" | "green" }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[12px]" style={{ color: "var(--label-2)" }}>{label}</span>
      <span
        className="tnum text-[13px] font-medium tighter"
        style={{ color: tone === "amber" ? "var(--amber)" : tone === "green" ? "var(--green)" : "var(--label)" }}
      >
        {value}
      </span>
    </div>
  );
}

function NumberField({ label, value, onChange, prefix }: {
  label: string; value: number; onChange: (n: number) => void; prefix?: string;
}) {
  return (
    <label className="flex items-center justify-between py-1">
      <span className="text-[12px]" style={{ color: "var(--label-2)" }}>{label}</span>
      <span className="flex items-center gap-1">
        {prefix && <span className="text-[12px]" style={{ color: "var(--label-3)" }}>{prefix}</span>}
        <input
          type="number"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="tnum w-[76px] rounded-[6px] px-1.5 py-0.5 text-right text-[13px] outline-none"
          style={{ background: "var(--fill)", color: "var(--label)", boxShadow: "inset 0 0 0 .5px var(--sep)" }}
        />
      </span>
    </label>
  );
}

export function CostingInspector({ product }: { product: PortalProduct }) {
  const unitCost = product.quoted_cost_usd ?? 0;
  const [qty, setQty] = useState<number>(product.order_qty ?? product.moq ?? 100);
  // No retail is stored for portal products, so seed a conventional 2.5x
  // keystone and let them tune it.
  const [retail, setRetail] = useState<number>(Math.round(unitCost * 2.5 * 100) / 100);

  const spend = unitCost * qty;
  const revenue = retail * qty;
  const profit = revenue - spend;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const markup = spend > 0 ? (profit / spend) * 100 : 0;

  const marginTone = margin >= 50 ? "green" : margin < 30 ? "amber" : undefined;

  return (
    <>
      <RailSection title="Costing">
        {unitCost === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--label-3)" }}>
            No unit cost quoted yet. Figures appear once we've quoted this product.
          </p>
        ) : (
          <div className="mac-card p-3">
            <Figure label="Unit cost" value={money(unitCost)} />
            <NumberField label="Retail price" value={retail} onChange={setRetail} prefix="$" />
            <NumberField label="Quantity" value={qty} onChange={setQty} />

            <div className="my-2" style={{ height: ".5px", background: "var(--sep)" }} />

            <Figure label="Margin" value={`${margin.toFixed(1)}%`} tone={marginTone} />
            <Figure label="Markup" value={`${markup.toFixed(0)}%`} />
            <Figure label="Total spend" value={money(spend)} />
            <Figure label="Projected revenue" value={money(revenue)} />
            <Figure label="Profit" value={money(profit)} tone={profit > 0 ? "green" : "amber"} />

            {product.moq && qty < product.moq && (
              <p className="mt-2 text-[11px]" style={{ color: "var(--amber)" }}>
                We can sample at any quantity, but bulk starts at {product.moq}.
              </p>
            )}
          </div>
        )}
      </RailSection>

      {product.price_tiers?.length > 0 && (
        <RailSection title="Price breaks">
          <div className="flex flex-col gap-1">
            {product.price_tiers.map((t) => (
              <button
                key={t.moq}
                onClick={() => setQty(t.moq)}
                className="flex items-center justify-between rounded-[6px] px-2 py-1 text-left transition-colors"
                style={{ background: qty === t.moq ? "var(--fill)" : "transparent" }}
              >
                <span className="tnum text-[12px]" style={{ color: "var(--label-2)" }}>{t.moq} units</span>
                <span className="tnum text-[12.5px] font-medium" style={{ color: "var(--label)" }}>{money(t.unit_price_usd)}</span>
              </button>
            ))}
          </div>
        </RailSection>
      )}
    </>
  );
}

export function SampleTimeline({ product }: { product: PortalProduct }) {
  const rounds = Array.from({ length: Math.max(product.sample_round, 1) }, (_, i) => i + 1);
  return (
    <RailSection title="Sample rounds">
      <div className="flex flex-col gap-1.5">
        {rounds.map((r) => {
          const current = r === product.sample_round;
          return (
            <div key={r} className="flex items-center gap-2">
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: current ? "var(--accent)" : "var(--fill)",
                  color: current ? "#fff" : "var(--label-2)",
                }}
              >
                {r}
              </span>
              <span className="text-[12px]" style={{ color: current ? "var(--label)" : "var(--label-2)" }}>
                {current ? `Round ${r} · in review` : `Round ${r} · complete`}
              </span>
            </div>
          );
        })}
        {product.expected_sample_date && (
          <p className="mt-1 tnum text-[11.5px]" style={{ color: "var(--label-3)" }}>
            Next sample expected {new Date(product.expected_sample_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </p>
        )}
      </div>
    </RailSection>
  );
}
