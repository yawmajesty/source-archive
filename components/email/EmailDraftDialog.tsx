"use client";

import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Read it before it goes.
//
// Every message we send by hand goes through here: the draft is built on
// the server, shown in full, and nothing leaves until someone presses
// send. The dialog knows nothing about leads or invoices — it is handed a
// way to load a draft and a way to send one, which is what lets the same
// three fields serve every kind of reply.
// ─────────────────────────────────────────────────────────────

export function EmailDraftDialog({
  title,
  intro,
  sendLabel = "Send it",
  footnote,
  loadDraft,
  send,
  onClose,
  onSent,
}: {
  title: string;
  intro: string;
  sendLabel?: string;
  footnote?: string;
  loadDraft: () => Promise<
    { success: true; to: string; draft: { subject: string; body: string } } | { success: false; error: string }
  >;
  send: (subject: string, body: string) => Promise<{ success: true; to: string } | { success: false; error: string }>;
  onClose: () => void;
  onSent?: (to: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const res = await loadDraft();
      if (!live) return;
      setLoading(false);
      if (!res.success) { setError(res.error); return; }
      setTo(res.to);
      setSubject(res.draft.subject);
      setBody(res.draft.body);
    })();
    return () => { live = false; };
    // The loader closes over the id it needs; re-running on its identity
    // would refetch every render and throw away whatever has been typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setSending(true); setError(null);
    const res = await send(subject, body);
    setSending(false);
    if (!res.success) { setError(res.error); return; }
    onSent?.(res.to);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-[var(--sa-window)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--sa-border)] px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[var(--sa-text-primary)]">{title}</p>
            <p className="truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
              {loading ? "Loading the draft…" : to ? `To ${to}` : "No address on file"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">Building the draft…</p>
          ) : (
            <>
              <p className="text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">{intro}</p>

              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                Subject
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              />

              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                className="mt-1 w-full resize-y rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] p-3 text-[13px] leading-relaxed text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              />
              <p className="mt-1.5 text-[11px] text-[var(--sa-text-tertiary)]">
                {footnote ?? "Plain text — a blank line starts a new paragraph. It goes out on the Source Archive letterhead."}
              </p>
            </>
          )}

          {error && <p className="mt-2 text-[12px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--sa-border)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[12.5px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || sending || !subject.trim() || !body.trim()}
            className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-50"
          >
            <Send size={12} /> {sending ? "Sending…" : sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
