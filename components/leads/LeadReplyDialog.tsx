"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { EmailDraftDialog } from "@/components/email/EmailDraftDialog";
import { draftLeadReply, sendLeadReply } from "@/app/(app)/leads/actions";
import { DECLINE_REASONS, type DeclineReason, type LeadReplyKind } from "@/lib/email/templates";

const TITLE: Record<LeadReplyKind, string> = {
  acknowledge: "Thank them",
  more_info: "Ask for more detail",
  book_call: "Set up a call",
  decline: "Say no",
};

const INTRO: Record<LeadReplyKind, string> = {
  acknowledge:
    "Confirms we've got it and says when we'll come back. Worth adding a line about what they actually sent — it is the difference between a receipt and a reply.",
  more_info:
    "For a brief too thin to act on. Say what you'd need from this one specifically if you can; a named gap gets answered far more often than a list does.",
  book_call:
    "Sends your booking link. Worth naming one thing from their brief you want to get into — it turns a calendar link into a reason to pick a slot.",
  decline:
    "Says no, why, and what to do next. The third part is what brings them back when the timing is right, so it's worth keeping even if you cut everything else.",
};

export function LeadReplyDialog({
  leadId,
  kind,
  onClose,
  onSent,
}: {
  leadId: string;
  kind: LeadReplyKind;
  onClose: () => void;
  onSent?: (to: string) => void;
}) {
  // A decline needs to know which no it is before there is anything to draft,
  // because the three say genuinely different things.
  const [reason, setReason] = useState<DeclineReason | null>(null);

  if (kind === "decline" && !reason) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[460px] overflow-hidden rounded-t-2xl bg-[var(--sa-window)] shadow-xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-[var(--sa-border)] px-5 py-3.5">
            <p className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--sa-text-primary)]">
              Why are we passing?
            </p>
            <button onClick={onClose} aria-label="Close"
              className="shrink-0 rounded-md p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
              <X size={15} />
            </button>
          </div>
          <div className="px-5 py-4">
            <p className="mb-3 text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
              Each one writes a different email. You can change every word before it goes.
            </p>
            <div className="flex flex-col gap-2">
              {DECLINE_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className="rounded-lg border border-[var(--sa-border)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--sa-hover)]"
                >
                  <span className="block text-[13px] font-medium text-[var(--sa-text-primary)]">{r.label}</span>
                  <span className="block text-[11.5px] leading-snug text-[var(--sa-text-tertiary)]">{r.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmailDraftDialog
      title={TITLE[kind]}
      intro={INTRO[kind]}
      sendLabel={kind === "decline" ? "Send the decline" : "Send it"}
      footnote={
        "Plain text — a blank line starts a new paragraph. It goes out on the Source Archive " +
        (kind === "decline" ? "letterhead, and sending marks the lead lost." : "letterhead, and sending marks the lead contacted.")
      }
      loadDraft={() => draftLeadReply(leadId, kind, reason ?? undefined)}
      send={(subject, body) => sendLeadReply({ leadId, kind, subject, body })}
      onClose={onClose}
      onSent={onSent}
    />
  );
}
