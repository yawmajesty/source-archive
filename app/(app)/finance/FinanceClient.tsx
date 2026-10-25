"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Lock, TriangleAlert } from "lucide-react";
import type { FinanceReport } from "./actions";

// ─────────────────────────────────────────────────────────────
// Finance.
//
// The order is the order the questions get asked: what are we owed, are we
// making money, and which work made it. That is how Xero and QuickBooks lay
// out a Home and Reports section, and it is the opposite of a ledger — a
// ledger lists transactions, this answers questions and then hands off to
// the ledger for the detail.
//
// Nothing here writes. Every figure links through to the page that owns it,
// so Cost Tracker and Invoices stay the place where things change.
// ─────────────────────────────────────────────────────────────

function gbp(value: number, decimals = 0): string {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function usd(value: number, decimals = 0): string {
  return `$${value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function Tile({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warning" | "danger" | "success";
}) {
  const colour =
    tone === "danger" ? "var(--sa-danger)"
    : tone === "warning" ? "var(--sa-warning)"
    : tone === "success" ? "var(--sa-success)"
    : "var(--sa-text-primary)";
  return (
    <div className="min-w-0 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
      <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
        {label}
      </div>
      <div className="mt-1.5 truncate text-xl font-semibold tabular-nums" style={{ color: colour }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-[var(--sa-text-secondary)]">{sub}</div>}
    </div>
  );
}

function SectionHead({
  title, note, href, hrefLabel,
}: {
  title: string;
  note: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--sa-text-primary)]">{title}</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">{note}</p>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--sa-accent)] hover:underline"
        >
          {hrefLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

const CELL = "px-2.5 py-2 text-right tabular-nums whitespace-nowrap";
const HEAD = "px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] whitespace-nowrap";

export function FinanceClient({ report }: { report: FinanceReport }) {
  const [showAllMonths, setShowPaidMonths] = useState(false);

  if (!report.allowed) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-md rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center">
          <Lock size={18} className="mx-auto text-[var(--sa-text-tertiary)]" />
          <h1 className="mt-2 text-sm font-semibold text-[var(--sa-text-primary)]">Finance is restricted</h1>
          <p className="mt-1 text-xs text-[var(--sa-text-secondary)]">
            You need costing access to see revenue, margins and what clients owe.
            An admin can grant it under Team.
          </p>
        </div>
      </div>
    );
  }

  const months = showAllMonths ? report.months : report.months.slice(0, 6);
  const grossMarginPct =
    report.totalRevenue > 0
      ? ((report.totalRevenue - report.totalCogs) / report.totalRevenue) * 100
      : null;
  const net = report.totalRevenue - report.totalCogs - report.totalOperating;
  // Costs are tagged to projects but most payments are not, which quietly
  // drags every project margin negative. Worth saying out loud rather than
  // letting the table imply the work lost money.
  // Capped: the job rows count spend whether or not a paid date was
  // recorded, so without the clamp a stray row could read as 103%.
  const unallocatedShare =
    report.totalRevenue > 0 ? Math.min(1, report.unallocatedRevenue / report.totalRevenue) : 0;

  // The ageing bar is drawn from shares of the total, so an empty bucket
  // takes no width rather than showing a stub of colour.
  const bucketColours = ["var(--sa-success)", "var(--sa-warning)", "#FF7A1A", "var(--sa-danger)"];
  const widest = useMemo(() => Math.max(1, ...report.buckets.map((b) => b.amount)), [report.buckets]);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-[var(--sa-text-primary)]">Finance</h1>
        <p className="mt-0.5 text-xs text-[var(--sa-text-secondary)]">
          What we are owed, what we earned, and which projects paid for themselves.
        </p>
      </header>

      {/* ── Receivables ── */}
      <section className="mb-7">
        <SectionHead
          title="Receivables"
          note="Invoices raised and not yet paid, aged from the day they were raised. Invoices carry no payment terms, so this is age, not lateness."
          href="/invoices"
          hrefLabel="Open Invoices"
        />

        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
          <Tile label="Outstanding" value={usd(report.owed, 2)} sub="Across all clients" />
          <Tile
            label="Over 30 days"
            value={usd(report.owedOver30, 2)}
            tone={report.owedOver30 > 0 ? "warning" : undefined}
            sub={report.owed > 0 ? `${Math.round((report.owedOver30 / report.owed) * 100)}% of the total` : "Nothing ageing"}
          />
          <Tile
            label="Oldest"
            value={report.oldestDays > 0 ? `${report.oldestDays} days` : "—"}
            tone={report.oldestDays > 90 ? "danger" : report.oldestDays > 30 ? "warning" : undefined}
            sub="Since it was raised"
          />
          <Tile
            label="Dormant clients"
            value={usd(report.owedDormant, 2)}
            tone={report.owedDormant > 0 ? "danger" : undefined}
            sub="Owed by archived clients"
          />
        </div>

        {report.owedDormant > 0 && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-hover)] p-2.5">
            <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[var(--sa-warning)]" />
            <p className="min-w-0 text-[11px] leading-relaxed text-[var(--sa-text-secondary)]">
              <strong className="font-semibold text-[var(--sa-text-primary)]">
                {usd(report.owedDormant, 2)} is owed by clients marked inactive.
              </strong>{" "}
              The Invoices page and the morning digest both leave these out, because they
              are not work in progress. They are still money owed — worth either chasing
              or writing off deliberately, rather than leaving them to sit.
            </p>
          </div>
        )}

        {report.buckets.some((b) => b.amount > 0) && (
          <div className="mt-3 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
            <div className="space-y-1.5">
              {report.buckets.map((b, i) => (
                <div key={b.label} className="flex items-center gap-2">
                  <div className="w-24 shrink-0 truncate text-[11px] text-[var(--sa-text-secondary)]">{b.label}</div>
                  <div className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-[var(--sa-hover)]">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: b.amount > 0 ? `${Math.max(2, (b.amount / widest) * 100)}%` : 0,
                        background: bucketColours[i],
                      }}
                    />
                  </div>
                  <div className="w-24 shrink-0 text-right text-[11px] font-medium tabular-nums text-[var(--sa-text-primary)]">
                    {b.amount > 0 ? usd(b.amount, 2) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.receivables.length > 0 ? (
          <div className="mt-2.5 overflow-x-auto rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="border-b border-[var(--sa-border)]">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                    Client
                  </th>
                  {report.buckets.map((b) => (
                    <th key={b.label} className={HEAD}>{b.label.replace(" days", "")}</th>
                  ))}
                  <th className={HEAD}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.receivables.map((r) => (
                  <tr key={r.clientId} className="border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-hover)]">
                    <td className="max-w-[180px] px-2.5 py-2">
                      <Link href={`/clients/${r.clientId}`} className="block truncate font-medium text-[var(--sa-text-primary)] hover:underline">
                        {r.clientName}
                      </Link>
                      <span className="text-[10px] text-[var(--sa-text-tertiary)]">
                        {r.oldestDays}d old{r.dormant && " · inactive"}
                      </span>
                    </td>
                    {r.byBucket.map((amount, i) => (
                      <td key={i} className={CELL} style={{ color: amount > 0 ? bucketColours[i] : "var(--sa-text-tertiary)" }}>
                        {amount > 0 ? usd(amount) : "—"}
                      </td>
                    ))}
                    <td className={`${CELL} font-semibold text-[var(--sa-text-primary)]`}>{usd(r.total, 2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-[var(--sa-border-strong)] bg-[var(--sa-hover)]">
                <tr>
                  <td className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                    Total
                  </td>
                  {report.buckets.map((b) => (
                    <td key={b.label} className={`${CELL} font-semibold`}>{b.amount > 0 ? usd(b.amount) : "—"}</td>
                  ))}
                  <td className={`${CELL} font-semibold`}>{usd(report.owed, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="mt-2.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-4 text-center text-xs text-[var(--sa-text-secondary)]">
            Nothing outstanding. Every invoice raised has been paid.
          </p>
        )}
      </section>

      {/* ── Profit and loss ── */}
      <section className="mb-7">
        <SectionHead
          title="Profit &amp; loss"
          note="Cash basis — money that actually moved, by the date it was paid. Revenue is recorded in the cost ledger as it arrives, not when an invoice is raised."
          href="/costs"
          hrefLabel="Open Cost Tracker"
        />

        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
          <Tile label="Revenue" value={gbp(report.totalRevenue)} sub="All time, received" />
          <Tile
            label="Gross profit"
            value={gbp(report.totalRevenue - report.totalCogs)}
            sub={grossMarginPct == null ? "No revenue yet" : `${grossMarginPct.toFixed(1)}% margin`}
            tone="success"
          />
          <Tile label="Overheads" value={gbp(report.totalOperating)} sub="Operating costs" />
          <Tile
            label="Net"
            value={gbp(net)}
            tone={net >= 0 ? "success" : "danger"}
            sub={net >= 0 ? "In profit" : "At a loss"}
          />
        </div>

        {months.length > 0 && (
          <div className="mt-2.5 overflow-x-auto rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="border-b border-[var(--sa-border)]">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                    Month
                  </th>
                  <th className={HEAD}>Revenue</th>
                  <th className={HEAD}>Cost of sales</th>
                  <th className={HEAD}>Gross</th>
                  <th className={HEAD}>Margin</th>
                  <th className={HEAD}>Overheads</th>
                  <th className={HEAD}>Net</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const margin = m.revenue > 0 ? (m.grossProfit / m.revenue) * 100 : null;
                  return (
                    <tr key={m.month} className="border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-hover)]">
                      <td className="whitespace-nowrap px-2.5 py-2 font-medium text-[var(--sa-text-primary)]">{m.label}</td>
                      <td className={CELL}>{m.revenue ? gbp(m.revenue) : "—"}</td>
                      <td className={CELL}>{m.cogs ? gbp(m.cogs) : "—"}</td>
                      <td className={CELL}>{m.grossProfit ? gbp(m.grossProfit) : "—"}</td>
                      <td className={`${CELL} text-[var(--sa-text-secondary)]`}>
                        {margin == null ? "—" : `${margin.toFixed(0)}%`}
                      </td>
                      <td className={CELL}>{m.operating ? gbp(m.operating) : "—"}</td>
                      <td
                        className={`${CELL} font-semibold`}
                        style={{ color: m.net >= 0 ? "var(--sa-success)" : "var(--sa-danger)" }}
                      >
                        {gbp(m.net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {report.months.length > 6 && (
          <button
            onClick={() => setShowPaidMonths((v) => !v)}
            className="mt-2 text-[11px] font-medium text-[var(--sa-accent)] hover:underline"
          >
            {showAllMonths ? "Show last 6 months" : `Show all ${report.months.length} months`}
          </button>
        )}
      </section>

      {/* ── Project profitability ── */}
      <section>
        <SectionHead
          title="Project profitability"
          note="Cash in against cash out, per project, in sterling. Only money tagged to a project appears here."
        />

        {report.jobs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="border-b border-[var(--sa-border)]">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                    Project
                  </th>
                  <th className={HEAD}>Received</th>
                  <th className={HEAD}>Costs</th>
                  <th className={HEAD}>Margin</th>
                  <th className={HEAD}>%</th>
                </tr>
              </thead>
              <tbody>
                {report.jobs.map((j) => (
                  <tr key={j.projectId} className="border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-hover)]">
                    <td className="max-w-[200px] px-2.5 py-2">
                      <Link href={`/projects/${j.projectId}`} className="block truncate font-medium text-[var(--sa-text-primary)] hover:underline">
                        {j.projectName}
                      </Link>
                      <span className="block truncate text-[10px] text-[var(--sa-text-tertiary)]">{j.clientName}</span>
                    </td>
                    <td className={CELL}>{j.received ? gbp(j.received) : "—"}</td>
                    <td className={CELL}>{j.cost ? gbp(j.cost) : "—"}</td>
                    <td
                      className={`${CELL} font-semibold`}
                      style={{ color: j.margin >= 0 ? "var(--sa-success)" : "var(--sa-danger)" }}
                    >
                      {gbp(j.margin)}
                    </td>
                    <td className={`${CELL} text-[var(--sa-text-secondary)]`}>
                      {j.marginPct == null ? "—" : `${j.marginPct.toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-4 text-center text-xs text-[var(--sa-text-secondary)]">
            No project has money recorded against it yet.
          </p>
        )}

        {unallocatedShare > 0.05 && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-hover)] p-2.5">
            <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[var(--sa-warning)]" />
            <p className="min-w-0 text-[11px] leading-relaxed text-[var(--sa-text-secondary)]">
              <strong className="font-semibold text-[var(--sa-text-primary)]">
                These margins read low, and the data is why.
              </strong>{" "}
              {gbp(report.unallocatedRevenue)} of income — {Math.round(unallocatedShare * 100)}% of all
              revenue — is recorded against a client but not against a project, while costs are
              tagged per project. So the spend lands on a project and the payment for it does not,
              and every row above looks worse than the work really was. Setting the project on those
              payments in{" "}
              <Link href="/costs" className="text-[var(--sa-accent)] hover:underline">Cost Tracker</Link>{" "}
              is what turns this table into a real job-costing report.
              {report.unallocatedCost > 0 && (
                <> A further {gbp(report.unallocatedCost)} of spend has no project either.</>
              )}
            </p>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--sa-text-tertiary)]">
          Receivables are shown in US dollars because invoices are raised in dollars. Everything
          else is in sterling, converted at the rate recorded on each cost. The two are not added
          together anywhere on this page.
        </p>
      </section>
    </div>
  );
}
