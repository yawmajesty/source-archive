"use client";

// ─────────────────────────────────────────────────────────────
// The pricing calculator itself, with no idea where its data lives.
//
// Used twice: inside a brand workspace, where every change is written to
// Supabase, and on the public /price page, where it is kept in the
// browser and never leaves. Keeping one component means the free tool
// and the paid one can't drift apart.
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { Plus, Trash2, TriangleAlert, Info } from "lucide-react";
import {
  buildCost, recommend, priceOutcome, breakEvenUnits, lineCost, newLine,
  money, percent, marginVerdict,
  PRICING_CURRENCIES, LINE_SECTIONS, LINE_UNITS,
  COST_FIELDS, LANDING_FIELDS, DEVELOPMENT_FIELDS, SELLING_FIELDS,
  type PricingInputs, type PricingLine, type LineSection,
} from "@/lib/pricing";

export interface PriceBuilderValue extends PricingInputs {
  name: string;
  notes: string | null;
  chosen_price: number | null;
}

const CARD = "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]";
const INPUT =
  "w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] tabular-nums text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";
const LABEL = "text-[11px] font-medium text-[var(--sa-text-secondary)]";

export function PriceBuilder({
  value,
  onChange,
}: {
  value: PriceBuilderValue;
  onChange: (patch: Partial<PriceBuilderValue>) => void;
}) {
  const [testPrice, setTestPrice] = useState("");

  const cost = useMemo(() => buildCost(value), [value]);
  const rec = useMemo(() => recommend(value, cost), [value, cost]);

  const effectivePrice =
    testPrice !== "" ? Number(testPrice) : value.chosen_price ?? rec.direct ?? null;
  const outcome = useMemo(
    () =>
      effectivePrice != null && Number.isFinite(effectivePrice)
        ? priceOutcome(effectivePrice, value, cost)
        : null,
    [value, cost, effectivePrice],
  );

  const cur = value.currency;
  const lines = value.lines ?? [];
  const fixed = (value.sampling ?? 0) + (value.tooling ?? 0);
  const breakEven = outcome && fixed > 0 ? breakEvenUnits(outcome, fixed) : null;
  const verdict = marginVerdict(outcome?.marginPct ?? null);

  // ── Line editing ──
  function addLine(section: LineSection) {
    onChange({ lines: [...lines, newLine(section)] });
  }
  function patchLine(id: string, patch: Partial<PricingLine>) {
    onChange({ lines: lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  }
  function removeLine(id: string) {
    onChange({ lines: lines.filter((l) => l.id !== id) });
  }

  function field(key: keyof PricingInputs, suffix?: string) {
    const v = value[key] as number | null;
    return (
      <div className="relative">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          className={INPUT}
          value={v ?? ""}
          placeholder="0"
          onChange={(e) =>
            onChange({ [key]: e.target.value === "" ? null : Number(e.target.value) } as Partial<PriceBuilderValue>)
          }
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--sa-text-tertiary)]">
            {suffix}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* ── Inputs ───────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4 lg:max-w-md lg:shrink-0">
        <div className={`${CARD} p-4`}>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              placeholder="Style name"
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
            <select
              className={`${INPUT} w-24`}
              aria-label="Currency"
              value={value.currency}
              onChange={(e) => onChange({ currency: e.target.value })}
            >
              {PRICING_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className={LABEL}>Units in the run</span>
            <input
              type="number"
              min={1}
              className={`${INPUT} w-28`}
              value={value.quantity}
              onChange={(e) => onChange({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
          </label>
        </div>

        {/* Bill of materials */}
        {LINE_SECTIONS.map((section) => {
          const rows = lines.filter((l) => l.section === section.id);
          const total = rows.reduce((s, l) => s + lineCost(l), 0);
          return (
            <div key={section.id} className={`${CARD} p-4`}>
              <div className="flex items-baseline gap-2">
                <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">{section.label}</p>
                <div className="flex-1" />
                {total > 0 && (
                  <span className="text-[12px] tabular-nums text-[var(--sa-text-secondary)]">
                    {money(total, cur)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">{section.hint}</p>

              <div className="mt-2.5 flex flex-col gap-2">
                {rows.map((l) => (
                  <div key={l.id} className="rounded-lg border border-[var(--sa-border)] p-2">
                    <div className="flex gap-1.5">
                      <input
                        className={`${INPUT} min-w-0 flex-1`}
                        placeholder={section.id === "fabric" ? "e.g. Shell — cotton twill" : "e.g. Main zip"}
                        value={l.label}
                        onChange={(e) => patchLine(l.id, { label: e.target.value })}
                      />
                      <button
                        aria-label="Remove line"
                        onClick={() => removeLine(l.id)}
                        className="shrink-0 px-1 text-[var(--sa-text-tertiary)] hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <input
                      className={`${INPUT} mt-1.5`}
                      placeholder="Supplier (optional)"
                      value={l.supplier ?? ""}
                      onChange={(e) => patchLine(l.id, { supplier: e.target.value || null })}
                    />
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="number" step="0.01" inputMode="decimal"
                        className={`${INPUT} w-20`}
                        placeholder="Price"
                        value={l.unitPrice ?? ""}
                        onChange={(e) =>
                          patchLine(l.id, { unitPrice: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                      <span className="text-[11px] text-[var(--sa-text-tertiary)]">per</span>
                      <select
                        className={`${INPUT} w-[86px]`}
                        aria-label="Unit"
                        value={l.unit}
                        onChange={(e) => patchLine(l.id, { unit: e.target.value })}
                      >
                        {LINE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <span className="text-[11px] text-[var(--sa-text-tertiary)]">×</span>
                      <input
                        type="number" step="0.001" inputMode="decimal"
                        className={`${INPUT} w-[68px]`}
                        placeholder="Qty"
                        value={l.consumption ?? ""}
                        onChange={(e) =>
                          patchLine(l.id, { consumption: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                      <span className="flex-1 text-right text-[12.5px] font-medium tabular-nums text-[var(--sa-text-primary)]">
                        {money(lineCost(l), cur)}
                      </span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => addLine(section.id)}
                  className="flex items-center gap-1.5 self-start text-[12px] font-medium text-[var(--sa-accent)]"
                >
                  <Plus size={12} /> Add {section.id === "fabric" ? "a fabric" : section.id === "trim" ? "a trim" : "a line"}
                </button>
              </div>
            </div>
          );
        })}

        <Section title="Making it">
          {COST_FIELDS.map((f) => (
            <Row key={f.key} label={f.label} hint={f.hint}>{field(f.key)}</Row>
          ))}
        </Section>

        <Section title="Getting it to you">
          {LANDING_FIELDS.map((f) => (
            <Row key={f.key} label={f.label} hint={f.hint}>{field(f.key, f.suffix)}</Row>
          ))}
        </Section>

        <Section
          title="One-off costs"
          note={`Spread across all ${value.quantity} units — ${money(cost.developmentPerUnit, cur)} each.`}
        >
          {DEVELOPMENT_FIELDS.map((f) => (
            <Row key={f.key} label={f.label} hint={f.hint}>{field(f.key)}</Row>
          ))}
        </Section>

        <Section
          title="What selling it costs"
          note="The lines that quietly eat a margin. Leave them and the calculator will flatter you."
        >
          {SELLING_FIELDS.map((f) => (
            <Row key={f.key} label={f.label} hint={f.hint}>{field(f.key, f.suffix)}</Row>
          ))}
        </Section>

        <Section title="How you want to price">
          <Row label="Target margin" hint="What you want to keep on a direct sale">
            {field("targetMarginPct", "%")}
          </Row>
          <Row label="Wholesale multiple" hint="Times your true cost. 2× is the usual floor">
            {field("wholesaleMultiple", "×")}
          </Row>
          <Row label="Retail multiple" hint="What a stockist marks your wholesale up by">
            {field("retailMultiple", "×")}
          </Row>
        </Section>
      </div>

      {/* ── Results ──────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className={`${CARD} p-4`}>
          <p className="mb-2.5 text-[12px] font-semibold text-[var(--sa-text-primary)]">
            What it really costs you
          </p>
          {cost.fabric > 0 && <Line label="Fabrics" value={money(cost.fabric, cur)} muted />}
          {cost.trim > 0 && <Line label="Trims" value={money(cost.trim, cur)} muted />}
          {cost.otherLines > 0 && <Line label="Finishing" value={money(cost.otherLines, cur)} muted />}
          {(value.labour ?? 0) > 0 && <Line label="Cut, make & trim" value={money(value.labour!, cur)} muted />}
          {(value.packaging ?? 0) > 0 && <Line label="Packaging" value={money(value.packaging!, cur)} muted />}
          <Line label="Ex-factory" value={money(cost.exFactory, cur)} />
          {cost.duty > 0 && <Line label="Duty" value={money(cost.duty, cur)} muted />}
          {(value.freight ?? 0) > 0 && <Line label="Freight" value={money(value.freight!, cur)} muted />}
          <Line label="Landed" value={money(cost.landed, cur)} />
          {cost.developmentPerUnit > 0 && (
            <Line label="Development, per unit" value={money(cost.developmentPerUnit, cur)} muted />
          )}
          <div className="mt-1.5 border-t border-[var(--sa-border)] pt-1.5">
            <Line label="True cost per garment" value={money(cost.trueCost, cur)} strong />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PriceCard label="Wholesale" sub={`${value.wholesaleMultiple ?? 0}× your cost`} value={money(rec.wholesale, cur)} />
          <PriceCard label="Recommended retail" sub="What a stockist would charge" value={money(rec.rrp, cur)} />
          <PriceCard label="On your own site" sub={`To keep ${percent(value.targetMarginPct)}`} value={money(rec.direct, cur)} accent />
        </div>

        {rec.direct == null && (value.targetMarginPct ?? 0) > 0 && (
          <Callout tone="warn">
            A {percent(value.targetMarginPct)} margin isn&apos;t reachable — discounting, fees and
            returns already account for{" "}
            {percent((value.discountPct ?? 0) + (value.paymentFeePct ?? 0) + (value.returnsPct ?? 0))} of
            the price. Lower the target or cut what selling costs you.
          </Callout>
        )}

        {rec.naiveShortfall != null && rec.naiveShortfall > 0.005 && (
          <Callout tone="info">
            Cost ÷ (1 − margin) — the shortcut most brands use — says <b>{money(rec.naiveDirect, cur)}</b>.
            That ignores the discounting, fees and returns you just entered. Charge it and you keep well
            under your {percent(value.targetMarginPct)}. The real number is <b>{money(rec.direct, cur)}</b>,{" "}
            {money(rec.naiveShortfall, cur)} higher.
          </Callout>
        )}

        <div className={`${CARD} p-4`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">Try a price</p>
            <div className="flex-1" />
            <input
              type="number" step="0.01"
              className={`${INPUT} w-32`}
              aria-label="Test price"
              placeholder={rec.direct != null ? rec.direct.toFixed(2) : "0.00"}
              value={testPrice}
              onChange={(e) => setTestPrice(e.target.value)}
            />
            <button
              onClick={() => onChange({ chosen_price: effectivePrice })}
              className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
            >
              Save as the price
            </button>
          </div>

          {outcome ? (
            <>
              <Line label="Asking price" value={money(outcome.price, cur)} />
              {outcome.discountGiven > 0 && <Line label="Less average discount" value={`− ${money(outcome.discountGiven, cur)}`} muted />}
              {outcome.paymentFees > 0 && <Line label="Less payment fees" value={`− ${money(outcome.paymentFees, cur)}`} muted />}
              {outcome.returnsAllowance > 0 && <Line label="Less returns" value={`− ${money(outcome.returnsAllowance, cur)}`} muted />}
              {outcome.fulfilment > 0 && <Line label="Less fulfilment" value={`− ${money(outcome.fulfilment, cur)}`} muted />}
              <Line label="Less what it cost you" value={`− ${money(outcome.unitCost, cur)}`} muted />
              <div className="mt-1.5 border-t border-[var(--sa-border)] pt-1.5">
                <Line
                  label="You keep, per garment"
                  value={money(outcome.contribution, cur)}
                  strong
                  tone={outcome.viable ? undefined : "loss"}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Stat label="Margin" value={percent(outcome.marginPct)} tone={verdict.tone} />
                <Stat label="Markup" value={outcome.markupMultiple ? `${outcome.markupMultiple.toFixed(2)}×` : "—"} />
                <Stat
                  label={`Across ${value.quantity} units`}
                  value={money(outcome.runContribution, cur)}
                  tone={outcome.viable ? undefined : "loss"}
                />
                {breakEven != null && <Stat label="Break even at" value={`${breakEven} units`} />}
              </div>

              {!outcome.viable && (
                <Callout tone="warn">
                  At {money(outcome.price, cur)} every garment sold loses{" "}
                  {money(Math.abs(outcome.contribution), cur)}.
                </Callout>
              )}
              {breakEven != null && breakEven > value.quantity && outcome.viable && (
                <Callout tone="warn">
                  You&apos;d need to sell {breakEven} units to cover development and tooling, but the
                  run is only {value.quantity}. Either raise the price, make more, or treat the
                  difference as an investment in the style.
                </Callout>
              )}
            </>
          ) : (
            <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">
              Add what the garment costs and a price will appear here.
            </p>
          )}
        </div>

        <textarea
          className={`${CARD} min-h-[70px] resize-y p-3 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]`}
          placeholder="Notes — the quote this came from, what the factory said, what you decided."
          value={value.notes ?? ""}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

// ── Presentational pieces ───────────────────────────────────

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">{title}</p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">{note}</p>}
      <div className="mt-2.5 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span className="pt-1.5">
        <span className={LABEL}>{label}</span>
        {hint && <span className="block text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">{hint}</span>}
      </span>
      <span className="w-28 shrink-0">{children}</span>
    </label>
  );
}

function Line({ label, value, strong, muted, tone }: {
  label: string; value: string; strong?: boolean; muted?: boolean; tone?: "loss";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className={`text-[12.5px] ${muted ? "text-[var(--sa-text-tertiary)]" : "text-[var(--sa-text-secondary)]"}`}>
        {label}
      </span>
      <span
        className={`tabular-nums ${strong ? "text-[14px] font-semibold" : "text-[12.5px]"}`}
        style={{ color: tone === "loss" ? "var(--sa-danger)" : "var(--sa-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PriceCard({ label, sub, value, accent }: {
  label: string; sub: string; value: string; accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${accent ? "border-transparent" : "border-[var(--sa-border)] bg-[var(--sa-window)]"}`}
      style={accent ? { background: "var(--sa-selected)" } : undefined}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">{label}</p>
      <p
        className="mt-1 text-[22px] font-semibold leading-tight tabular-nums"
        style={{ color: accent ? "var(--sa-accent)" : "var(--sa-text-primary)" }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--sa-text-tertiary)]">{sub}</p>
    </div>
  );
}

const TONE: Record<string, { bg: string; fg: string }> = {
  good:    { bg: "rgba(52,199,89,0.12)", fg: "var(--sa-success)" },
  thin:    { bg: "rgba(255,149,0,0.12)", fg: "var(--sa-warning)" },
  loss:    { bg: "rgba(255,59,48,0.12)", fg: "var(--sa-danger)" },
  unknown: { bg: "var(--sa-hover)",      fg: "var(--sa-text-secondary)" },
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const t = TONE[tone ?? "unknown"] ?? TONE.unknown;
  return (
    <div className="rounded-lg px-2.5 py-1.5" style={{ background: t.bg }}>
      <span className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--sa-text-tertiary)" }}>
        {label}
      </span>
      <span className="block text-[14px] font-semibold tabular-nums" style={{ color: t.fg }}>
        {value}
      </span>
    </div>
  );
}

function Callout({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  const warn = tone === "warn";
  const Icon = warn ? TriangleAlert : Info;
  return (
    <div
      className="flex gap-2 rounded-lg p-3 text-[12.5px] leading-relaxed"
      style={{ background: warn ? "rgba(255,149,0,0.10)" : "var(--sa-hover)", color: "var(--sa-text-secondary)" }}
    >
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: warn ? "var(--sa-warning)" : "var(--sa-text-tertiary)" }} />
      <span>{children}</span>
    </div>
  );
}
