"use client";

import { Package, Shirt, Home, Sofa, FlameKindling } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import type { Product, Factory, Stage } from "@/lib/mock-data";

const STAGE_DOT_COLORS: Record<Stage, string> = {
  brief: "bg-gray-400",
  sourcing: "bg-blue-500",
  sampling: "bg-amber-500",
  approved: "bg-green-600",
  production: "bg-purple-600",
  qc: "bg-orange-500",
  shipped: "bg-emerald-600",
};

function StageDot({ stage }: { stage: Stage }) {
  return (
    <span
      title={stage.charAt(0).toUpperCase() + stage.slice(1)}
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", STAGE_DOT_COLORS[stage])}
    />
  );
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Tableware: Home,
  "Table Linen": Home,
  Candles: FlameKindling,
  "Home Fragrance": Home,
  Dresses: Shirt,
  Tops: Shirt,
  Trousers: Shirt,
  Furniture: Sofa,
};

interface Props {
  product: Product;
  factory: Factory | null;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function ProductRow({ product, factory, selected, onClick, onDoubleClick }: Props) {
  const Icon = CATEGORY_ICONS[product.category] ?? Package;

  const hasVariance =
    product.quoted_cost_usd !== null &&
    Math.abs(product.quoted_cost_usd - product.target_cost_usd) / product.target_cost_usd > 0.05;

  const contextItems: ContextMenuItem[] = [
    {
      label: "Open",
      shortcut: "↩",
      onClick: onDoubleClick,
    },
    {
      label: "Copy product ID",
      onClick: () => navigator.clipboard?.writeText(product.id),
    },
    {
      label: "View factory",
      onClick: () => {},
    },
    {
      label: "Duplicate",
      separator: true,
      onClick: () => {},
    },
    {
      label: "Delete product",
      variant: "danger",
      onClick: () => {},
    },
  ];

  return (
    <ContextMenu items={contextItems}>
      <div
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={cn(
          "flex h-11 items-center gap-3 px-3 cursor-default select-none border-b border-[var(--sa-border)] last:border-0 transition-colors",
          selected
            ? "bg-[var(--sa-selected)]"
            : "hover:bg-[var(--sa-hover)]"
        )}
      >
        {/* Icon */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--sa-hover)]">
          <Icon size={12} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} />
        </div>

        {/* Name */}
        <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--sa-text-primary)]">
          {product.name}
        </span>

        {/* Stage dot */}
        <StageDot stage={product.stage} />

        {/* Factory */}
        <span className="hidden w-32 shrink-0 truncate text-right text-[11px] text-[var(--sa-text-tertiary)] xl:block">
          {factory?.name ?? "—"}
        </span>

        {/* Cost */}
        <span
          className={cn(
            "w-16 shrink-0 text-right font-mono text-[11px]",
            hasVariance ? "text-[var(--sa-warning)]" : "text-[var(--sa-text-secondary)]"
          )}
        >
          {product.quoted_cost_usd != null
            ? `$${product.quoted_cost_usd.toFixed(2)}`
            : `~$${product.target_cost_usd.toFixed(2)}`}
        </span>
      </div>
    </ContextMenu>
  );
}
