import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 px-6 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--sa-hover)]">
        <FolderOpen size={28} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.2} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--sa-text-secondary)]">{title}</p>
        {description && (
          <p className="text-xs text-[var(--sa-text-tertiary)] max-w-48">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
