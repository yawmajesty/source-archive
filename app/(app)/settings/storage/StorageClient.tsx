"use client";

import { useState } from "react";
import { Trash2, HardDrive } from "lucide-react";
import { deleteStorageObject, type StorageReport } from "./actions";

// ─────────────────────────────────────────────────────────────
// Where the storage bill goes.
//
// A single total answers "am I overpaying" with "maybe", so the page is
// built around the two things that let you act: which bucket is growing,
// and which individual files are big enough to be worth deleting. One
// 17MB PDF is worth more attention than a thousand thumbnails.
// ─────────────────────────────────────────────────────────────

function bytes(n: number): string {
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function StorageClient({ report }: { report: StorageReport }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (report.setupNeeded) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-[var(--sa-text-secondary)]">
          Storage usage needs a one-time database step — run{" "}
          <code className="text-[12px]">migrations/046_storage_usage.sql</code> in the Supabase SQL
          editor and reload.
        </p>
      </div>
    );
  }

  const largest = report.buckets[0]?.bytes ?? 1;
  const usedPct = Math.min(100, (report.totalBytes / report.includedBytes) * 100);

  async function remove(bucket: string, name: string) {
    const key = `${bucket}/${name}`;
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setBusy(key);
    setError(null);
    const res = await deleteStorageObject(bucket, name);
    setBusy(null);
    if (!res.success) { setError(res.error); return; }
    setRemoved((prev) => new Set(prev).add(key));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--sa-border)] px-4 py-3.5 sm:px-6">
        <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Storage</h1>
        <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
          {bytes(report.totalBytes)} across {report.totalFiles.toLocaleString()} files
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {/* ── Against what the plan includes ── */}
        <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
          <div className="mb-2 flex items-baseline gap-2">
            <HardDrive size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">
              {bytes(report.totalBytes)} used
            </p>
            <p className="shrink-0 tnum text-[11.5px] text-[var(--sa-text-tertiary)]">
              of {bytes(report.includedBytes)} included
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--sa-bg)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(usedPct, 0.4)}%`,
                background: usedPct > 85 ? "var(--sa-danger)" : "var(--sa-accent)",
              }}
            />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
            {usedPct < 5
              ? "Well inside the plan — nothing here is costing extra."
              : usedPct < 85
                ? "Inside the plan. Worth a look when it passes 85%."
                : "Close to the included allowance. Overage is charged per GB beyond it."}
          </p>
        </section>

        {/* ── Which bucket is growing ── */}
        <section className="mt-4 overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
          <div className="border-b border-[var(--sa-border)] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">By bucket</h2>
          </div>
          {report.buckets.length === 0 ? (
            <p className="px-4 py-4 text-[12.5px] text-[var(--sa-text-tertiary)]">Nothing stored yet.</p>
          ) : (
            <div className="flex flex-col">
              {report.buckets.map((b) => (
                <div key={b.bucket} className="border-b border-[var(--sa-border)] px-4 py-3 last:border-0">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--sa-text-primary)]">
                      {b.holds}
                    </p>
                    <p className="shrink-0 tnum text-[12.5px] font-semibold text-[var(--sa-text-primary)]">
                      {bytes(b.bytes)}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--sa-bg)]">
                    <div className="h-full rounded-full bg-[var(--sa-accent)]"
                      style={{ width: `${Math.max((b.bytes / largest) * 100, 1)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--sa-text-tertiary)]">
                    {b.bucket} · {b.files.toLocaleString()} file{b.files === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── The files worth deleting ── */}
        <section className="mt-4 overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
          <div className="border-b border-[var(--sa-border)] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Biggest files</h2>
            <p className="text-[11px] text-[var(--sa-text-tertiary)]">
              One oversized upload is worth more attention than a thousand thumbnails
            </p>
          </div>
          {report.largest.length === 0 ? (
            <p className="px-4 py-4 text-[12.5px] text-[var(--sa-text-tertiary)]">Nothing stored yet.</p>
          ) : (
            <div className="flex flex-col">
              {report.largest.map((f) => {
                const key = `${f.bucket}/${f.name}`;
                const gone = removed.has(key);
                return (
                  <div key={key}
                    className={`group flex items-center gap-3 border-b border-[var(--sa-border)] px-4 py-2.5 last:border-0 ${gone ? "opacity-40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] text-[var(--sa-text-primary)]">
                        {f.name.split("/").pop()}
                      </p>
                      <p className="truncate text-[11px] text-[var(--sa-text-tertiary)]">
                        {f.bucket} · {when(f.created_at)}
                      </p>
                    </div>
                    <p className="shrink-0 tnum text-[12.5px] font-semibold text-[var(--sa-text-primary)]">
                      {bytes(f.bytes)}
                    </p>
                    {!gone && (
                      <button
                        onClick={() => remove(f.bucket, f.name)}
                        disabled={busy === key}
                        aria-label="Delete this file"
                        className="shrink-0 rounded p-1 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--sa-danger)] focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}

        <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
          Deleting a file here removes it from storage but not the record pointing at it, so a product
          photo deleted this way leaves a broken image on that product. Use it for things you know are
          stray.
        </p>
      </div>
    </div>
  );
}
