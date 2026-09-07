"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PriceBuilder, type PriceBuilderValue } from "@/components/pricing/PriceBuilder";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { createPriceSheet, updatePriceSheet, deletePriceSheet, type PriceSheet } from "./actions";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  baseCurrency: string;
  initialSheets: PriceSheet[];
}

/** The saved half: a list of styles, and persistence around the calculator. */
export function PricingClient({
  workspaceId, workspaceSlug, mode, role, baseCurrency, initialSheets,
}: Props) {
  const [sheets, setSheets] = useState(initialSheets);
  const [activeId, setActiveId] = useState<string | null>(initialSheets[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sheet = sheets.find((s) => s.id === activeId) ?? null;
  const base = { workspace_id: workspaceId, workspace_slug: workspaceSlug, mode, role };

  async function addSheet() {
    setError(null);
    const res = await createPriceSheet({ ...base, currency: baseCurrency });
    if (!res.success) { setError(res.error); return; }
    setSheets((prev) => [res.sheet, ...prev]);
    setActiveId(res.sheet.id);
  }

  // Optimistic on every keystroke, written in a transition. The maths runs
  // locally, so the numbers never wait on the network.
  function patch(p: Partial<PriceBuilderValue>) {
    if (!sheet) return;
    const id = sheet.id;
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
    startTransition(async () => {
      const res = await updatePriceSheet({ ...base, id, patch: p as Partial<PriceSheet> });
      if (!res.success) setError(res.error);
    });
  }

  async function removeSheet(id: string) {
    setSheets((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
    await deletePriceSheet({ ...base, id });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--sa-border)] px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Pricing</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            What a garment costs you, and what you should charge for it.
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={addSheet}
          className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
        >
          <Plus size={13} /> New style
        </button>
      </div>

      {error && (
        <p className="border-b border-[var(--sa-border)] bg-red-50 px-6 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      {sheets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="max-w-sm text-center">
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Price your first style</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">
              List the fabrics and trims, add the factory&apos;s cut-make-trim, and the calculator
              works backwards to the price you need to charge — after discounting, returns and card
              fees have taken their share.
            </p>
            <button
              onClick={addSheet}
              className="mt-4 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white"
            >
              Start a price sheet
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-52 shrink-0 overflow-y-auto border-r border-[var(--sa-border)] p-2">
            {sheets.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-md pr-1.5 ${
                  s.id === activeId ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
                }`}
              >
                <button
                  onClick={() => setActiveId(s.id)}
                  className={`min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px] ${
                    s.id === activeId ? "font-medium text-[var(--sa-accent)]" : "text-[var(--sa-text-secondary)]"
                  }`}
                >
                  {s.name || "Untitled style"}
                </button>
                <button
                  aria-label={`Delete ${s.name}`}
                  onClick={() => removeSheet(s.id)}
                  className="shrink-0 p-1 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </aside>

          {sheet && (
            <div className="flex-1 overflow-y-auto p-6">
              {/* Remounting per sheet keeps the "try a price" box from carrying
                  a number across to a different style. */}
              <PriceBuilder key={sheet.id} value={sheet} onChange={patch} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
