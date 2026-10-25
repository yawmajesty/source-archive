"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import { sumInvoice } from "@/lib/invoice-total";

// ─────────────────────────────────────────────────────────────
// The finance report.
//
// Built on the four things accounting software actually puts in front of
// somebody, in the order they get asked:
//
//   where do we stand        cash position, what is owed, what is owing
//   who owes us and how long aged receivables in 30-day buckets
//   are we making money      profit and loss by month
//   which work made it       profitability per project
//
// Read-only and additive. Costs, Invoices and Studio are untouched; this
// reads the same rows and answers different questions, so nothing that
// works today can break.
//
// Two honesties the data forces, both surfaced in the UI rather than
// papered over:
//
//   · This is cash basis. Revenue is money that arrived, not invoices
//     raised, because that is what the ledger records.
//   · sampling_invoices has no due date, so ageing runs from the day an
//     invoice was raised. "60 days old" is not the same claim as "30 days
//     overdue", and the page says which it means.
// ─────────────────────────────────────────────────────────────

export interface Bucket {
  label: string;
  /** Inclusive lower bound in days since the invoice was raised. */
  from: number;
  to: number | null;
  amount: number;
  count: number;
}

export interface ReceivableRow {
  clientId: string;
  clientName: string;
  total: number;
  /** Amount per bucket, same order as the bucket list. */
  byBucket: number[];
  oldestDays: number;
  /** Client is archived or dormant — still owed, but not actively worked. */
  dormant: boolean;
}

export interface MonthRow {
  month: string;
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operating: number;
  net: number;
}

export interface JobRow {
  projectId: string;
  projectName: string;
  clientName: string;
  received: number;
  cost: number;
  margin: number;
  marginPct: number | null;
}

export interface FinanceReport {
  allowed: boolean;
  /** Everything from the cost ledger, normalised to the agency's base. */
  ledgerCurrency: string;
  /** Invoices are raised in USD; kept separate rather than guessing a rate. */
  invoiceCurrency: string;

  owed: number;
  owedOver30: number;
  /** Of `owed`, the part sitting against dormant clients. */
  owedDormant: number;
  oldestDays: number;
  buckets: Bucket[];
  receivables: ReceivableRow[];

  months: MonthRow[];
  jobs: JobRow[];
  /** Spend with no project attached, so missing from the job rows. */
  unallocatedCost: number;
  /** Income with no project attached. The big one: payments get recorded
   *  against a client without a project, which makes every project look
   *  less profitable than it is. */
  unallocatedRevenue: number;

  totalRevenue: number;
  totalCogs: number;
  totalOperating: number;

  receivedThisMonth: number;
  spentThisMonth: number;
  receivedLastMonth: number;
  spentLastMonth: number;
}

const EMPTY: FinanceReport = {
  allowed: false, ledgerCurrency: "GBP", invoiceCurrency: "USD",
  owed: 0, owedOver30: 0, owedDormant: 0, oldestDays: 0, buckets: [], receivables: [],
  months: [], jobs: [], unallocatedCost: 0, unallocatedRevenue: 0,
  totalRevenue: 0, totalCogs: 0, totalOperating: 0,
  receivedThisMonth: 0, spentThisMonth: 0, receivedLastMonth: 0, spentLastMonth: 0,
};

const BUCKET_DEFS: Array<{ label: string; from: number; to: number | null }> = [
  { label: "Under 30 days", from: 0, to: 30 },
  { label: "31–60 days", from: 31, to: 60 },
  { label: "61–90 days", from: 61, to: 90 },
  { label: "Over 90 days", from: 91, to: null },
];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export async function getFinanceReport(): Promise<FinanceReport> {
  const ctx = await getAgencyContext();
  if (!ctx) return EMPTY;
  // Money is admin territory, the same rule the Invoices page applies.
  if (!can(ctx.role, ctx.permissions, "cost.view")) return EMPTY;

  const supabase = await getAgencySupabase();
  const [costsRes, invoicesRes, clientsRes, projectsRes] = await Promise.all([
    supabase
      .from("costs")
      .select("direction, cost_type, amount_gbp, date_paid, client_id, project_id")
      .is("deleted_at", null),
    supabase.from("sampling_invoices").select("id, client_id, status, created_at, line_items, deposit_percent"),
    supabase.from("clients").select("id, name, status"),
    supabase.from("projects").select("id, name, client_id, status"),
  ]);

  const clients = (clientsRes.data ?? []) as Array<{ id: string; name: string; status: string | null }>;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  // The dashboard drops archived clients, because it is a queue of what to
  // do next. A receivables ledger cannot do that: $13k of unpaid invoices
  // against dormant clients is still $13k owed, and hiding it is how debt
  // gets quietly forgotten. So everything is counted, and anything against
  // a dormant client is marked rather than dropped — writing it off is a
  // decision for a person, not a filter.
  const dormant = new Set(clients.filter((c) => c.status === "inactive").map((c) => c.id));

  const projects = (projectsRes.data ?? []) as Array<{ id: string; name: string; client_id: string }>;

  // ── Aged receivables ──
  const now = Date.now();
  const buckets: Bucket[] = BUCKET_DEFS.map((b) => ({ ...b, amount: 0, count: 0 }));
  const byClient = new Map<string, ReceivableRow>();
  let owed = 0;
  let owedOver30 = 0;
  let owedDormant = 0;
  let oldestDays = 0;

  for (const raw of (invoicesRes.data ?? []) as Array<Record<string, unknown>>) {
    if (String(raw.status) !== "sent") continue;
    const clientId = String(raw.client_id);
    const isDormant = dormant.has(clientId);

    const total = sumInvoice(raw.line_items);
    const due = total * ((Number(raw.deposit_percent) || 100) / 100);
    if (due <= 0) continue;

    const days = Math.max(0, Math.floor((now - new Date(String(raw.created_at)).getTime()) / 86_400_000));
    const index = BUCKET_DEFS.findIndex((b) => days >= b.from && (b.to == null || days <= b.to));
    const bucket = index < 0 ? buckets.length - 1 : index;

    buckets[bucket].amount += due;
    buckets[bucket].count += 1;
    owed += due;
    if (days > 30) owedOver30 += due;
    if (isDormant) owedDormant += due;
    oldestDays = Math.max(oldestDays, days);

    const row = byClient.get(clientId) ?? {
      clientId,
      clientName: clientName.get(clientId) ?? "Unknown client",
      total: 0,
      byBucket: BUCKET_DEFS.map(() => 0),
      oldestDays: 0,
      dormant: isDormant,
    };
    row.total += due;
    row.byBucket[bucket] += due;
    row.oldestDays = Math.max(row.oldestDays, days);
    byClient.set(clientId, row);
  }

  // ── Profit and loss, by month ──
  const costRows = (costsRes.data ?? []) as Array<{
    direction: string | null; cost_type: string | null; amount_gbp: number | null;
    date_paid: string | null; client_id: string | null; project_id: string | null;
  }>;

  const monthly = new Map<string, MonthRow>();
  const ensureMonth = (key: string): MonthRow => {
    const existing = monthly.get(key);
    if (existing) return existing;
    const row: MonthRow = {
      month: key,
      label: new Date(`${key}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      revenue: 0, cogs: 0, grossProfit: 0, operating: 0, net: 0,
    };
    monthly.set(key, row);
    return row;
  };

  for (const c of costRows) {
    if (!c.date_paid) continue;
    const amount = Number(c.amount_gbp) || 0;
    if (amount === 0) continue;
    const row = ensureMonth(monthKey(c.date_paid));
    if (c.direction === "in") row.revenue += amount;
    else if (c.cost_type === "cogs") row.cogs += amount;
    else row.operating += amount;
  }

  for (const row of monthly.values()) {
    row.grossProfit = row.revenue - row.cogs;
    row.net = row.grossProfit - row.operating;
  }

  // Newest first, and only as far back as there is anything to show.
  const months = Array.from(monthly.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

  const thisKey = new Date(now).toISOString().slice(0, 7);
  const lastDate = new Date(now);
  lastDate.setUTCMonth(lastDate.getUTCMonth() - 1);
  const lastKey = lastDate.toISOString().slice(0, 7);
  const thisMonth = monthly.get(thisKey);
  const lastMonth = monthly.get(lastKey);

  // ── Profitability per project ──
  const jobs = new Map<string, JobRow>();

  for (const p of projects) {
    jobs.set(p.id, {
      projectId: p.id,
      projectName: p.name,
      clientName: clientName.get(p.client_id) ?? "Unknown client",
      received: 0, cost: 0, margin: 0, marginPct: null,
    });
  }

  let unallocatedCost = 0;
  let unallocatedRevenue = 0;
  const strayRow = (c: { direction: string | null; amount_gbp: number | null }) => {
    const amount = Number(c.amount_gbp) || 0;
    if (c.direction === "in") unallocatedRevenue += amount;
    else unallocatedCost += amount;
  };
  for (const c of costRows) {
    const job = c.project_id ? jobs.get(c.project_id) : undefined;
    if (!job) {
      strayRow(c);
      continue;
    }
    const amount = Number(c.amount_gbp) || 0;
    if (c.direction === "in") job.received += amount;
    else job.cost += amount;
  }

  const jobRows = Array.from(jobs.values())
    .filter((j) => j.cost > 0 || j.received > 0)
    .map((j) => {
      const margin = j.received - j.cost;
      return { ...j, margin, marginPct: j.received > 0 ? (margin / j.received) * 100 : null };
    })
    .sort((a, b) => b.cost + b.received - (a.cost + a.received));

  const totals = costRows.reduce(
    (acc, c) => {
      if (!c.date_paid) return acc;
      const amount = Number(c.amount_gbp) || 0;
      if (c.direction === "in") acc.revenue += amount;
      else if (c.cost_type === "cogs") acc.cogs += amount;
      else acc.operating += amount;
      return acc;
    },
    { revenue: 0, cogs: 0, operating: 0 },
  );

  return {
    allowed: true,
    ledgerCurrency: "GBP",
    invoiceCurrency: "USD",
    owed,
    owedOver30,
    owedDormant,
    oldestDays,
    buckets,
    receivables: Array.from(byClient.values()).sort((a, b) => b.total - a.total),
    months,
    jobs: jobRows,
    unallocatedCost,
    unallocatedRevenue,
    totalRevenue: totals.revenue,
    totalCogs: totals.cogs,
    totalOperating: totals.operating,
    receivedThisMonth: thisMonth?.revenue ?? 0,
    spentThisMonth: (thisMonth?.cogs ?? 0) + (thisMonth?.operating ?? 0),
    receivedLastMonth: lastMonth?.revenue ?? 0,
    spentLastMonth: (lastMonth?.cogs ?? 0) + (lastMonth?.operating ?? 0),
  };
}
