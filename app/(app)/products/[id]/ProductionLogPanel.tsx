"use client";

import { useMemo, useState } from "react";
import { Clock, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { STAGE_LABEL, groupByDate, type ProductionLogEntry } from "@/lib/production-log";
import { setLogEntryVisibility } from "./production-log-actions";

// ─────────────────────────────────────────────────────────────
// The release desk.
//
// The workshop writes daily; this is where the agency reviews a stretch of
// that story and decides what the client sees. Releasing flips the entry and
// every photo attached to it together, so a released day arrives complete.
// ─────────────────────────────────────────────────────────────

export function ProductionLogPanel({ productId, entries, canRelease }: {
  productId: string;
  entries: ProductionLogEntry[];
  canRelease: boolean;
}) {
  const [rows, setRows] = useState(entries);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => groupByDate(rows), [rows]);
  const unreleased = rows.filter((r) => !r.visible_to_client);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function release(ids: string[], visible: boolean) {
    if (!ids.length) return;
    setBusy(true); setError(null);
    const res = await setLogEntryVisibility(ids, productId, visible);
    if (!res.success) { setError(res.error ?? "Could not update"); setBusy(false); return; }
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, visible_to_client: visible } : r)),
    );
    setSelected(new Set());
    setBusy(false);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--sa-border)] p-4">
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Production log</p>
        <p className="mt-1 text-[12px] text-[var(--sa-text-tertiary)]">
          Nothing logged yet. Entries appear here as the workshop records them.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--sa-border)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Production log</p>
        <span className="text-[11px] text-[var(--sa-text-tertiary)]">
          {rows.length} entries · {unreleased.length} unreleased
        </span>
        <div className="flex-1" />
        {canRelease && (
          <>
            <button
              disabled={busy || selected.size === 0}
              onClick={() => release([...selected], true)}
              className="rounded-md bg-[var(--sa-accent)] px-2.5 py-1 text-[11.5px] font-medium text-white disabled:opacity-40"
            >
              Release {selected.size || ""}
            </button>
            <button
              disabled={busy || unreleased.length === 0}
              onClick={() => release(unreleased.map((r) => r.id), true)}
              className="rounded-md px-2.5 py-1 text-[11.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-40"
            >
              Release all
            </button>
          </>
        )}
      </div>

      {error && <p className="mb-2 text-[11.5px] text-red-500">{error}</p>}

      <div className="flex flex-col gap-3">
        {grouped.map((day) => (
          <div key={day.date}>
            <p className="mb-1 text-[11px] tabular-nums text-[var(--sa-text-tertiary)]">
              {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </p>
            <div className="flex flex-col gap-1.5">
              {day.entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--sa-border)] p-2.5"
                  style={{ background: e.visible_to_client ? "transparent" : "var(--sa-hover)" }}
                >
                  {canRelease && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      aria-label={`Select ${e.summary}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--sa-text-secondary)]" style={{ background: "var(--sa-hover)" }}>
                        {STAGE_LABEL[e.stage]}
                      </span>
                      {e.minutes_spent ? (
                        <span className="flex items-center gap-1 text-[11px] tabular-nums text-[var(--sa-text-tertiary)]">
                          <Clock size={11} /> {e.minutes_spent}m
                        </span>
                      ) : null}
                      <div className="flex-1" />
                      {e.visible_to_client ? (
                        <span className="flex items-center gap-1 text-[10.5px] text-emerald-600">
                          <Eye size={11} /> Client can see this
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10.5px] text-[var(--sa-text-tertiary)]">
                          <EyeOff size={11} /> Internal
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--sa-text-primary)]">{e.summary}</p>
                    {e.blocked_reason && (
                      <p className="mt-1 flex items-center gap-1 text-[11.5px] text-amber-600">
                        <AlertTriangle size={11} /> {e.blocked_reason}
                      </p>
                    )}
                  </div>
                  {canRelease && e.visible_to_client && (
                    <button
                      onClick={() => release([e.id], false)}
                      disabled={busy}
                      className="text-[11px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]"
                    >
                      Retract
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
