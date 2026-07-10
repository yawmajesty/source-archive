"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { CATEGORIES, type CategoryKey } from "@/lib/brand-catalog";
import { quickAddProduct } from "../actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";

export function QuickAddProduct({
  workspaceId,
  workspaceSlug,
  collectionId,
  mode,
  role,
}: {
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  mode: WorkspaceMode;
  role: Role;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("denim");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await quickAddProduct({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        mode,
        role,
        name: name.trim(),
        category,
      });
      if (!res.success) { setError(res.error); return; }
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
      >
        <Plus size={12} /> New product
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Quick-add product</h2>
                  <p className="text-[11px] text-[var(--sa-text-tertiary)]">Just name + category — flesh out details later.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-[var(--sa-hover)]">
                  <X size={16} className="text-[var(--sa-text-tertiary)]" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                    Product name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Wide-leg workwear jean"
                    required
                    autoFocus
                    className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryKey)}
                    className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label} · {c.prefix}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-[var(--sa-text-tertiary)]">
                    Style code will auto-generate as <span className="font-mono">{CATEGORIES.find((c) => c.key === category)?.prefix}-XXX</span>
                  </p>
                </div>
                {error && <p className="text-[12px] text-red-500">{error}</p>}
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="rounded-lg border border-[var(--sa-border)] px-4 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "Adding…" : "Add product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
