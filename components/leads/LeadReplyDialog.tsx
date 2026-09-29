"use client";

import { EmailDraftDialog } from "@/components/email/EmailDraftDialog";
import { draftLeadReply, sendLeadReply } from "@/app/(app)/leads/actions";
import type { LeadReplyKind } from "@/lib/email/templates";

const TITLE: Record<LeadReplyKind, string> = {
  acknowledge: "Thank them",
  more_info: "Ask for more detail",
  book_call: "Set up a call",
};

const INTRO: Record<LeadReplyKind, string> = {
  acknowledge:
    "Confirms we've got it and says when we'll come back. Worth adding a line about what they actually sent — it is the difference between a receipt and a reply.",
  more_info:
    "For a brief too thin to act on. Say what you'd need from this one specifically if you can; a named gap gets answered far more often than a list does.",
  book_call:
    "Sends your booking link. Worth naming one thing from their brief you want to get into — it turns a calendar link into a reason to pick a slot.",
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
  return (
    <EmailDraftDialog
      title={TITLE[kind]}
      intro={INTRO[kind]}
      footnote="Plain text — a blank line starts a new paragraph. It goes out on the Source Archive letterhead, and sending marks the lead contacted."
      loadDraft={() => draftLeadReply(leadId, kind)}
      send={(subject, body) => sendLeadReply({ leadId, kind, subject, body })}
      onClose={onClose}
      onSent={onSent}
    />
  );
}
