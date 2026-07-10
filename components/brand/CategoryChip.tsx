import { categoryLabel } from "@/lib/brand-catalog";

export function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--sa-text-secondary)] border border-[var(--sa-border)] leading-none whitespace-nowrap">
      {categoryLabel(category)}
    </span>
  );
}
