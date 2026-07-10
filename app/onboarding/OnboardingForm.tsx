"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIndependentWorkspace } from "../(brand)/actions";

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
];

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createIndependentWorkspace({
        name: name.trim(),
        base_currency: currency,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.push(`/app/${res.slug}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 space-y-4">
      <div>
        <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">
          Brand name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Meiyo Studios"
          required
          autoFocus
          className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
        />
        <p className="mt-1 text-[10px] text-[var(--sa-text-tertiary)]">
          Used across the workspace and in your URL. You can rename later — the URL stays the same.
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1">
          Base currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-[var(--sa-text-tertiary)]">
          Costing and margins roll up in this currency. Suppliers can quote in any currency and we&apos;ll convert.
        </p>
      </div>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="w-full rounded-lg bg-[var(--sa-accent)] py-2.5 text-[13px] font-medium text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {isPending ? "Setting up…" : "Create workspace"}
      </button>

      <p className="text-[10px] text-[var(--sa-text-tertiary)] text-center pt-1">
        You&apos;ll start on a 14-day free trial — no card required.
      </p>
    </form>
  );
}
