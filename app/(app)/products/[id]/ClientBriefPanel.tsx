"use client";

import { useState } from "react";
import { MessageSquare, Send, FileText } from "lucide-react";
import { BRIEF_TEXT_FIELDS, SLOT_LABEL, type ProductBrief, type BriefMedia } from "@/lib/product-brief";
import type { BriefReply } from "@/app/portal/[clientId]/product-brief-actions";
import { replyToBrief } from "./brief-actions";

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * What the client asked for, and the conversation about it.
 *
 * Shown beside the product rather than instead of it: the product is
 * what gets built and edited, the brief is what was asked for, and
 * having both on one screen is the whole point when they disagree.
 */
export function ClientBriefPanel({
  brief, media, replies: initialReplies, canReply,
}: {
  brief: ProductBrief;
  media: BriefMedia[];
  replies: BriefReply[];
  canReply: boolean;
}) {
  const [replies, setReplies] = useState(initialReplies);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  const waiting = replies.length === 0 || replies[replies.length - 1]?.side === "client";

  return (
    <div className="rounded-xl border border-[var(--sa-border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FileText size={15} className="text-[var(--sa-text-tertiary)]" />
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Client brief</p>
        {waiting && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: "rgba(255,149,0,.14)", color: "var(--sa-warning)" }}
          >
            Needs a reply
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowBrief((s) => !s)}
          className="text-[12px] text-[var(--sa-accent)]"
        >
          {showBrief ? "Hide what they asked for" : "What they asked for"}
        </button>
      </div>

      <p className="mt-0.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
        Briefed by {brief.submitted_by_name || "the client"} · {when(brief.created_at)}
      </p>

      {showBrief && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-[var(--sa-border)] pt-3">
          {BRIEF_TEXT_FIELDS.map((f) => {
            const text = brief[f.key] as string | null;
            const shots = media.filter((m) => m.slot === f.slot);
            if (!text && shots.length === 0) return null;
            return (
              <div key={f.key as string}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                  {f.label}
                </p>
                {text && (
                  <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
                    {text}
                  </p>
                )}
                {shots.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {shots.map((m) => (
                      <div key={m.id} className="w-[92px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.image_url}
                          alt={m.note ?? SLOT_LABEL[m.slot] ?? "Reference"}
                          className="h-[92px] w-[92px] rounded-md object-cover"
                        />
                        {m.note && (
                          <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
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
          {(brief.target_quantity || brief.target_price || brief.needed_by) && (
            <p className="text-[12px] text-[var(--sa-text-secondary)]">
              {[
                brief.target_quantity ? `${brief.target_quantity} units` : null,
                brief.target_price ? `target ${brief.currency} ${brief.target_price}` : null,
                brief.needed_by ? `needed by ${brief.needed_by}` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* Thread */}
      <div className="mt-3 flex flex-col gap-2 border-t border-[var(--sa-border)] pt-3">
        {replies.length === 0 ? (
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">
            Nothing said yet. A reply here reaches them in the portal and by email.
          </p>
        ) : (
          replies.map((r) => (
            <div
              key={r.id}
              className="rounded-lg p-2.5"
              style={{
                background: r.side === "agency" ? "var(--sa-selected)" : "var(--sa-hover)",
              }}
            >
              <p className="text-[11px] font-medium text-[var(--sa-text-tertiary)]">
                {r.side === "agency" ? r.author_name || "Us" : r.author_name || "Client"} ·{" "}
                {when(r.created_at)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--sa-text-primary)]">
                {r.body}
              </p>
            </div>
          ))
        )}
      </div>

      {canReply && (
        <div className="mt-2.5">
          <textarea
            className="w-full resize-y rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] p-2.5 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            rows={3}
            placeholder="Reply to the client — the MOQ, what the fabric will cost, what you'd change."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              disabled={sending || !body.trim()}
              onClick={async () => {
                setSending(true); setError(null); setNotice(null);
                const res = await replyToBrief({ briefId: brief.id, body });
                setSending(false);
                if (!res.success) { setError(res.error); return; }
                setReplies((p) => [...p, res.reply]);
                setBody("");
                setNotice(
                  res.emailed === "sent"
                    ? "Sent, and they've been emailed."
                    : "Saved. They'll see it in the portal — the email is recorded but not delivered while email is off.",
                );
              }}
              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
            >
              <Send size={12} /> {sending ? "Sending…" : "Reply"}
            </button>
            <MessageSquare size={12} className="text-[var(--sa-text-tertiary)]" />
            <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
              Lands in their portal against this product
            </span>
          </div>
          {error && <p className="mt-1.5 text-[11.5px] text-red-500">{error}</p>}
          {notice && <p className="mt-1.5 text-[11.5px] text-[var(--sa-success)]">{notice}</p>}
        </div>
      )}
    </div>
  );
}
