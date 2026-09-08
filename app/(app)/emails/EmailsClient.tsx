"use client";

import { useMemo, useState } from "react";
import { Mail, TriangleAlert, X, Check } from "lucide-react";
import { setNotificationEmail, type EmailRow } from "./actions";

const TEMPLATE_LABEL: Record<string, string> = {
  brief_received_client: "Brief — confirmation to them",
  brief_received_admin: "Brief — alert to you",
  enquiry_received_client: "Enquiry — confirmation to them",
  enquiry_received_admin: "Enquiry — alert to you",
  techpack_received_client: "Tech pack — confirmation to them",
  techpack_received_admin: "Tech pack — alert to you",
  stage_update_client: "Stage update to client",
};

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  sent:    { label: "Sent",       bg: "rgba(52,199,89,0.12)", fg: "var(--sa-success)" },
  queued:  { label: "Queued",     bg: "var(--sa-hover)",      fg: "var(--sa-text-secondary)" },
  failed:  { label: "Failed",     bg: "rgba(255,59,48,0.12)", fg: "var(--sa-danger)" },
  skipped: { label: "Not sent",   bg: "rgba(255,149,0,0.12)", fg: "var(--sa-warning)" },
};

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function EmailsClient({
  rows, configured, counts, notificationEmail, missingEmail,
}: {
  rows: EmailRow[];
  configured: boolean;
  counts: Record<string, number>;
  notificationEmail: string;
  missingEmail: Array<{ id: string; name: string }>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<EmailRow | null>(null);
  const [notify, setNotify] = useState(notificationEmail);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  async function saveNotify() {
    setError(null);
    const res = await setNotificationEmail(notify);
    if (!res.success) { setError(res.error); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--sa-border)] px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Emails</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            Every message the system has sent on your behalf.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1">
          {["all", "sent", "failed", "skipped"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1.5 text-[12px] capitalize ${
                filter === f
                  ? "bg-[var(--sa-selected)] font-medium text-[var(--sa-accent)]"
                  : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              }`}
            >
              {f === "skipped" ? "Not sent" : f}
              {f !== "all" && counts[f] ? ` ${counts[f]}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!configured && (
          <div className="m-6 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-[13px] font-medium text-amber-900 dark:text-amber-200">
                Email isn&apos;t switched on yet
              </p>
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                The automations are running and every message is being recorded below — they just
                aren&apos;t leaving the building. Add a sending key and a from-address and everything
                from that moment on goes out for real. Nothing already listed is sent
                retrospectively, which is deliberate: a client shouldn&apos;t get an update about a
                stage change from three weeks ago.
              </p>
            </div>
          </div>
        )}

        {/* Where alerts land */}
        <div className="mx-6 mt-6 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
            Send my alerts to
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--sa-text-tertiary)]">
            Where new briefs, enquiries and tech pack requests land. Leave it blank and they go to
            every admin on the team.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={notify}
              onChange={(e) => setNotify(e.target.value)}
              placeholder="you@yourdomain.com"
              className="min-w-[220px] flex-1 rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
            <button
              onClick={saveNotify}
              className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
            >
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          {error && <p className="mt-1.5 text-[12px] text-red-500">{error}</p>}
        </div>

        {missingEmail.length > 0 && (
          <div className="mx-6 mt-4 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
            <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
              {missingEmail.length} client{missingEmail.length === 1 ? "" : "s"} can&apos;t be emailed
            </p>
            <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-[var(--sa-text-tertiary)]">
              There&apos;s no contact address on file, so stage updates for their products reach
              nobody and won&apos;t appear in the log below. Add one on the client&apos;s page.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missingEmail.map((c) => (
                <a
                  key={c.id}
                  href={`/clients/${c.id}`}
                  className="rounded-md border border-[var(--sa-border)] px-2 py-1 text-[12px] text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)]"
                >
                  {c.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* The log */}
        <div className="p-6">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Mail size={22} className="text-[var(--sa-text-tertiary)]" />
              <p className="mt-2.5 text-[13px] font-medium text-[var(--sa-text-primary)]">
                {rows.length === 0 ? "Nothing sent yet" : "Nothing matches that filter"}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
                {rows.length === 0
                  ? "Messages appear here the moment someone submits a brief or a product moves stage."
                  : "Try another filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--sa-border)]">
              {shown.map((r, i) => {
                const s = STATUS[r.status] ?? STATUS.queued;
                return (
                  <button
                    key={r.id}
                    onClick={() => setOpen(r)}
                    className={`flex w-full items-center gap-3 bg-[var(--sa-window)] px-4 py-2.5 text-left hover:bg-[var(--sa-hover)] ${
                      i > 0 ? "border-t border-[var(--sa-border)]" : ""
                    }`}
                  >
                    <span
                      className="w-[68px] shrink-0 rounded px-1.5 py-0.5 text-center text-[10.5px] font-semibold uppercase tracking-wide"
                      style={{ background: s.bg, color: s.fg }}
                    >
                      {s.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--sa-text-primary)]">
                        {r.subject}
                      </span>
                      <span className="block truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                        {r.to_email} · {TEMPLATE_LABEL[r.template] ?? r.template}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)]">
                      {when(r.created_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setOpen(null)}
          role="presentation"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-[var(--sa-window)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-[var(--sa-border)] p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--sa-text-primary)]">
                  {open.subject}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--sa-text-tertiary)]">
                  To {open.to_email} · {when(open.created_at)} ·{" "}
                  {(STATUS[open.status] ?? STATUS.queued).label}
                </p>
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="shrink-0 p-1 text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            {open.error && (
              <p className="border-b border-[var(--sa-border)] bg-amber-50 px-4 py-2 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                {open.error}
              </p>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {/* The stored HTML, shown as text rather than rendered: this is
                  our own template, but a preview pane that executes stored
                  markup is a habit worth not forming. */}
              <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">
                {open.body_text}
              </pre>
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--sa-border)] px-4 py-2.5">
              <Check size={13} className="text-[var(--sa-text-tertiary)]" />
              <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                {TEMPLATE_LABEL[open.template] ?? open.template}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
