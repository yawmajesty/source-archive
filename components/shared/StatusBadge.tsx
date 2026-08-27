import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/mock-data";

const STAGE_CONFIG: Record<Stage, { label: string; className: string }> = {
  brief:      { label: "Concept",    className: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" },
  pattern:    { label: "Pattern",    className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400" },
  sourcing:   { label: "Sourcing",   className: "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" },
  sampling:   { label: "Sampling",   className: "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" },
  review:     { label: "Review",     className: "bg-pink-50 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400" },
  approved:   { label: "Approved",   className: "bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  revision:   { label: "Revision",   className: "bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" },
  production: { label: "Production", className: "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  qc:         { label: "QC",         className: "bg-orange-50 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" },
  shipped:    { label: "Shipped",    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
};

interface Props {
  stage: Stage;
  className?: string;
}

export function StatusBadge({ stage, className }: Props) {
  const config = STAGE_CONFIG[stage] ?? {
    label: String(stage),
    className: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none tracking-wide",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function SampleStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent:       "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    in_transit: "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    received:   "bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400",
    approved:   "bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-400",
    rejected:   "bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  };
  const label = status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        map[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {label}
    </span>
  );
}
