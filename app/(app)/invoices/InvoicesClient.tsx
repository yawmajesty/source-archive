"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Send, Check, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { lineAmount, money } from "@/lib/invoice-total";
import { setInvoiceStatus, draftInvoiceChase, sendInvoiceChase, archiveClient, type InvoiceRow } from "./actions";
import { useRouter, useSearchParams } from "next/navigation";
import { EmailDraftDialog } from "@/components/email/EmailDraftDialog";
import { ParkInvoiceDialog } from "@/components/dashboard/ParkDialog";
import { setInvoiceAside } from "@/app/(app)/dashboard/park-actions";

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: "Draft", bg: "var(--sa-hover)",       fg: "var(--sa-text-secondary)" },
  sent:  { label: "Sent",  bg: "rgba(255,149,0,.14)",   fg: "var(--sa-warning)" },
  paid:  { label: "Paid",  bg: "rgba(52,199,89,.14)",   fg: "var(--sa-success)" },
  // Owed, but deliberately not being chased. Without a label here it
  // rendered as a blank badge, which reads like a bug rather than a choice.
  parked: { label: "Set aside", bg: "var(--sa-hover)", fg: "var(--sa-text-tertiary)" },
};

export function InvoicesClient({ invoices: initial }: { invoices: InvoiceRow[] }) {
  const [invoices, setInvoices] = useState(initial);
  const [filter, setFilter] = useState<"outstanding" | "all" | "paid">("outstanding");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Arriving from the dashboard opens the invoice that was clicked.
  useEffect(() => {
    const hash = window.location.hash.replace("#inv-", "");
    if (!hash) return;
    setFilter("all");
    setOpen(hash);
    // The row may be far down a long list.
    requestAnimationFrame(() => {
      document.getElementById(`inv-${hash}`)?.scrollIntoView({ block: "center" });
    });
  }, []);

  const shown = useMemo(() => {
    if (filter === "all") return invoices;
    if (filter === "paid") return invoices.filter((i) => i.status === "paid");
    // An inactive client's unpaid invoice isn't chaseable work — it stays
    // in All, and stops shouting from Outstanding.
    return invoices.filter((i) => i.status !== "paid" && !i.client_inactive);
  }, [invoices, filter]);

  const outstanding = invoices.filter((i) => i.status === "sent" && !i.client_inactive);
  const owed = outstanding.reduce((s, i) => s + i.total, 0);

  async function patch(id: string, status: "draft" | "sent" | "paid") {
    setBusy(id); setError(null); setNotice(null);
    const res = await setInvoiceStatus(id, status);
    setBusy(null);
    if (!res.success) { setError(res.error ?? "Could not update"); return; }
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status, paid_at: status === "paid" ? new Date().toISOString() : null } : i,
      ),
    );
  }

  // The morning digest links here with ?chase=<id>. It opens the draft and
  // never sends: mail scanners and link previews fetch URLs in emails, so a
  // link that sent on its own would chase clients nobody meant to chase.
  const params = useSearchParams();
  const router = useRouter();
  const [chasing, setChasing] = useState<string | null>(null);
  const [chaseNote, setChaseNote] = useState<string | null>(null);
  const [parking, setParking] = useState<string | null>(null);

  useEffect(() => {
    const chase = params.get("chase");
    if (chase) setChasing(chase);
    const park = params.get("park");
    if (park) setParking(park);
  }, [params]);

  function closePark() {
    setParking(null);
    router.replace("/invoices");
  }

  function closeChase() {
    setChasing(null);
    // Drop the parameter so a refresh doesn't reopen it.
    router.replace("/invoices");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {parking && (
        <ParkInvoiceDialog
          invoiceId={parking}
          onClose={closePark}
          onDone={(msg) => { setChaseNote(msg); router.refresh(); }}
        />
      )}
      {chasing && (
        <EmailDraftDialog
          title="Chase this invoice"
          intro="Firm, not a solicitor's letter: it states the amount, links them to the portal to pay, and asks for a date if timing is the problem. Change anything before it goes."
          sendLabel="Send the chase"
          loadDraft={() => draftInvoiceChase(chasing)}
          send={(subject, body) => sendInvoiceChase({ invoiceId: chasing, subject, body })}
          onClose={closeChase}
          onSent={(to) => setChaseNote(`Chase sent to ${to}`)}
        />
      )}
      {chaseNote && (
        <div className="border-b border-[var(--sa-border)] px-6 py-2 text-[12px]" style={{ color: "var(--sa-success)" }}>
          {chaseNote}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--sa-border)] px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Invoices</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            {outstanding.length > 0
              ? `${money(owed)} outstanding across ${outstanding.length} invoice${outstanding.length === 1 ? "" : "s"}`
              : "Nothing outstanding"}
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["outstanding", "paid", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1.5 text-[12px] capitalize ${
                filter === f
                  ? "bg-[var(--sa-selected)] font-medium text-[var(--sa-accent)]"
                  : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {(error || notice) && (
        <p
          className={`border-b border-[var(--sa-border)] px-6 py-2 text-[12.5px] ${
            error ? "text-red-500" : "text-[var(--sa-success)]"
          }`}
        >
          {error ?? notice}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Receipt size={22} className="text-[var(--sa-text-tertiary)]" />
              <p className="mt-2.5 text-[13px] font-medium text-[var(--sa-text-primary)]">
                {filter === "outstanding" ? "Everything's been paid" : "Nothing here"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {shown.map((inv) => {
                const s = STATUS[inv.status] ?? STATUS.draft;
                const isOpen = open === inv.id;
                const stale = inv.status === "sent" && inv.ageDays > 14;
                return (
                  <div
                    key={inv.id}
                    id={`inv-${inv.id}`}
                    className="overflow-hidden rounded-xl border bg-[var(--sa-window)]"
                    style={{
                      borderColor: isOpen ? "var(--sa-accent)" : "var(--sa-border)",
                    }}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : inv.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--sa-hover)]"
                    >
                      {isOpen ? (
                        <ChevronDown size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
                      ) : (
                        <ChevronRight size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
                      )}
                      <span className="min-w-0 flex-1">
                        {/* The brand leads. Every row here is an invoice —
                            whose it is, is the thing being scanned for. */}
                        <span className="block truncate text-[15px] font-semibold text-[var(--sa-text-primary)]">
                          {inv.client_name}
                        </span>
                        <span className="block truncate text-[12px] text-[var(--sa-text-secondary)]">
                          {inv.title || `Invoice · round ${inv.round ?? 1}`}
                          {inv.invoice_kind ? ` · ${inv.invoice_kind}` : ""}
                          {inv.status === "sent" ? ` · sent ${inv.ageDays}d ago` : ""}
                          {inv.paid_at ? ` · paid ${new Date(inv.paid_at).toLocaleDateString("en-GB")}` : ""}
                        </span>
                      </span>
                      {inv.client_inactive && (
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: "var(--sa-hover)", color: "var(--sa-text-tertiary)" }}
                        >
                          Inactive
                        </span>
                      )}
                      {stale && !inv.client_inactive && (
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: "rgba(255,59,48,.12)", color: "var(--sa-danger)" }}
                        >
                          Chase
                        </span>
                      )}
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--sa-text-primary)]">
                        {money(inv.total)}
                      </span>
                      <span
                        className="w-[52px] shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: s.bg, color: s.fg }}
                      >
                        {s.label}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[var(--sa-border)] px-4 py-3">
                        {inv.line_items.length === 0 ? (
                          <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">
                            No line items on this invoice.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {inv.line_items.map((li, i) => (
                              <div key={i} className="flex items-baseline gap-3 py-0.5">
                                <span className="min-w-0 flex-1 text-[12.5px] text-[var(--sa-text-primary)]">
                                  {String(li.name ?? li.description ?? "Item")}
                                  {li.category ? (
                                    <span className="ml-1.5 text-[11px] text-[var(--sa-text-tertiary)]">
                                      {String(li.category)}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--sa-text-secondary)]">
                                  {money(lineAmount(li))}
                                </span>
                              </div>
                            ))}
                            <div className="mt-1 flex items-baseline justify-between border-t border-[var(--sa-border)] pt-1.5">
                              <span className="text-[12.5px] font-medium text-[var(--sa-text-primary)]">Total</span>
                              <span className="text-[14px] font-semibold tabular-nums text-[var(--sa-text-primary)]">
                                {money(inv.total)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {inv.status !== "paid" && (
                            <button
                              disabled={busy === inv.id}
                              onClick={() => patch(inv.id, "paid")}
                              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
                            >
                              <Check size={12} /> Mark paid
                            </button>
                          )}
                          {inv.status === "sent" && (
                            <>
                              <button
                                onClick={() => { setError(null); setNotice(null); setChasing(inv.id); }}
                                className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                              >
                                <Send size={12} /> Send a reminder
                              </button>
                              <button
                                onClick={() => { setError(null); setNotice(null); setParking(inv.id); }}
                                className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                              >
                                Stop chasing
                              </button>
                            </>
                          )}
                          {inv.status === "parked" && (
                            <button
                              disabled={busy === inv.id}
                              onClick={async () => {
                                setBusy(inv.id); setError(null); setNotice(null);
                                const res = await setInvoiceAside(inv.id, false);
                                setBusy(null);
                                if (!res.success) { setError(res.error); return; }
                                setNotice("Back in what you're chasing.");
                                router.refresh();
                              }}
                              className="rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
                            >
                              Start chasing again
                            </button>
                          )}
                          {inv.status === "draft" && (
                            <button
                              disabled={busy === inv.id}
                              onClick={() => patch(inv.id, "sent")}
                              className="rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                            >
                              Mark as sent
                            </button>
                          )}
                          {inv.status === "paid" && (
                            <button
                              disabled={busy === inv.id}
                              onClick={() => patch(inv.id, "sent")}
                              className="rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                            >
                              Not actually paid
                            </button>
                          )}
                          <button
                            disabled={busy === inv.id}
                            onClick={async () => {
                              if (!confirm(`Mark ${inv.client_name} inactive? Their invoices drop out of Outstanding and their work stops competing for attention. Nothing is deleted.`)) return;
                              setBusy(inv.id); setError(null); setNotice(null);
                              const res = await archiveClient(inv.client_id);
                              setBusy(null);
                              if (!res.success) { setError(res.error ?? "Could not update"); return; }
                              setInvoices((prev) =>
                                prev.map((x) => (x.client_id === inv.client_id ? { ...x, client_inactive: true } : x)),
                              );
                              setNotice(`${inv.client_name} is now inactive. Reactivate them on their client page.`);
                            }}
                            className="rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
                          >
                            Client is inactive
                          </button>
                          <div className="flex-1" />
                          <Link
                            href={`/clients/${inv.client_id}`}
                            className="text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)]"
                          >
                            The client
                          </Link>
                          <a
                            href={`/portal/${inv.client_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)]"
                          >
                            <ExternalLink size={11} /> As they see it
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
