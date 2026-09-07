"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Lock, ArrowRight } from "lucide-react";
import { PriceBuilder, type PriceBuilderValue } from "@/components/pricing/PriceBuilder";
import { PRICING_DEFAULTS, starterLines, buildCost } from "@/lib/pricing";
import { CALCULATOR_KEY, stashForSignup } from "@/lib/price-handoff";

function blank(): PriceBuilderValue {
  return { ...PRICING_DEFAULTS, lines: starterLines(), name: "", notes: null, chosen_price: null };
}

// Where sign-up sends them afterwards: straight into brand setup, skipping
// the brand-or-agency fork, because clicking Save on this page answered it.
const AFTER_SIGNUP = "/sign-up?next=" + encodeURIComponent("/onboarding?from=price");

export function PublicPriceTool() {
  const [value, setValue] = useState<PriceBuilderValue>(blank);
  // Rendered blank on the server, so the restore has to wait for mount or
  // the markup won't match what React expects.
  const [restored, setRestored] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CALCULATOR_KEY);
      if (saved) setValue({ ...blank(), ...JSON.parse(saved) });
    } catch {
      // A blocked or full localStorage is not a reason to withhold the tool.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(CALCULATOR_KEY, JSON.stringify(value));
    } catch {
      setStorageBlocked(true);
    }
  }, [value, restored]);

  function patch(p: Partial<PriceBuilderValue>) {
    setValue((prev) => ({ ...prev, ...p }));
  }

  function reset() {
    setValue(blank());
    try { window.localStorage.removeItem(CALCULATOR_KEY); } catch { /* nothing to clear */ }
  }

  function saveIt() {
    // Stash before navigating. If storage is unavailable the promise can't be
    // kept, so say so rather than sending them off to sign up for nothing.
    const stashed = stashForSignup({
      ...value,
      name: value.name.trim() || "My first style",
    });
    if (!stashed) {
      setStorageBlocked(true);
      return;
    }
    window.location.href = AFTER_SIGNUP;
  }

  // Nothing to save until they've actually costed something.
  const hasWork = buildCost(value).exFactory > 0;

  return (
    <div className="flex flex-col gap-5">
      <PriceBuilder value={value} onChange={patch} />

      {/* Save gate */}
      <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[240px] flex-1">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-[var(--sa-text-tertiary)]" />
              <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">
                Keep this
              </p>
            </div>
            <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
              {hasWork
                ? "Create a free account and this style comes with you — every fabric, trim and figure exactly as you left it. You'll be able to price a whole collection and keep it in one place."
                : "Add what your fabrics, trims and cut-make-trim cost, then create a free account to keep the style and price the rest of your collection."}
            </p>
          </div>

          <button
            onClick={saveIt}
            disabled={!hasWork}
            className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-4 py-2.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save this style <ArrowRight size={14} />
          </button>
        </div>

        {storageBlocked && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            This browser is blocking site storage, so your work can&apos;t be carried through
            sign-up. Create your account first at{" "}
            <a href="/sign-up" className="underline">sign-up</a>, then price the style inside it —
            or turn off private browsing and try again.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--sa-border)] pt-4">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-[12.5px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]"
        >
          <RotateCcw size={12} /> Start over
        </button>
        <span className="text-[12px] text-[var(--sa-text-tertiary)]">
          Until you save it, this lives in this browser only — clear your site data and it&apos;s gone.
        </span>
      </div>
    </div>
  );
}
