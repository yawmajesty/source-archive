"use client";

import { useState } from "react";
import type { CompositionTier, PriceTier } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// What it costs.
//
// This used to be a bare table crammed into a grid cell next to Category
// and MOQ, which is the wrong weight for the thing a brand reads first.
//
// Two ways of pricing, shown differently on purpose:
//
//   Composition is a choice. Cashmere against a 50/50 is a decision about
//   the product, so each blend is a row you can pick, and picking one
//   carries through to the volume table underneath — which answers "what
//   does the one I want cost at my quantity", the actual question.
//
//   Volume is a consequence. Once the cloth is settled, quantity only moves
//   the number, so it reads as a ladder with the saving named rather than
//   left for the reader to work out.
// ─────────────────────────────────────────────────────────────

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function whole(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function PricingPanel({
  compositionTiers,
  volumeTiers,
  quotedPrice,
  sampleFee,
  moq,
}: {
  compositionTiers: CompositionTier[];
  volumeTiers: PriceTier[];
  quotedPrice: number | null;
  sampleFee: number | null;
  moq: number | null;
}) {
  const hasComposition = compositionTiers.length > 0;
  const hasVolume = volumeTiers.length > 0;

  // The cheapest blend is the sensible default — it is the one a brand
  // prices against before deciding to trade up.
  const [selected, setSelected] = useState(() => {
    if (!hasComposition) return 0;
    let cheapest = 0;
    compositionTiers.forEach((t, i) => {
      if (t.unit_price_usd < compositionTiers[cheapest].unit_price_usd) cheapest = i;
    });
    return cheapest;
  });

  if (!hasComposition && !hasVolume && quotedPrice == null && sampleFee == null) return null;

  const chosen = hasComposition ? compositionTiers[selected] : null;
  const base = chosen?.unit_price_usd ?? quotedPrice ?? null;

  // Volume tiers are quoted against the base cloth. When a dearer blend is
  // picked, the ladder shifts by the difference rather than being reinvented
  // — which is how a factory quotes it, and it keeps the two consistent.
  const cheapestComposition = hasComposition
    ? Math.min(...compositionTiers.map((t) => t.unit_price_usd))
    : null;
  const uplift =
    chosen && cheapestComposition != null ? chosen.unit_price_usd - cheapestComposition : 0;

  const dearest = hasVolume ? Math.max(...volumeTiers.map((t) => t.unit_price_usd)) : null;

  return (
    <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
      <div className="mb-4 flex items-baseline gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
          Pricing
        </p>
        {base != null && (
          <p className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
            from {money(base)} a unit
          </p>
        )}
      </div>

      {/* ── Choose the cloth ── */}
      {hasComposition && (
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-medium" style={{ color: "var(--portal-text-secondary)" }}>
            Composition
          </p>
          <div className="flex flex-col gap-1.5">
            {compositionTiers.map((tier, i) => {
              const active = i === selected;
              const premium = cheapestComposition != null ? tier.unit_price_usd - cheapestComposition : 0;
              return (
                <button
                  key={`${tier.label}-${i}`}
                  onClick={() => setSelected(i)}
                  aria-pressed={active}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all"
                  style={{
                    background: active ? "var(--portal-surface-raised)" : "transparent",
                    border: active ? "1.5px solid var(--portal-brand)" : "1px solid var(--portal-border)",
                  }}
                >
                  <span
                    className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
                    style={{
                      border: active ? "4.5px solid var(--portal-brand)" : "1.5px solid var(--portal-border)",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium" style={{ color: "var(--portal-text-primary)" }}>
                      {tier.label}
                    </span>
                    {tier.note && (
                      <span className="block text-[11.5px] leading-snug" style={{ color: "var(--portal-text-muted)" }}>
                        {tier.note}
                      </span>
                    )}
                    {tier.moq != null && (
                      <span className="block text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
                        Minimum {whole(tier.moq)} units
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[14px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
                      {money(tier.unit_price_usd)}
                    </span>
                    {premium > 0 && (
                      <span className="block text-[10.5px]" style={{ color: "var(--portal-text-muted)" }}>
                        +{money(premium)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Then the quantity ── */}
      {hasVolume && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium" style={{ color: "var(--portal-text-secondary)" }}>
              By quantity
            </p>
            {hasComposition && (
              <p className="text-[10.5px]" style={{ color: "var(--portal-text-muted)" }}>
                {chosen?.label}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--portal-border)" }}>
            {volumeTiers.map((tier, i) => {
              const unit = tier.unit_price_usd + uplift;
              const saving = dearest != null ? dearest + uplift - unit : 0;
              const best = i === volumeTiers.length - 1 && volumeTiers.length > 1;
              return (
                <div
                  key={`${tier.moq}-${i}`}
                  className="flex items-center gap-3 px-3.5 py-3"
                  style={{
                    borderTop: i === 0 ? undefined : "1px solid var(--portal-border-subtle)",
                    background: best ? "var(--portal-surface-raised)" : undefined,
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]" style={{ color: "var(--portal-text-primary)" }}>
                      {whole(tier.moq)}
                      <span style={{ color: "var(--portal-text-muted)" }}> units and up</span>
                    </span>
                    {saving > 0 && (
                      <span className="block text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
                        {money(saving)} less a unit than the smallest run
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[14px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
                      {money(unit)}
                    </span>
                    <span className="block font-mono text-[10.5px]" style={{ color: "var(--portal-text-muted)" }}>
                      ${whole(tier.moq * unit)} total
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {hasComposition && uplift > 0 && (
            <p className="mt-1.5 text-[10.5px] leading-snug" style={{ color: "var(--portal-text-muted)" }}>
              Includes the {money(uplift)} difference for {chosen?.label.toLowerCase()}.
            </p>
          )}
        </div>
      )}

      {/* ── A single price, when there are no tiers at all ── */}
      {!hasComposition && !hasVolume && quotedPrice != null && (
        <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--portal-surface-raised)", border: "1px solid var(--portal-border)" }}>
          <p className="text-[10px]" style={{ color: "var(--portal-text-muted)" }}>Unit price</p>
          <p className="font-mono text-[18px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
            {money(quotedPrice)}
          </p>
          {moq != null && (
            <p className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
              Minimum {whole(moq)} units
            </p>
          )}
        </div>
      )}

      {sampleFee != null && (
        <div
          className="mt-3 flex items-center justify-between rounded-xl px-3.5 py-3"
          style={{ background: "var(--portal-surface-raised)", border: "1px solid var(--portal-border)" }}
        >
          <span className="text-[12.5px]" style={{ color: "var(--portal-text-secondary)" }}>
            Sample cost
          </span>
          <span className="font-mono text-[15px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
            {money(sampleFee)}
          </span>
        </div>
      )}
    </div>
  );
}
