"use client";

import { useEffect, useState } from "react";
import { X, Check, Ban, Loader2 } from "lucide-react";
import { BRIEF_TEXT_FIELDS, SLOT_LABEL, type ProductBrief, type BriefMedia } from "@/lib/product-brief";
import { declineDefaultBody } from "@/lib/email/templates";
import { getBriefById, decideBrief } from "@/app/(app)/products/[id]/brief-actions";
import type { BriefReply } from "@/app/portal/[clientId]/product-brief-actions";

/**
 * Read a brief properly before answering it.
 *
 * Deciding from a one-line row on a dashboard is how a good brief gets
 * turned down by accident. This shows the whole thing — every answer,
 * every photo, every caption — and only then offers the two buttons.
 */
export function BriefReviewer({
  briefId, onClose, onDecided,
}: {
  briefId: string;
  onClose: () => void;
  onDecided: (id: string, decision: "accepted" | "declined") => void;
}) {
  const [data, setData] = useState<{
    brief: ProductBrief; media: BriefMedia[]; replies: BriefReply[]; clientName: string;
  } | null>(null);
  const [mode, setMode] = useState<"read" | "accepted" | "declined">("read");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBriefById(briefId).then((d) => {
      if (!d) { setError("Couldn't open this brief"); return; }
      setData(d);
    });
  }, [briefId]);

  useEffect(() => {
    if (!data || mode === "read") return;
    setBody(
      mode === "declined"
        ? declineDefaultBody({
            name: data.brief.submitted_by_name ?? data.clientName,
            productName: data.brief.name,
            // The pricing calculator is a real page, so the offer of help
            // is a working link rather than a placeholder to remember.
            calculatorUrl: `${window.location.origin}/price`,
          })
        : `Hi${data.brief.submitted_by_name ? ` ${data.brief.submitted_by_name.split(" ")[0]}` : ""},\n\n` +
          `Thanks for sending ${data.brief.name} over — we're taking it on.\n\n` +
          `It's in your collection now and you'll see it move as we go. We'll come back to you ` +
          `shortly with fabric options and a price.\n\nBest,\n`,
    );
  }, [mode, data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[var(--sa-window)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--sa-border)] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-[var(--sa-text-primary)]">
              {data?.brief.name ?? "Loading…"}
            </p>
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">
              {data
                ? `${data.clientName} · briefed by ${data.brief.submitted_by_name || "them"}`
                : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]">
            <X size={18} />
          </button>
        </div>

        {error && <p className="px-5 py-2 text-[12.5px] text-red-500">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!data ? (
            <p className="text-[13px] text-[var(--sa-text-tertiary)]">Loading…</p>
          ) : mode === "read" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {[
                  data.brief.category,
                  data.brief.size_range,
                  ...(data.brief.fit_type ?? []),
                  data.brief.target_quantity ? `${data.brief.target_quantity} units` : null,
                  data.brief.target_price ? `target ${data.brief.currency} ${data.brief.target_price}` : null,
                  data.brief.needed_by ? `needed by ${data.brief.needed_by}` : null,
                ]
                  .filter(Boolean)
                  .map((chip) => (
                    <span
                      key={String(chip)}
                      className="rounded-md bg-[var(--sa-hover)] px-2 py-1 text-[12px] text-[var(--sa-text-secondary)]"
                    >
                      {String(chip)}
                    </span>
                  ))}
              </div>

              {BRIEF_TEXT_FIELDS.map((f) => {
                const text = data.brief[f.key] as string | null;
                const shots = data.media.filter((m) => m.slot === f.slot);
                if (!text && shots.length === 0) return null;
                return (
                  <div key={f.key as string} className="border-t border-[var(--sa-border)] pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                      {f.label}
                    </p>
                    {text && (
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">
                        {text}
                      </p>
                    )}
                    {shots.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {shots.map((m) => (
                          <div key={m.id} className="w-[130px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.image_url}
                              alt={m.note ?? SLOT_LABEL[m.slot] ?? "Reference"}
                              className="h-[130px] w-[130px] rounded-lg object-cover"
                            />
                            {m.note && (
                              <p className="mt-1 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">
                                {m.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {data.brief.notes && (
                <div className="border-t border-[var(--sa-border)] pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                    Anything else
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">
                    {data.brief.notes}
                  </p>
                </div>
              )}

              {data.replies.length > 0 && (
                <div className="border-t border-[var(--sa-border)] pt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                    Conversation
                  </p>
                  {data.replies.map((r) => (
                    <div
                      key={r.id}
                      className="mb-1.5 rounded-lg p-2.5"
                      style={{ background: r.side === "agency" ? "var(--sa-selected)" : "var(--sa-hover)" }}
                    >
                      <p className="text-[11px] font-medium text-[var(--sa-text-tertiary)]">
                        {r.side === "agency" ? r.author_name || "Us" : r.author_name || "Them"}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-[var(--sa-text-primary)]">
                        {r.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[12.5px] text-[var(--sa-text-secondary)]">
                {mode === "declined"
                  ? "Edit this before it goes. A sentence about their actual product is the difference between a form letter and a reason to come back."
                  : "This is what they'll get. Change anything you like."}
              </p>
              <textarea
                className="mt-2 w-full resize-y rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3 text-[13px] leading-relaxed text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                rows={16}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              {mode === "declined" && (
                <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
                  Replace the [link] placeholders with real ones — a decline with dead links is worse
                  than a decline without them.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--sa-border)] px-5 py-3">
          {mode === "read" ? (
            <>
              <button
                onClick={() => setMode("accepted")}
                className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white"
              >
                <Check size={13} /> Take it on
              </button>
              <button
                onClick={() => setMode("declined")}
                className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-3.5 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:border-red-300 hover:text-red-500"
              >
                <Ban size={13} /> Turn it down
              </button>
              <div className="flex-1" />
              {data?.brief.product_id && (
                <a
                  href={`/products/${data.brief.product_id}`}
                  className="text-[12.5px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)]"
                >
                  Open the product
                </a>
              )}
            </>
          ) : (
            <>
              <button
                disabled={busy || !body.trim()}
                onClick={async () => {
                  setBusy(true); setError(null);
                  const res = await decideBrief({ briefId, decision: mode, body });
                  setBusy(false);
                  if (!res.success) { setError(res.error); return; }
                  onDecided(briefId, mode);
                }}
                className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: mode === "accepted" ? "var(--sa-accent)" : "#B4453C" }}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {busy ? "Sending…" : mode === "accepted" ? "Accept and send" : "Decline and send"}
              </button>
              <button
                onClick={() => setMode("read")}
                className="text-[12.5px] text-[var(--sa-text-secondary)]"
              >
                Back to the brief
              </button>
              <div className="flex-1" />
              <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                {mode === "declined"
                  ? "The product is removed from their collection if nothing's happened to it yet"
                  : "It stays in their collection and they'll see it move"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
