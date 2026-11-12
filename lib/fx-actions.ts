"use server";

import { getAgencyContext } from "./agency-data";
import { isInvoiceCurrency, type InvoiceCurrency } from "./invoice-currency";

// ─────────────────────────────────────────────────────────────
// Today's exchange rate.
//
// From the Frankfurter service, which publishes the European Central
// Bank's daily reference rates. No key, no account, and the ECB is a
// source an accountant will accept without argument — which matters,
// because this number ends up printed on an invoice.
//
// Nothing about the agency, the client or the invoice is sent. The whole
// request is "USD to GBP"; the amount is converted here, afterwards.
//
// Soft on failure by design. If the rate cannot be fetched the dialog
// keeps working and the person types the rate their bank gave them — an
// invoice that cannot be exported because a third-party API is down would
// be a worse failure than a rate typed by hand.
// ─────────────────────────────────────────────────────────────

const ENDPOINT = "https://api.frankfurter.dev/v1/latest";

export interface RateLookup {
  rate: number | null;
  /** The ECB publishes one rate per working day; this is the day it is for. */
  asOf: string | null;
  error: string | null;
}

export async function getExchangeRate(to: InvoiceCurrency): Promise<RateLookup> {
  const ctx = await getAgencyContext();
  if (!ctx) return { rate: null, asOf: null, error: "You are not signed in." };

  if (!isInvoiceCurrency(to)) return { rate: null, asOf: null, error: "Unknown currency." };
  if (to === "USD") return { rate: 1, asOf: new Date().toISOString().slice(0, 10), error: null };

  try {
    const res = await fetch(`${ENDPOINT}?base=USD&symbols=${to}`, {
      // Rates move once a working day, so an hour-old answer is the same
      // answer — and this is called every time the dialog opens.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { rate: null, asOf: null, error: `The rate service answered ${res.status}.` };
    }

    const body: unknown = await res.json();
    const parsed = body as { date?: unknown; rates?: Record<string, unknown> };
    const raw = parsed?.rates?.[to];
    const rate = Number(raw);

    if (!Number.isFinite(rate) || rate <= 0) {
      return { rate: null, asOf: null, error: "The rate service sent something unreadable." };
    }

    const asOf = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : new Date().toISOString().slice(0, 10);

    return { rate, asOf, error: null };
  } catch {
    return { rate: null, asOf: null, error: "Couldn't reach the rate service." };
  }
}
