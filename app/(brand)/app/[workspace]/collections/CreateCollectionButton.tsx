"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { createCollection } from "./actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";

const CURRENCIES = ["USD", "GBP", "EUR", "CNY", "JPY", "AUD", "CAD"];

export function CreateCollectionButton({
  workspaceId,
  workspaceSlug,
  mode,
  role,
  defaultCurrency,
  variant = "outline",
}: {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  defaultCurrency: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createCollection({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        mode,
        role,
        name: name.trim(),
        season: season.trim() || undefined,
        base_currency: currency,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setName("");
      setSeason("");
      router.push(`/app/${workspaceSlug}/collections/${res.collection_id}`);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
            : "inline-flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
        }
      >
        <Plus size={variant === "primary" ? 14 : 12} /> New collection
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl"
          >
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
                <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">New collection</h2>
                <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-[var(--sa-hover)]">
                  <X size={16} className="text-[var(--sa-text-tertiary)]" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. AW26"
                    required
                    autoFocus
                    className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                    Season / drop label <span className="text-[var(--sa-text-tertiary)] normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="e.g. Autumn/Winter 2026, Drop 03"
                    className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">
                    Base currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
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
                  {isPending ? "Creating…" : "Create collection"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}
