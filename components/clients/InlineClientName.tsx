"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { renameClient } from "@/app/(app)/clients/status-actions";

// ─────────────────────────────────────────────────────────────
// Renaming a client where you notice the name is wrong.
//
// Renaming existed on the client's own page, behind a bare name with a
// hover underline and a title attribute — invisible on a touch screen and
// close to it on a desktop. A feature nobody can find is a feature that
// isn't there, so the pencil is now drawn, and the list where you actually
// spot a typo across several clients can do it too.
// ─────────────────────────────────────────────────────────────

export function InlineClientName({
  clientId,
  name: initial,
  className,
}: {
  clientId: string;
  name: string;
  className?: string;
}) {
  const [name, setName] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === name) { setDraft(name); return; }
    const previous = name;
    setName(next);
    setError(null);
    const res = await renameClient(clientId, next);
    if (!res.success) {
      setName(previous);
      setDraft(previous);
      setError(res.error ?? "Could not rename");
    }
  }

  // The row is a link, so every control here has to stop the click reaching it.
  const swallow = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={swallow}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(name); setEditing(false); }
          }}
          className="min-w-0 flex-1 rounded-md border border-[var(--sa-accent)] bg-[var(--sa-window)] px-1.5 py-0.5 text-[14px] font-semibold text-[var(--sa-text-primary)] outline-none"
        />
        <button onClick={(e) => { swallow(e); commit(); }} aria-label="Save the name"
          className="shrink-0 rounded p-1 text-[var(--sa-accent)] hover:bg-[var(--sa-hover)]">
          <Check size={12} strokeWidth={3} />
        </button>
        <button onClick={(e) => { swallow(e); setDraft(name); setEditing(false); }} aria-label="Cancel"
          className="shrink-0 rounded p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={(e) => { swallow(e); setDraft(name); setEditing(true); }}
        title="Rename this client"
        className={`group/n flex max-w-full items-center gap-1.5 text-left ${className ?? ""}`}
      >
        <span className="truncate text-[14px] font-semibold text-[var(--sa-text-primary)]">{name}</span>
        <Pencil
          size={11}
          className="shrink-0 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity group-hover/n:opacity-100 focus-visible:opacity-100"
        />
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </>
  );
}
