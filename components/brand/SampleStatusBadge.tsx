import { sampleStatusLabel, type SampleStatus } from "@/lib/brand-sampling";
import { cn } from "@/lib/utils";

const STYLES: Record<SampleStatus, string> = {
  requested:       "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress:     "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  shipped:         "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  received:        "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  under_review:    "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  approved:        "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected_revise: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export function SampleStatusBadge({ status, size = "sm" }: { status: SampleStatus; size?: "sm" | "xs" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium leading-none whitespace-nowrap",
        size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        STYLES[status],
      )}
    >
      {sampleStatusLabel(status)}
    </span>
  );
}
