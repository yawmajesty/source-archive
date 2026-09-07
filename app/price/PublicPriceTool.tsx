"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { PriceBuilder, type PriceBuilderValue } from "@/components/pricing/PriceBuilder";
import { PRICING_DEFAULTS, starterLines } from "@/lib/pricing";

const KEY = "sa-price-calculator-v1";

function blank(): PriceBuilderValue {
  return { ...PRICING_DEFAULTS, lines: starterLines(), name: "", notes: null, chosen_price: null };
}

export function PublicPriceTool() {
  const [value, setValue] = useState<PriceBuilderValue>(blank);
  // Rendered blank on the server, so the restore has to happen after mount
  // or the markup won't match what React expects.
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved) setValue({ ...blank(), ...JSON.parse(saved) });
    } catch {
      // A blocked or full localStorage is not a reason to withhold the tool.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      // Ignore — the calculator still works, it just won't be here tomorrow.
    }
  }, [value, restored]);

  function patch(p: Partial<PriceBuilderValue>) {
    setValue((prev) => ({ ...prev, ...p }));
  }

  function reset() {
    setValue(blank());
    try { window.localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <PriceBuilder value={value} onChange={patch} />
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--sa-border)] pt-4">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-[12.5px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]"
        >
          <RotateCcw size={12} /> Start over
        </button>
        <span className="text-[12px] text-[var(--sa-text-tertiary)]">
          Saved in this browser only. Clear your site data and it&apos;s gone.
        </span>
      </div>
    </div>
  );
}
