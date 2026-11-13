// ─────────────────────────────────────────────────────────────
// What a client amounts to, in one place.
//
// The figures on a client's home have to agree with the invoice list and
// the finance page, so the arithmetic lives here rather than being done
// again in a component. Totals are never stored — an invoice is its line
// items — so everything is derived through sumInvoice, the same way the
// dashboard derives it.
//
// Two currencies are deliberately kept apart. Invoices are in US dollars
// because that is what factories quote; costs are recorded in pounds.
// Adding them would produce a number that is true in neither, so they
// are reported separately and labelled.
//
// Pure helpers — no "use server" here.
// ─────────────────────────────────────────────────────────────

import { sumInvoice } from "./invoice-total";
import type { SavedInvoice } from "./data";

export interface ClientMoney {
  /** Billed and gone out: sent or paid, at the share each invoice bills. */
  invoicedUsd: number;
  /** Of that, settled. */
  paidUsd: number;
  /** Sent and still owed. */
  outstandingUsd: number;
  /** Built but not sent, so not owed by anybody yet. */
  draftUsd: number;
  /** Recorded spend, in pounds — not comparable with the figures above. */
  costGbp: number;
  /** How many invoices make up each of the figures. */
  counts: { all: number; draft: number; sent: number; paid: number };
}

/**
 * What one invoice actually bills.
 *
 * A production invoice can bill a deposit, and its balance invoice
 * carries the same line items with the percentage inverted — so the
 * share has to be applied or a half-billed project counts twice.
 */
export function invoiceBilled(invoice: SavedInvoice): number {
  const total = sumInvoice(invoice.line_items);
  const share = Number(invoice.deposit_percent ?? 100);
  const pct = Number.isFinite(share) ? Math.max(0, Math.min(100, share)) : 100;
  return Math.round(total * (pct / 100) * 100) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summariseClientMoney(
  invoices: SavedInvoice[],
  costsGbp: number[],
): ClientMoney {
  let invoicedUsd = 0;
  let paidUsd = 0;
  let draftUsd = 0;
  const counts = { all: invoices.length, draft: 0, sent: 0, paid: 0 };

  for (const inv of invoices) {
    const billed = invoiceBilled(inv);
    if (inv.status === "paid") {
      counts.paid += 1;
      invoicedUsd += billed;
      paidUsd += billed;
    } else if (inv.status === "draft") {
      counts.draft += 1;
      draftUsd += billed;
    } else {
      // Sent, parked, or anything else that is not a draft: it has gone
      // to the client, so it has been billed.
      counts.sent += 1;
      invoicedUsd += billed;
    }
  }

  return {
    invoicedUsd: round2(invoicedUsd),
    paidUsd: round2(paidUsd),
    outstandingUsd: round2(invoicedUsd - paidUsd),
    draftUsd: round2(draftUsd),
    costGbp: round2(costsGbp.reduce((s, n) => s + (Number.isFinite(n) ? n : 0), 0)),
    counts,
  };
}

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatGbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Tech packs ───────────────────────────────────────────────

export interface ClientTechpack {
  id: string;
  productId: string;
  productName: string | null;
  version: number;
  title: string | null;
  fileName: string | null;
  fileUrl: string | null;
  agencySignedAt: string | null;
  clientSignedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
}

/**
 * Where a tech pack has got to, in the words used on the product page.
 *
 * Both signatures matter: a tech pack is what a sample gets cut from, so
 * "signed by both" is the state that lets work start.
 */
export function techpackState(tp: ClientTechpack): string {
  if (tp.supersededAt) return "Superseded";
  if (tp.agencySignedAt && tp.clientSignedAt) return "Signed by both";
  if (tp.agencySignedAt) return "Awaiting client signature";
  if (tp.clientSignedAt) return "Awaiting our signature";
  return "Unsigned";
}

/** Newest version first, and superseded ones last whatever their date. */
export function sortTechpacks(packs: ClientTechpack[]): ClientTechpack[] {
  return packs.slice().sort((a, b) => {
    if (!!a.supersededAt !== !!b.supersededAt) return a.supersededAt ? 1 : -1;
    const byName = (a.productName ?? "").localeCompare(b.productName ?? "");
    if (byName !== 0) return byName;
    return b.version - a.version;
  });
}
