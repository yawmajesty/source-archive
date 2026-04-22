"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/mock-data";

const STAGES: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];
const STAGE_LABELS: Record<Stage, string> = {
  brief: "Brief",
  sourcing: "Sourcing",
  sampling: "Sampling",
  approved: "Approved",
  production: "Production",
  qc: "QC",
  shipped: "Shipped",
};

interface Props {
  currentStage: Stage;
  animated?: boolean;
  showLabels?: boolean;
  size?: "sm" | "md";
}

export function StageTrack({ currentStage, animated = true, showLabels = false, size = "md" }: Props) {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div className="flex flex-col gap-1">
      <div className={cn("flex gap-0.5", size === "sm" ? "h-1.5" : "h-2")}>
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;

          return (
            <motion.div
              key={stage}
              className={cn(
                "flex-1 rounded-sm first:rounded-l last:rounded-r",
                isFuture && "bg-[var(--sa-border-strong)]"
              )}
              style={
                isCompleted
                  ? { backgroundColor: "var(--sa-gold)" }
                  : isCurrent
                  ? { backgroundColor: "transparent", border: "1.5px solid var(--sa-gold)" }
                  : undefined
              }
              initial={animated ? { scaleX: 0, transformOrigin: "left" } : false}
              animate={{ scaleX: 1 }}
              transition={{
                delay: animated ? i * 0.07 : 0,
                duration: 0.5,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              title={STAGE_LABELS[stage]}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="flex gap-0.5">
          {STAGES.map((stage, i) => {
            const isCurrent = i === currentIndex;
            return (
              <div
                key={stage}
                className={cn(
                  "flex-1 text-center text-[9px] leading-none truncate",
                  isCurrent
                    ? "text-[var(--sa-gold)] font-medium"
                    : "text-[var(--sa-text-tertiary)]"
                )}
              >
                {STAGE_LABELS[stage]}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
