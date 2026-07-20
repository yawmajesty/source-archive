"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STAGES, type Stage, type Product } from "@/lib/brand-catalog";
import { StageBadge } from "@/components/brand/StageBadge";
import { changeProductStage } from "../../actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { cn } from "@/lib/utils";

// A pipeline-oriented kanban with drag-and-drop. Guardrails fire when
// moving into 'approved_for_production' — we don't block, we warn.
export function KanbanBoard({
  workspaceId,
  workspaceSlug,
  collectionId,
  mode,
  role,
  products: initial,
}: {
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  mode: WorkspaceMode;
  role: Role;
  products: Product[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ productId: string; nextStage: Stage; reasons: string[] } | null>(null);
  const [, startTransition] = useTransition();

  function byStage(stage: Stage) {
    return products.filter((p) => p.stage === stage);
  }

  function guardrailReasons(product: Product, next: Stage): string[] {
    if (next !== "approved_for_production") return [];
    const reasons: string[] = [];
    // Phase 3 doesn't wire cost yet — placeholder guardrail is on the
    // presence of costing hint fields we already have.
    if (!product.target_quantity) reasons.push("No target quantity set");
    // (Approved sample check reaches DB in a later phase; for now it's a
    // presence-of-costing hint.)
    return reasons;
  }

  function performMove(productId: string, nextStage: Stage) {
    // Optimistic: update local state, revert on error
    const prev = products;
    const previousStage = prev.find((p) => p.id === productId)?.stage;
    setProducts((cur) => cur.map((p) => (p.id === productId ? { ...p, stage: nextStage } : p)));
    startTransition(async () => {
      const res = await changeProductStage({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        product_id: productId,
        mode,
        role,
        next_stage: nextStage,
        previous_stage: previousStage,
      });
      if (!res.success) {
        setProducts(prev);
        alert("Couldn't move: " + res.error);
        return;
      }
      router.refresh();
    });
  }

  function requestMove(productId: string, nextStage: Stage) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (product.stage === nextStage) return;
    const reasons = guardrailReasons(product, nextStage);
    if (reasons.length > 0) {
      setPendingConfirm({ productId, nextStage, reasons });
      return;
    }
    performMove(productId, nextStage);
  }

  return (
    <>
      <div className="grid grid-flow-col auto-cols-[280px] gap-3 overflow-x-auto pb-4">
        {STAGES.map((stageDef) => {
          const items = byStage(stageDef.key);
          return (
            <div
              key={stageDef.key}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) requestMove(id, stageDef.key);
                setDragging(null);
              }}
              className="flex flex-col rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] max-h-[calc(100vh-14rem)]"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--sa-border)] bg-[var(--sa-bg)] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <StageBadge stage={stageDef.key} size="xs" />
                  <span className="text-[10px] font-mono text-[var(--sa-text-tertiary)]">{items.length}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.length === 0 ? (
                  <div className="text-[10px] text-[var(--sa-text-tertiary)] text-center py-6">Drop here</div>
                ) : (
                  items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", p.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(p.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        "rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] p-2.5 cursor-grab active:cursor-grabbing transition-opacity",
                        dragging === p.id && "opacity-40",
                      )}
                    >
                      <Link
                        href={`/app/${workspaceSlug}/collections/${collectionId}/products/${p.id}`}
                        className="block"
                      >
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <p className="flex-1 min-w-0 text-[12px] font-semibold text-[var(--sa-text-primary)] truncate">{p.name}</p>
                          <span className="text-[9px] font-mono text-[var(--sa-text-tertiary)] shrink-0">{p.style_code}</span>
                        </div>
                        {p.cover_image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.cover_image_url} alt="" className="w-full aspect-[4/3] object-cover rounded mb-1.5" />
                        )}
                        <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--sa-text-tertiary)]">
                          <span className="truncate">{p.target_quantity ? `${p.target_quantity.toLocaleString()} units` : "Qty TBD"}</span>
                        </div>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPendingConfirm(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl p-5">
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-2">Move to Approved for Production?</h2>
            <p className="text-[12px] text-[var(--sa-text-secondary)] mb-3">
              A few things aren&apos;t set yet — this is a soft warning, not a block. You can move ahead and fill in the missing pieces later.
            </p>
            <ul className="mb-4 space-y-1">
              {pendingConfirm.reasons.map((r, i) => (
                <li key={i} className="text-[12px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-amber-500" /> {r}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingConfirm(null)}
                className="rounded-lg border border-[var(--sa-border)] px-4 py-2 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { productId, nextStage } = pendingConfirm;
                  setPendingConfirm(null);
                  performMove(productId, nextStage);
                }}
                className="rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[12px] font-medium text-white hover:opacity-90"
              >
                Move anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
