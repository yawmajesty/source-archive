"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Check, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import {
  getPriceNoticeTarget, notifyClientOfPriceChange,
} from "@/app/(app)/products/[id]/price-notify-actions";
import type { PriceNoticeTarget } from "@/lib/price-notify";

// ─────────────────────────────────────────────────────────────
// "You've changed a price the client can see. Tell them?"
//
// Appears the moment a client-facing price is saved and not a moment
// later, because the decision is only cheap while the change is still in
// the person's head. It is an offer rather than an automatic send: a typo
// corrected thirty seconds after it was made is not news, and nobody
// wants three emails about one afternoon's work.
//
// The figures come back from the server, not from the form that was just
// filled in. What a client is told a price moved to has to be what the
// database says it is.
// ─────────────────────────────────────────────────────────────

export function PriceChangeNotice({
  productId, fields, onClose,
}: {
  productId: string;
  /** Which client-facing price columns were just saved. */
  fields: string[];
  onClose: () => void;
}) {
  const [target, setTarget] = useState<PriceNoticeTarget | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getPriceNoticeTarget(productId, fields)
      .then((t) => { if (live) setTarget(t); })
      .catch(() => { if (live) setTarget(null); });
    return () => { live = false; };
    // fields is rebuilt on every render by the caller; the product and the
    // save it belongs to are what identify this prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Nothing worth a prompt: no client-visible figure actually moved.
  useEffect(() => {
    if (target && target.changes.length === 0) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  async function send() {
    setSending(true); setError(null);
    const res = await notifyClientOfPriceChange({ productId, fields, note });
    setSending(false);
    if (!res.success) { setError(res.error); return; }
    setSent(res.sent);
    setTimeout(onClose, 1600);
  }

  const loading = target == null;
  const changes = target?.changes ?? [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={sending ? undefined : onClose}
        className="fixed inset-0 z-40 bg-black/30"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-bg)] shadow-2xl"
        >
          <div className="flex items-start gap-2.5 px-5 py-4 panel-border-b border-b border-[var(--sa-border)]">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sa-hover)]">
              <Mail size={14} className="text-[var(--sa-accent)]" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">
                The price changed. Tell {target?.clientName ?? "the client"}?
              </h2>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--sa-text-tertiary)]">
                They won&apos;t hear about this unless you send it.
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            {loading ? (
              <p className="flex items-center gap-2 py-3 text-[12.5px] text-[var(--sa-text-tertiary)]">
                <Loader2 size={13} className="animate-spin" /> Working out what moved…
              </p>
            ) : sent != null ? (
              <p className="flex items-center gap-2 py-3 text-[13px] font-medium text-[var(--sa-success)]">
                <Check size={15} /> Sent to {sent} {sent === 1 ? "address" : "addresses"}.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {changes.map((c) => (
                    <div
                      key={c.label + c.after}
                      className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-2.5"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                        {c.label}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[12.5px]">
                        <span className="text-[var(--sa-text-tertiary)] line-through">{c.before}</span>
                        <ArrowRight size={11} className="shrink-0 text-[var(--sa-text-tertiary)]" />
                        <span className="font-semibold text-[var(--sa-text-primary)]">{c.after}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {target?.canSend ? (
                  <>
                    <div className="mt-3">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                        Add a line of your own (optional)
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="e.g. The mill put the shell fabric up this month."
                        className="w-full resize-none rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-2 text-[12.5px] text-[var(--sa-text-primary)] outline-none transition-colors placeholder:text-[var(--sa-text-tertiary)] focus:border-[var(--sa-accent)]"
                      />
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">
                      Goes to {target.recipients.join(", ")}
                    </p>
                  </>
                ) : (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--sa-hover)] px-3 py-2.5">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--sa-warning)]" />
                    <p className="text-[11.5px] leading-snug text-[var(--sa-text-secondary)]">
                      {target?.reason ?? "There's nobody to send this to."} The change is saved either way.
                    </p>
                  </div>
                )}

                {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
              </>
            )}
          </div>

          {sent == null && (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--sa-border)] px-5 py-3">
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-lg px-3 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] transition-colors hover:bg-[var(--sa-hover)] disabled:opacity-50"
              >
                {target?.canSend ? "Not this time" : "Close"}
              </button>
              {target?.canSend && (
                <button
                  onClick={send}
                  disabled={sending}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                  {sending ? "Sending…" : "Send the email"}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
