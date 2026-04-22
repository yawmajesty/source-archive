"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { ProductRow } from "@/components/shared/ProductRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { Product, Factory, Client, Project, Stage } from "@/lib/mock-data";

interface Props {
  products: Product[];
  factories: Factory[];
  clients: Client[];
  projects: Project[];
}

const STAGES: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];

export function AllProductsClient({ products, factories, clients, projects }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function getFactory(id: string | null) {
    if (!id) return null;
    return factories.find((f) => f.id === id) ?? null;
  }

  function getClientName(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return "";
    const project = projects.find((p) => p.id === product.project_id);
    if (!project) return "";
    return clients.find((c) => c.id === project.client_id)?.name ?? "";
  }

  const filtered = products.filter((p) => {
    if (stageFilter !== "all" && p.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">All Products</h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{filtered.length} products</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 panel-border-b bg-[var(--sa-window)] flex-wrap">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5 bg-[var(--sa-bg)]">
          <Search size={12} className="text-[var(--sa-text-tertiary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="bg-transparent text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none w-40"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setStageFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] transition-colors",
              stageFilter === "all"
                ? "bg-[var(--sa-selected)] text-[var(--sa-accent)] font-medium"
                : "text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"
            )}
          >
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] transition-colors capitalize",
                stageFilter === s
                  ? "bg-[var(--sa-selected)] text-[var(--sa-accent)] font-medium"
                  : "text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-1.5 panel-border-b bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
        <div className="h-6 w-6 shrink-0" />
        <span className="flex-1 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Product</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Stage</span>
        <span className="hidden w-32 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)] xl:block">Factory</span>
        <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Cost</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-[var(--sa-window)]">
        {filtered.length === 0 ? (
          <EmptyState title="No products found" description="Try adjusting your filters." />
        ) : (
          filtered.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              factory={getFactory(product.factory_id)}
              selected={product.id === selectedId}
              onClick={() => setSelectedId(product.id)}
              onDoubleClick={() => router.push(`/products/${product.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
