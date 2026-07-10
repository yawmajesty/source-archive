import { stageLabel, type Stage } from "@/lib/brand-catalog";
import { cn } from "@/lib/utils";

// Colour rules tuned so the pipeline reads at a glance:
// early stages muted, mid-stage warm, production/QC action colours,
// shipped/delivered fully "done" green.
const STAGE_STYLES: Record<Stage, string> = {
  concept:                 "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  design:                  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  tech_pack:               "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  sampling:                "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  approved_for_production: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  in_production:           "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  quality_check:           "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  shipped:                 "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  delivered:               "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
};

export function StageBadge({ stage, size = "sm" }: { stage: Stage; size?: "sm" | "xs" }) {
  const dims = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium leading-none whitespace-nowrap",
        dims,
        STAGE_STYLES[stage] ?? "bg-gray-100 text-gray-700",
      )}
    >
      {stageLabel(stage)}
    </span>
  );
}
