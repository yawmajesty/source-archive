"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Check, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPriorities, addPriority, setPriorityDone, updatePriority, deletePriority, clearDonePriorities,
  type Priority,
} from "@/app/(app)/dashboard/priorities-actions";

// ─────────────────────────────────────────────────────────────
// What we're on.
//
// Sits above the queues because it is the only part of the dashboard that
// says what you decided, rather than what the data noticed. Everything
// below it is a list of things that are wrong; this is the answer to them.
//
// Ticking off is optimistic — the line moves the moment you click it and
// only reverts if the server disagrees. A checklist that pauses on every
// tick is one you stop using.
// ─────────────────────────────────────────────────────────────

export function Priorities() {
  const [items, setItems] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    listPriorities().then((res) => {
      if (!live) return;
      setItems(res.items);
      setSetupNeeded(res.setupNeeded);
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setError(null);
    const res = await addPriority(text);
    if (!res.success) { setError(res.error); setDraft(text); return; }
    setItems((prev) => [...prev, res.item]);
    inputRef.current?.focus();
  }

  async function toggle(item: Priority) {
    const next = !item.done;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    const res = await setPriorityDone(item.id, next);
    if (!res.success) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !next } : i)));
      setError(res.error);
    }
  }

  async function remove(id: string) {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const res = await deletePriority(id);
    if (!res.success) { setItems(before); setError(res.error); }
  }

  async function rename(id: string, body: string) {
    setEditing(null);
    const before = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, body } : i)));
    const res = await updatePriority(id, body);
    if (!res.success) { setItems(before); setError(res.error); }
  }

  async function clearDone() {
    const before = items;
    setItems((prev) => prev.filter((i) => !i.done));
    const res = await clearDonePriorities();
    if (!res.success) { setItems(before); setError(res.error); }
  }

  if (setupNeeded) {
    return (
      <div className="border-b border-[var(--sa-border)] bg-[var(--sa-bg)] px-4 py-3 sm:px-6">
        <p className="text-[12.5px] text-[var(--sa-text-secondary)]">
          <span className="font-medium text-[var(--sa-text-primary)]">Priorities</span> need a one-time
          database step — run <code className="text-[11.5px]">migrations/040_priorities_and_rfq.sql</code> in
          the Supabase SQL editor and reload.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-3.5 sm:px-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">What we&apos;re on</h2>
        {open.length > 0 && (
          <span className="tnum text-[11px] text-[var(--sa-text-tertiary)]">
            {open.length} open
          </span>
        )}
        <div className="flex-1" />
        {done.length > 0 && (
          <button
            onClick={clearDone}
            className="text-[11px] text-[var(--sa-text-tertiary)] transition-colors hover:text-[var(--sa-text-secondary)]"
          >
            Clear {done.length} done
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[12px] text-[var(--sa-text-tertiary)]">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col">
            {[...open, ...done].map((item) => (
              <div key={item.id} className="group flex items-start gap-2 py-1">
                <button
                  onClick={() => toggle(item)}
                  aria-label={item.done ? "Mark as not done" : "Mark as done"}
                  className={cn(
                    "mt-[1px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                    item.done
                      ? "border-[var(--sa-accent)] bg-[var(--sa-accent)] text-white"
                      : "border-[var(--sa-border-strong)] hover:border-[var(--sa-accent)]",
                  )}
                >
                  {item.done && <Check size={10} strokeWidth={3} />}
                </button>

                {editing === item.id ? (
                  <input
                    autoFocus
                    defaultValue={item.body}
                    onBlur={(e) => rename(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="min-w-0 flex-1 border-b border-[var(--sa-accent)] bg-transparent text-[13px] text-[var(--sa-text-primary)] outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditing(item.id)}
                    className={cn(
                      "min-w-0 flex-1 text-left text-[13px] leading-snug transition-colors",
                      item.done
                        ? "text-[var(--sa-text-tertiary)] line-through"
                        : "text-[var(--sa-text-primary)]",
                    )}
                  >
                    {item.body}
                  </button>
                )}

                <button
                  onClick={() => remove(item.id)}
                  aria-label="Remove"
                  className="shrink-0 rounded p-0.5 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--sa-danger)] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <Plus size={13} className="shrink-0 text-[var(--sa-text-tertiary)]" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder={items.length === 0 ? "Type a priority and press Enter" : "Add another"}
              className="min-w-0 flex-1 bg-transparent py-0.5 text-[13px] text-[var(--sa-text-primary)] outline-none placeholder:text-[var(--sa-text-tertiary)]"
            />
          </div>

          {error && <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
