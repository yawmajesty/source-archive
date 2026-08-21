"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { changeProductStage } from "./stage-actions";
import { PRODUCT_STAGES, STAGE_LABEL } from "@/lib/stages";

/**
 * The designer's stage control, in the product page's right column.
 *
 * Every move is recorded with who moved it and why, and reaches the client
 * portal — so this is the one control that turns internal progress into
 * something the client can see without anyone writing an update by hand.
 */
export function StageSelector({ productId, stage, canChange }: {
  productId: string;
  stage: string;
  canChange: boolean;
}) {
  const [current, setCurrent] = useState(stage);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justMoved, setJustMoved] = useState(false);

  async function move(to: string) {
    if (to === current || busy) return;
    setBusy(to); setError(null);
    const res = await changeProductStage(productId, to);
    if (!res.success) setError(res.error);
    else {
      setCurrent(to);
      setJustMoved(true);
      setTimeout(() => setJustMoved(false), 2500);
    }
    setBusy(null);
  }

  const currentIndex = PRODUCT_STAGES.findIndex((s) => s.id === current);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">Stage</p>
        {justMoved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600">
            <Check size={11} /> Client can see this
          </span>
        )}
      </div>

      {!canChange ? (
        <p className="text-[12.5px] text-[var(--sa-text-primary)]">
          {STAGE_LABEL[current] ?? current}
          <span className="ml-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
            — you don&apos;t have permission to change this
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {PRODUCT_STAGES.map((s, i) => {
            const isCurrent = s.id === current;
            const isPast = currentIndex >= 0 && i < currentIndex;
            return (
              <button
                key={s.id}
                onClick={() => move(s.id)}
                disabled={!!busy}
                title={s.hint}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors disabled:opacity-60"
                style={{
                  background: isCurrent ? "var(--sa-accent)" : "transparent",
                  color: isCurrent ? "#fff" : "var(--sa-text-secondary)",
                }}
              >
                <span
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: isCurrent ? "rgba(255,255,255,.25)" : isPast ? "var(--sa-success)" : "var(--sa-hover)",
                    color: isCurrent ? "#fff" : isPast ? "#fff" : "var(--sa-text-tertiary)",
                  }}
                >
                  {busy === s.id ? <Loader2 size={10} className="animate-spin" /> : isPast ? <Check size={10} /> : i + 1}
                </span>
                <span className="text-[12.5px]">{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* A stored value from before this list existed still needs showing. */}
      {canChange && currentIndex === -1 && (
        <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
          Currently <strong>{STAGE_LABEL[current] ?? current}</strong> — pick one above to move it onto the new track.
        </p>
      )}

      {error && <p className="mt-1.5 text-[11.5px] text-red-500">{error}</p>}
    </div>
  );
}
