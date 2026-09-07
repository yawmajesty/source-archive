"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, TriangleAlert, Info } from "lucide-react";
import {
  buildCost, recommend, priceOutcome, breakEvenUnits,
  money, percent, marginVerdict,
  PRICING_CURRENCIES, COST_FIELDS, LANDING_FIELDS, DEVELOPMENT_FIELDS, SELLING_FIELDS,
  type PricingInputs,
} from "@/lib/pricing";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { createPriceSheet, updatePriceSheet, deletePriceSheet, type PriceSheet } from "./actions";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  baseCurrency: string;
  initialSheets: PriceSheet[];
}

const CARD = "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]";
const INPUT =
  "w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] tabular-nums text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";
const LABEL = "text-[11px] font-medium text-[var(--sa-text-secondary)]";

export function PricingClient({
  workspaceId, workspaceSlug, mode, role, baseCurrency, initialSheets,
}: Props) {
  const [sheets, setSheets] = useState(initialSheets);
  const [activeId, setActiveId] = useState<string | null>(initialSheets[0]?.id ?? null);
  const [testPrice, setTestPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sheet = sheets.find((s) => s.id === activeId) ?? null;

  const base = { workspace_id: workspaceId, workspace_slug: workspaceSlug, mode, role };

  async function addSheet() {
    setError(null);
    const res = await createPriceSheet({ ...base, currency: baseCurrency });
    if (!res.success) { setError(res.error); return; }
    setSheets((prev) => [res.sheet, ...prev]);
    setActiveId(res.sheet.id);
    setTestPrice("");
  }

  // Optimistic on every keystroke, persisted in a transition. The maths is
  // local, so the numbers never wait on the network.
  function patch(p: Partial<PriceSheet>) {
    if (!sheet) return;
    setSheets((prev) => prev.map((s) => (s.id === sheet.id ? { ...s, ...p } : s)));
    startTransition(async () => {
      const res = await updatePriceSheet({ ...base, id: sheet.id, patch: p });
      if (!res.success) setError(res.error);
    });
  }

  async function removeSheet(id: string) {
    setSheets((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
    await deletePriceSheet({ ...base, id });
  }

  const inputs: PricingInputs | null = sheet;
  const cost = useMemo(() => (inputs ? buildCost(inputs) : null), [inputs]);
  const rec = useMemo(() => (inputs && cost ? recommend(inputs, cost) : null), [inputs, cost]);

  // The tester falls back to the recommended direct price so the panel is
  // never blank — you always see the consequence of the number above it.
  const effectivePrice =
    testPrice !== "" ? Number(testPrice) : sheet?.chosen_price ?? rec?.direct ?? null;
  const outcome = useMemo(
    () => (inputs && cost && effectivePrice != null && Number.isFinite(effectivePrice)
      ? priceOutcome(effectivePrice, inputs, cost)
      : null),
    [inputs, cost, effectivePrice],
  );

  const cur = sheet?.currency ?? baseCurrency;
  const fixed = (sheet?.sampling ?? 0) + (sheet?.tooling ?? 0);
  const breakEven = outcome && fixed > 0 ? breakEvenUnits(outcome, fixed) : null;
  const verdict = marginVerdict(outcome?.marginPct ?? null);

  function field(key: keyof PricingInputs, suffix?: string) {
    const value = sheet ? (sheet[key] as number | null) : null;
    return (
      <div className="relative">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          className={INPUT}
          value={value ?? ""}
          placeholder="0"
          onChange={(e) =>
            patch({ [key]: e.target.value === "" ? null : Number(e.target.value) } as Partial<PriceSheet>)
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
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--sa-border)] px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Pricing</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            What a garment costs you, and what you should charge for it.
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={addSheet}
          className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
        >
          <Plus size={13} /> New style
        </button>
      </div>

      {error && (
        <p className="border-b border-[var(--sa-border)] bg-red-50 px-6 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {sheets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="max-w-sm text-center">
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">
              Price your first style
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">
              Put in what the garment costs to make and the calculator works backwards to the
              price you need to charge — after discounting, returns and card fees have taken
              their share. Most brands price before accounting for those and wonder where the
              margin went.
            </p>
            <button
              onClick={addSheet}
              className="mt-4 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white"
            >
              Start a price sheet
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Style list */}
          <aside className="w-52 shrink-0 overflow-y-auto border-r border-[var(--sa-border)] p-2">
            {sheets.map((s) => (
              /* Two real buttons side by side rather than one nested in the
                 other — a button inside a button is invalid, and the delete
                 needs its own focus stop for keyboard users. */
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-md pr-1.5 ${
                  s.id === activeId ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
                }`}
              >
                <button
                  onClick={() => { setActiveId(s.id); setTestPrice(""); }}
                  className={`min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px] ${
                    s.id === activeId
                      ? "font-medium text-[var(--sa-accent)]"
                      : "text-[var(--sa-text-secondary)]"
                  }`}
                >
                  {s.name}
                </button>
                <button
                  aria-label={`Delete ${s.name}`}
                  onClick={() => removeSheet(s.id)}
                  className="shrink-0 p-1 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </aside>

          {sheet && (
            <div className="flex flex-1 gap-6 overflow-y-auto p-6">
              {/* ── Inputs ─────────────────────────────── */}
              <div className="flex w-full max-w-md shrink-0 flex-col gap-4">
                <div className={`${CARD} p-4`}>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                      value={sheet.name}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                    <select
                      className={`${INPUT} w-24`}
                      value={sheet.currency}
                      onChange={(e) => patch({ currency: e.target.value })}
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
                      value={sheet.quantity}
                      onChange={(e) => patch({ quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                  </label>
                </div>

                <Section title="What one garment costs to make">
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
                  note={`Spread across all ${sheet.quantity} units — ${money(cost?.developmentPerUnit ?? 0, cur)} each.`}
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

              {/* ── Results ────────────────────────────── */}
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                {/* Cost build-up */}
                <div className={`${CARD} p-4`}>
                  <p className="mb-2.5 text-[12px] font-semibold text-[var(--sa-text-primary)]">
                    What it really costs you
                  </p>
                  <Line label="Ex-factory" value={money(cost?.exFactory ?? 0, cur)} />
                  {(cost?.duty ?? 0) > 0 && <Line label="Duty" value={money(cost!.duty, cur)} muted />}
                  {(sheet.freight ?? 0) > 0 && <Line label="Freight" value={money(sheet.freight!, cur)} muted />}
                  <Line label="Landed" value={money(cost?.landed ?? 0, cur)} />
                  {(cost?.developmentPerUnit ?? 0) > 0 && (
                    <Line label="Development, per unit" value={money(cost!.developmentPerUnit, cur)} muted />
                  )}
                  <div className="mt-1.5 border-t border-[var(--sa-border)] pt-1.5">
                    <Line label="True cost per garment" value={money(cost?.trueCost ?? 0, cur)} strong />
                  </div>
                </div>

                {/* The answer */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <PriceCard
                    label="Wholesale"
                    sub={`${sheet.wholesaleMultiple ?? 0}× your cost`}
                    value={money(rec?.wholesale, cur)}
                  />
                  <PriceCard
                    label="Recommended retail"
                    sub="What a stockist would charge"
                    value={money(rec?.rrp, cur)}
                  />
                  <PriceCard
                    label="On your own site"
                    sub={`To keep ${percent(sheet.targetMarginPct)}`}
                    value={money(rec?.direct, cur)}
                    accent
                  />
                </div>

                {rec?.direct == null && (sheet.targetMarginPct ?? 0) > 0 && (
                  <Callout tone="warn">
                    A {percent(sheet.targetMarginPct)} margin isn&apos;t reachable — discounting,
                    fees and returns already account for{" "}
                    {percent((sheet.discountPct ?? 0) + (sheet.paymentFeePct ?? 0) + (sheet.returnsPct ?? 0))}{" "}
                    of the price. Lower the target or cut what selling costs you.
                  </Callout>
                )}

                {rec?.naiveShortfall != null && rec.naiveShortfall > 0.005 && (
                  <Callout tone="info">
                    Cost ÷ (1 − margin) — the shortcut most brands use — says{" "}
                    <b>{money(rec.naiveDirect, cur)}</b>. That ignores the discounting, fees and
                    returns you just entered. Charge it and you keep well under your{" "}
                    {percent(sheet.targetMarginPct)}. The real number is{" "}
                    <b>{money(rec.direct, cur)}</b>, {money(rec.naiveShortfall, cur)} higher.
                  </Callout>
                )}

                {/* Price tester */}
                <div className={`${CARD} p-4`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">
                      Try a price
                    </p>
                    <div className="flex-1" />
                    <input
                      type="number"
                      step="0.01"
                      className={`${INPUT} w-32`}
                      placeholder={rec?.direct != null ? rec.direct.toFixed(2) : "0.00"}
                      value={testPrice}
                      onChange={(e) => setTestPrice(e.target.value)}
                    />
                    <button
                      onClick={() => patch({ chosen_price: effectivePrice })}
                      className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                    >
                      Save as the price
                    </button>
                  </div>

                  {outcome ? (
                    <>
                      <Line label="Asking price" value={money(outcome.price, cur)} />
                      {outcome.discountGiven > 0 && (
                        <Line label="Less average discount" value={`− ${money(outcome.discountGiven, cur)}`} muted />
                      )}
                      {outcome.paymentFees > 0 && (
                        <Line label="Less payment fees" value={`− ${money(outcome.paymentFees, cur)}`} muted />
                      )}
                      {outcome.returnsAllowance > 0 && (
                        <Line label="Less returns" value={`− ${money(outcome.returnsAllowance, cur)}`} muted />
                      )}
                      {outcome.fulfilment > 0 && (
                        <Line label="Less fulfilment" value={`− ${money(outcome.fulfilment, cur)}`} muted />
                      )}
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
                        <Stat
                          label="Markup"
                          value={outcome.markupMultiple ? `${outcome.markupMultiple.toFixed(2)}×` : "—"}
                        />
                        <Stat
                          label={`Across ${sheet.quantity} units`}
                          value={money(outcome.runContribution, cur)}
                          tone={outcome.viable ? undefined : "loss"}
                        />
                        {breakEven != null && (
                          <Stat label="Break even at" value={`${breakEven} units`} />
                        )}
                      </div>

                      {!outcome.viable && (
                        <Callout tone="warn">
                          At {money(outcome.price, cur)} every garment sold loses{" "}
                          {money(Math.abs(outcome.contribution), cur)}.
                        </Callout>
                      )}
                      {breakEven != null && breakEven > sheet.quantity && outcome.viable && (
                        <Callout tone="warn">
                          You&apos;d need to sell {breakEven} units to cover development and tooling,
                          but the run is only {sheet.quantity}. Either raise the price, make more, or
                          treat the difference as an investment in the style.
                        </Callout>
                      )}
                    </>
                  ) : (
                    <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">
                      Enter what the garment costs and a price will appear here.
                    </p>
                  )}
                </div>

                <textarea
                  className={`${CARD} min-h-[70px] resize-y p-3 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]`}
                  placeholder="Notes — the quote this came from, what the factory said, what you decided."
                  value={sheet.notes ?? ""}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      )}
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
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
        {label}
      </p>
      <p
        className="mt-1 text-[22px] font-semibold tabular-nums leading-tight"
        style={{ color: accent ? "var(--sa-accent)" : "var(--sa-text-primary)" }}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--sa-text-tertiary)]">{sub}</p>
    </div>
  );
}

const TONE: Record<string, { bg: string; fg: string }> = {
  good:    { bg: "rgba(52,199,89,0.12)",  fg: "var(--sa-success)" },
  thin:    { bg: "rgba(255,149,0,0.12)",  fg: "var(--sa-warning)" },
  loss:    { bg: "rgba(255,59,48,0.12)",  fg: "var(--sa-danger)" },
  unknown: { bg: "var(--sa-hover)",       fg: "var(--sa-text-secondary)" },
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
      style={{
        background: warn ? "rgba(255,149,0,0.10)" : "var(--sa-hover)",
        color: "var(--sa-text-secondary)",
      }}
    >
      <Icon
        size={14}
        className="mt-0.5 shrink-0"
        style={{ color: warn ? "var(--sa-warning)" : "var(--sa-text-tertiary)" }}
      />
      <span>{children}</span>
    </div>
  );
}
