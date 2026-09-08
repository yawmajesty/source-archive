"use client";

import { useState } from "react";
import { Download, DatabaseBackup, TriangleAlert } from "lucide-react";
import { humanBytes } from "@/lib/backup";
import { runBackup, backupDownloadUrl, type BackupRun } from "../backup-actions";

export function BackupsClient({ runs: initial, tableCount }: { runs: BackupRun[]; tableCount: number }) {
  const [runs, setRuns] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function take() {
    setBusy(true); setError(null); setNotice(null);
    const res = await runBackup("manual");
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setNotice(
      `Backed up ${res.rowTotal.toLocaleString()} rows (${humanBytes(res.bytes)})` +
      (res.failed.length ? ` — couldn't read: ${res.failed.join(", ")}` : ""),
    );
    setRuns([
      {
        id: `tmp-${Date.now()}`, storage_path: res.path, row_total: res.rowTotal,
        bytes: res.bytes, status: "ok", error: null, trigger: "manual",
        created_at: new Date().toISOString(),
      },
      ...runs,
    ]);
  }

  async function download(path: string) {
    setError(null);
    const res = await backupDownloadUrl(path);
    if (!res.success) { setError(res.error); return; }
    window.open(res.url, "_blank", "noopener");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--sa-border)] px-6 py-3">
        <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Backups</h1>
        <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
          A full copy of everything, taken weekly and on demand.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
            <div className="flex items-center gap-2">
              <DatabaseBackup size={15} className="text-[var(--sa-text-tertiary)]" />
              <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Take one now</p>
            </div>
            <p className="mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
              Every row across {tableCount} tables — clients, products, costs, conversations,
              briefs, shoots — as one JSON file. One runs automatically every Monday.
            </p>
            <button
              onClick={take}
              disabled={busy}
              className="mt-3 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {busy ? "Backing up…" : "Back up now"}
            </button>
            {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
            {notice && <p className="mt-2 text-[12px] text-[var(--sa-success)]">{notice}</p>}
          </div>

          {/* The honest caveat */}
          <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-[12.5px] font-medium text-amber-900 dark:text-amber-200">
                Download at least one and keep it somewhere else
              </p>
              <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
                These are stored in the same Supabase account as the data they&apos;re backing up.
                That covers a bad migration or a mistaken delete — it does not cover losing the
                account itself. A copy on your own machine or drive is the part that does.
                Photos and files aren&apos;t included; this is the database.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
              History
            </p>
            {runs.length === 0 ? (
              <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">
                None yet. Take one now, or wait for Monday.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--sa-border)]">
                {runs.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 bg-[var(--sa-window)] px-4 py-2.5 ${
                      i > 0 ? "border-t border-[var(--sa-border)]" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-[var(--sa-text-primary)]">
                        {new Date(r.created_at).toLocaleString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      <span className="block text-[11px] text-[var(--sa-text-tertiary)]">
                        {r.status === "ok"
                          ? `${r.row_total.toLocaleString()} rows · ${humanBytes(r.bytes)} · ${r.trigger}`
                          : `Failed — ${r.error ?? "unknown"}`}
                      </span>
                    </span>
                    {r.status === "ok" && r.storage_path && (
                      <button
                        onClick={() => download(r.storage_path!)}
                        className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                      >
                        <Download size={12} /> Download
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
