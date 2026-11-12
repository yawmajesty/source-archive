"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, Download, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { downloadInvoicePDF } from "@/lib/invoice-pdf";
import { getExchangeRate } from "@/lib/fx-actions";
import { getInvoiceForExport, type InvoiceExportBundle } from "@/app/(app)/invoices/actions";
import {
  BASE_CURRENCY, FALLBACK_RATES, INVOICE_CURRENCIES, convert, currencyMeta,
  formatAmount, rateNote, type ExportCurrency, type InvoiceCurrency,
} from "@/lib/invoice-currency";
import { sumInvoice } from "@/lib/invoice-total";

// ─────────────────────────────────────────────────────────────
// Exporting a finished invoice in someone else's currency.
//
// The invoice itself does not change. It was raised in dollars, it stays
// in dollars, and the figure in the database is the one the books are kept
// on. What changes is the piece of paper: the same invoice, read out in
// pounds, with the rate and the date printed on it so the number can be
// checked by whoever receives it.
//
// The rate is looked up live from the European Central Bank's daily
// reference rate, and it is editable — if the bank gave a different rate
// on the day, that is the rate that should appear.
// ─────────────────────────────────────────────────────────────

export function InvoiceExportDialog({
  invoiceId, onClose,
}: {
  invoiceId: string | null;
  onClose: () => void;
}) {
  const [bundle, setBundle] = useState<InvoiceExportBundle | null>(null);
  // Opens on the currency the invoice was raised in, so this is also the
  // plain "download the PDF" path and changing currency is a deliberate act.
  const [currency, setCurrency] = useState<InvoiceCurrency>(BASE_CURRENCY);
  const [rateText, setRateText] = useState("");
  const [asOf, setAsOf] = useState<string>("");
  const [source, setSource] = useState<"live" | "manual">("live");
  const [lookingUp, setLookingUp] = useState(false);
  const [rateProblem, setRateProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load the invoice ──
  useEffect(() => {
    if (!invoiceId) return;
    let live = true;
    setBundle(null);
    setError(null);
    getInvoiceForExport(invoiceId).then((res) => {
      if (!live) return;
      setBundle(res);
      if (res.error) setError(res.error);
    });
    return () => { live = false; };
  }, [invoiceId]);

  // ── Look the rate up whenever the currency changes ──
  const lookUp = useCallback(async (code: InvoiceCurrency) => {
    if (code === BASE_CURRENCY) {
      setRateText("1"); setAsOf(""); setSource("live"); setRateProblem(null);
      return;
    }
    setLookingUp(true);
    setRateProblem(null);
    const res = await getExchangeRate(code);
    setLookingUp(false);
    if (res.rate == null) {
      // Not a failure the person can do anything about, so it is phrased as
      // a prompt rather than an error, and a usable number is already in
      // the box.
      setRateText(String(FALLBACK_RATES[code]));
      setAsOf(new Date().toISOString().slice(0, 10));
      setSource("manual");
      setRateProblem(`${res.error ?? "No rate available."} Check this against your bank before sending.`);
      return;
    }
    setRateText(String(res.rate));
    setAsOf(res.asOf ?? new Date().toISOString().slice(0, 10));
    setSource("live");
  }, []);

  useEffect(() => {
    if (!invoiceId) return;
    lookUp(currency);
  }, [invoiceId, currency, lookUp]);

  const rate = Number(rateText);
  const rateUsable = Number.isFinite(rate) && rate > 0;

  // Typing over a fetched rate flips `source` to manual in the change
  // handler, because the line printed on the invoice has to say where the
  // number came from — and "ECB reference rate" stops being true the moment
  // someone edits it.
  const exp: ExportCurrency = {
    currency,
    rate: rateUsable ? rate : 1,
    asOf,
    source,
  };

  const totalUsd = bundle?.invoice ? sumInvoice(bundle.invoice.line_items) : 0;
  const deposit = bundle?.invoice?.deposit_percent ?? 100;
  const isProduction = bundle?.invoice?.invoice_kind === "production";
  const dueUsd = isProduction ? totalUsd * (deposit / 100) : totalUsd;

  async function download() {
    if (!bundle?.invoice || !bundle.client || !bundle.agencySettings) return;
    setBusy(true);
    setError(null);
    try {
      await downloadInvoicePDF(bundle.invoice, bundle.client, bundle.agencySettings, exp);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The PDF could not be built.");
    } finally {
      setBusy(false);
    }
  }

  const meta = currencyMeta(currency);
  const loading = !!invoiceId && !bundle;

  return (
    <Dialog open={!!invoiceId} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-md bg-[var(--sa-window)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--sa-text-primary)]">Export this invoice</DialogTitle>
        </DialogHeader>

        <div className="grid min-w-0 gap-3 pt-1">
          {loading ? (
            <p className="py-3 text-[12px] text-[var(--sa-text-tertiary)]">Loading the invoice…</p>
          ) : !bundle?.invoice ? (
            <p className="py-3 text-[12px] text-[var(--sa-danger)]">{error ?? "That invoice could not be opened."}</p>
          ) : (
            <>
              <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2">
                <p className="text-[12px] font-medium text-[var(--sa-text-primary)]">
                  {bundle.invoice.title ?? (isProduction ? "Production invoice" : `Sampling invoice — round ${bundle.invoice.round}`)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--sa-text-tertiary)]">
                  {bundle.client?.name} · raised {new Date(bundle.invoice.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {formatAmount(dueUsd, "USD")}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                  Export in
                </label>
                <div className="flex gap-1.5">
                  {INVOICE_CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className={[
                        "flex-1 rounded-lg border py-2 text-[12px] font-medium transition-colors",
                        currency === c.code
                          ? "border-[var(--sa-accent)] bg-[var(--sa-accent)] text-white"
                          : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
                      ].join(" ")}
                      title={c.label}
                    >
                      {c.symbol} {c.code}
                    </button>
                  ))}
                </div>
              </div>

              {currency !== BASE_CURRENCY && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                    Rate
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[13px] text-[var(--sa-text-secondary)]">$1 =</span>
                    <span className="shrink-0 text-[13px] text-[var(--sa-text-secondary)]">{meta.symbol}</span>
                    <input
                      value={rateText}
                      onChange={(e) => { setRateText(e.target.value); setSource("manual"); }}
                      inputMode="decimal"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                    />
                    {lookingUp && <Loader2 size={13} className="shrink-0 animate-spin text-[var(--sa-text-tertiary)]" />}
                  </div>
                  {rateProblem ? (
                    <p className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">{rateProblem}</p>
                  ) : (
                    <p className="mt-1 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">
                      {source === "live"
                        ? `European Central Bank, ${asOf ? new Date(`${asOf}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "today"}. Change it if your bank gave you a different one.`
                        : "Your own rate. It will be printed on the invoice."}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-[var(--sa-text-secondary)]">
                    {isProduction && deposit < 100 ? `Due now (${deposit}% deposit)` : "Total"}
                  </span>
                  <span className="font-mono text-[16px] font-bold text-[var(--sa-text-primary)]">
                    {rateUsable ? formatAmount(convert(dueUsd, exp), currency) : "—"}
                  </span>
                </div>
                {currency !== BASE_CURRENCY && rateUsable && (
                  <p className="mt-1 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
                    {rateNote(exp)}
                  </p>
                )}
              </div>

              {error && <p className="text-[12px] text-[var(--sa-danger)]">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] transition-colors hover:bg-[var(--sa-hover)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={download}
                  disabled={busy || !rateUsable}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {busy ? "Building…" : "Download PDF"}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The button that opens it, so both call sites look the same. */
export function InvoiceExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Export in another currency"
      className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text-secondary)] transition-colors hover:bg-[var(--sa-hover)]"
    >
      <ArrowRightLeft size={11} />
      <span className="hidden sm:inline">Currency</span>
    </button>
  );
}
