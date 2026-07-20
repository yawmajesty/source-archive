"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Rows3, Kanban, Coins, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "",         label: "Gallery",  icon: LayoutGrid },
  { key: "table",    label: "Table",    icon: Rows3 },
  { key: "kanban",   label: "Kanban",   icon: Kanban },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "costing",  label: "Costing",  icon: Coins },
] as const;

export function CollectionViewSwitcher({ slug, collectionId }: { slug: string; collectionId: string }) {
  const pathname = usePathname();
  const base = `/app/${slug}/collections/${collectionId}`;
  const active = pathname === `${base}` ? "" : pathname.replace(`${base}/`, "");

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--sa-border)] overflow-hidden">
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const isActive = active === v.key;
        return (
          <Link
            key={v.key}
            href={`${base}${v.key ? `/${v.key}` : ""}`}
            title={v.label}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium border-r border-[var(--sa-border)] last:border-r-0 transition-colors",
              isActive
                ? "bg-[var(--sa-accent)] text-white"
                : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
            )}
          >
            <Icon size={12} />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
