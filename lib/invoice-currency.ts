// ─────────────────────────────────────────────────────────────
// Invoicing in a currency other than the one the work was priced in.
//
// Every invoice in this system is held in US dollars, because that is what
// the factories quote and what the line items store. But a London client
// settling a photography invoice wants a number in pounds, and their
// accountant wants to see the rate that produced it.
//
// So nothing is converted in the database. The invoice stays in dollars
// and the *export* is converted, with the rate and the day printed on the
// face of it. An invoice that says "£3,940.00, converted from USD at
// $1 = £0.7880 on 12 November 2026" can be checked by anyone. One that
// just says "£3,940.00" cannot.
//
// Pure helpers only — shared by the browser, the PDF builder and the
// server action that looks a rate up. Deliberately not a "use server"
// file: a const exported from one of those is dropped from the client
// bundle and arrives as undefined.
// ─────────────────────────────────────────────────────────────

export type InvoiceCurrency = "USD" | "GBP" | "EUR" | "CNY";

export interface CurrencyMeta {
  code: InvoiceCurrency;
  /** What goes in front of the number. */
  symbol: string;
  label: string;
  /**
   * Whether jsPDF's built-in Helvetica can draw the symbol. Its standard
   * fonts are WinAnsi, which covers $ £ ¥ € — but not every symbol a
   * currency list might grow, so each one says for itself rather than the
   * PDF quietly printing a box.
   */
  pdfSafeSymbol: boolean;
}

export const INVOICE_CURRENCIES: CurrencyMeta[] = [
  { code: "USD", symbol: "$", label: "US dollars", pdfSafeSymbol: true },
  { code: "GBP", symbol: "£", label: "Pounds sterling", pdfSafeSymbol: true },
  { code: "EUR", symbol: "€", label: "Euros", pdfSafeSymbol: true },
  { code: "CNY", symbol: "¥", label: "Chinese yuan", pdfSafeSymbol: true },
];

export const BASE_CURRENCY: InvoiceCurrency = "USD";

export function currencyMeta(code: InvoiceCurrency): CurrencyMeta {
  return INVOICE_CURRENCIES.find((c) => c.code === code) ?? INVOICE_CURRENCIES[0];
}

export function isInvoiceCurrency(value: unknown): value is InvoiceCurrency {
  return typeof value === "string" && INVOICE_CURRENCIES.some((c) => c.code === value);
}

/**
 * How an invoice is being exported: which currency, and at what rate.
 *
 * `rate` is units of `currency` for one US dollar — 0.788 for pounds, not
 * 1.2690. One direction, stated once, so nothing downstream has to guess
 * which way round it is.
 */
export interface ExportCurrency {
  currency: InvoiceCurrency;
  rate: number;
  /** The day the rate is good for, as an ISO date. */
  asOf: string;
  /** Where the rate came from, for the line printed on the invoice. */
  source: "live" | "manual";
}

/** The no-op: dollars at par, which is what every invoice already is. */
export const AS_INVOICED: ExportCurrency = {
  currency: "USD", rate: 1, asOf: "", source: "manual",
};

export function isConverted(exp: ExportCurrency | null | undefined): boolean {
  return !!exp && exp.currency !== BASE_CURRENCY;
}

/** A dollar amount in the export currency. Rounded to the cent, once. */
export function convert(usd: number, exp: ExportCurrency | null | undefined): number {
  if (!exp || exp.currency === BASE_CURRENCY) return usd;
  return Math.round(usd * exp.rate * 100) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The total of a set of dollar amounts, in the export currency.
 *
 * Deliberately converts each line and then adds, rather than adding and
 * then converting. Those two give different answers: each line is shown
 * rounded to the cent, and the rounding has to be included in the total or
 * the invoice prints a total that does not match the lines above it. On
 * this agency's own invoices that happened on four of twelve in pounds and
 * six of twelve in yuan, out by up to three cents — small enough to look
 * like an error and big enough to be queried.
 */
export function convertedSum(usdAmounts: number[], exp?: ExportCurrency | null): number {
  return round2(usdAmounts.reduce((sum, usd) => sum + convert(usd, exp), 0));
}

/** A share of a converted total — a deposit — kept on the cent. */
export function shareOf(convertedTotal: number, percent: number): number {
  return round2(convertedTotal * (percent / 100));
}

export function formatAmount(amount: number, code: InvoiceCurrency, opts?: { pdf?: boolean }): string {
  const meta = currencyMeta(code);
  const symbol = opts?.pdf && !meta.pdfSafeSymbol ? `${meta.code} ` : meta.symbol;
  return `${symbol}${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The one function every surface should use to put a dollar figure on an
 * invoice: it converts and formats in a single step, so no caller can do
 * one and forget the other.
 */
export function exportMoney(
  usd: number,
  exp: ExportCurrency | null | undefined,
  opts?: { pdf?: boolean },
): string {
  const code = exp?.currency ?? BASE_CURRENCY;
  return formatAmount(convert(usd, exp), code, opts);
}

/**
 * The sentence that goes on the invoice itself whenever it is not in
 * dollars. Without it the client has a number they cannot check.
 */
export function rateNote(exp: ExportCurrency | null | undefined): string | null {
  if (!isConverted(exp) || !exp) return null;
  const meta = currencyMeta(exp.currency);
  const day = exp.asOf
    ? new Date(`${exp.asOf}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;
  const rate = exp.rate.toLocaleString("en-GB", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const where = exp.source === "live" ? "European Central Bank reference rate" : "rate entered by hand";
  return `Invoiced in US dollars. Converted at $1 = ${meta.symbol}${rate}${day ? ` on ${day}` : ""} · ${where}.`;
}

/** A sensible rate to show while the live one is still loading, or if it never arrives. */
export const FALLBACK_RATES: Record<InvoiceCurrency, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  CNY: 7.1,
};
