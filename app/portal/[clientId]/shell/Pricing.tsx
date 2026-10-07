"use client";

import type { CompositionTier, PriceTier } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// What it costs.
//
// Two independent ways of pricing, side by side and not combined. An
// earlier version let a chosen blend shift the volume ladder, which was
// clever and wrong: it assumed the quantity discount was the same whatever
// the cloth, and quietly invented numbers nobody had quoted. Each list now
// shows only what was actually entered.
//
// This also used to be a bare table crammed into a grid cell beside
// Category and MOQ, which is the wrong weight for the thing a brand reads
// first. It has its own section now.
// ─────────────────────────────────────────────────────────────

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function whole(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <p className="text-[11px] font-medium" style={{ color: "var(--portal-text-secondary)" }}>
        {children}
      </p>
      {hint && (
        <p className="text-[10.5px]" style={{ color: "var(--portal-text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
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

  if (!hasComposition && !hasVolume && quotedPrice == null && sampleFee == null) return null;

  // The lowest figure anywhere, which is what "from" honestly means.
  const lowest = [
    ...compositionTiers.map((t) => t.unit_price_usd),
    ...volumeTiers.map((t) => t.unit_price_usd),
    ...(quotedPrice != null ? [quotedPrice] : []),
  ].reduce<number | null>((min, n) => (min == null || n < min ? n : min), null);

  return (
    <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
      <div className="mb-4 flex items-baseline gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
          Pricing
        </p>
        {lowest != null && (
          <p className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
            from {money(lowest)} a unit
          </p>
        )}
      </div>

      {/* ── By composition ── */}
      {hasComposition && (
        <div className={hasVolume ? "mb-5" : undefined}>
          <SectionLabel hint="price per unit">By composition</SectionLabel>
          <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--portal-border)" }}>
            {compositionTiers.map((tier, i) => (
              <div
                key={`${tier.label}-${i}`}
                className="flex items-center gap-3 px-3.5 py-3"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--portal-border-subtle)" }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium" style={{ color: "var(--portal-text-primary)" }}>
                    {tier.label}
                  </span>
                  {(tier.note || tier.moq != null) && (
                    <span className="block text-[11.5px] leading-snug" style={{ color: "var(--portal-text-muted)" }}>
                      {[tier.note, tier.moq != null ? `minimum ${whole(tier.moq)} units` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                <span
                  className="shrink-0 font-mono text-[14px] font-semibold"
                  style={{ color: "var(--portal-text-primary)" }}
                >
                  {money(tier.unit_price_usd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── By quantity ── */}
      {hasVolume && (
        <div>
          <SectionLabel hint="price per unit">By quantity</SectionLabel>
          <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--portal-border)" }}>
            {volumeTiers.map((tier, i) => (
              <div
                key={`${tier.moq}-${i}`}
                className="flex items-center gap-3 px-3.5 py-3"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--portal-border-subtle)" }}
              >
                <span className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--portal-text-primary)" }}>
                  {whole(tier.moq)}
                  <span style={{ color: "var(--portal-text-muted)" }}> units and up</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-[14px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
                    {money(tier.unit_price_usd)}
                  </span>
                  <span className="block font-mono text-[10.5px]" style={{ color: "var(--portal-text-muted)" }}>
                    ${whole(tier.moq * tier.unit_price_usd)} total
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── A single price, when there are no tiers at all ── */}
      {!hasComposition && !hasVolume && quotedPrice != null && (
        <div
          className="rounded-xl px-3.5 py-3"
          style={{ background: "var(--portal-surface-raised)", border: "1px solid var(--portal-border)" }}
        >
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
