"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Check, Loader2 } from "lucide-react";
import { CATEGORIES, STAGES, type Product, type CategoryKey, type Stage } from "@/lib/brand-catalog";
import { StageBadge } from "@/components/brand/StageBadge";
import { updateProduct, changeProductStage } from "../../actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { cn } from "@/lib/utils";

// Column layout — resize the widths here if you tweak content.
// Inline editing follows a "click, edit, blur to save" pattern with a
// tiny Saved indicator so users can see writes land.
export function CollectionTable({
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
  const [rows, setRows] = useState<Product[]>(initial);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--sa-border)] bg-[var(--sa-window)] px-8 py-20 text-center">
        <Package size={28} className="mx-auto text-[var(--sa-text-tertiary)] mb-3" strokeWidth={1.5} />
        <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-1">
          Nothing to show yet
        </h2>
        <p className="text-[12px] text-[var(--sa-text-tertiary)] max-w-sm mx-auto">
          Add a product from the button above and it will appear here — every column is inline-editable.
        </p>
      </div>
    );
  }

  const totalQty = rows.reduce((s, r) => s + (r.target_quantity ?? 0), 0);

  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--sa-bg)] border-b border-[var(--sa-border)] sticky top-0">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)] w-[80px]">Style</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]">Name</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)] w-[140px]">Category</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)] w-[180px]">Stage</th>
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)] w-[100px]">Target qty</th>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)] w-[60px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--sa-border)]">
            {rows.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                collectionId={collectionId}
                mode={mode}
                role={role}
                onLocalUpdate={(patch) =>
                  setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, ...patch } : r)))
                }
              />
            ))}
          </tbody>
          <tfoot className="bg-[var(--sa-bg)] border-t border-[var(--sa-border)]">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-[var(--sa-text-tertiary)]">
                Total ({rows.length} products)
              </td>
              <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">
                {totalQty > 0 ? totalQty.toLocaleString() : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────

function ProductRow({
  product: p,
  workspaceId,
  workspaceSlug,
  collectionId,
  mode,
  role,
  onLocalUpdate,
}: {
  product: Product;
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  mode: WorkspaceMode;
  role: Role;
  onLocalUpdate: (patch: Partial<Product>) => void;
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function persist<K extends keyof Product>(patch: Partial<Pick<Product, K>>) {
    setSaveState("saving");
    startTransition(async () => {
      const res = await updateProduct({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        product_id: p.id,
        mode,
        role,
        patch: patch as any,
      });
      if (!res.success) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
      router.refresh();
    });
  }

  function persistStage(next: Stage) {
    setSaveState("saving");
    startTransition(async () => {
      const res = await changeProductStage({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        product_id: p.id,
        mode,
        role,
        next_stage: next,
        previous_stage: p.stage,
      });
      if (!res.success) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
      router.refresh();
    });
  }

  return (
    <tr className="hover:bg-[var(--sa-hover)]/50 transition-colors">
      <td className="px-3 py-2 font-mono text-[11px] text-[var(--sa-text-tertiary)] whitespace-nowrap">
        {p.style_code}
      </td>
      <td className="px-3 py-2">
        <InlineText
          value={p.name}
          onSave={(v) => {
            onLocalUpdate({ name: v });
            persist({ name: v });
          }}
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={p.category}
          onChange={(e) => {
            const v = e.target.value as CategoryKey;
            onLocalUpdate({ category: v });
            persist({ category: v });
          }}
          className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[12px] text-[var(--sa-text-primary)] hover:border-[var(--sa-border)] focus:border-[var(--sa-accent)] focus:bg-[var(--sa-bg)] outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <StageBadge stage={p.stage} size="xs" />
          <select
            value={p.stage}
            onChange={(e) => persistStage(e.target.value as Stage)}
            className="flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:border-[var(--sa-border)] focus:border-[var(--sa-accent)] focus:bg-[var(--sa-bg)] outline-none"
          >
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <InlineNumber
          value={p.target_quantity}
          onSave={(v) => {
            onLocalUpdate({ target_quantity: v });
            persist({ target_quantity: v });
          }}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <SaveIndicator state={saveState} />
          <Link
            href={`/app/${workspaceSlug}/collections/${collectionId}/products/${p.id}`}
            className="text-[11px] text-[var(--sa-accent)] hover:underline"
          >
            Open
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Inline editors ────────────────────────────────────────────────

function InlineText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && v.trim() && onSave(v.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value);
      }}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-[var(--sa-text-primary)] hover:border-[var(--sa-border)] focus:border-[var(--sa-accent)] focus:bg-[var(--sa-bg)] outline-none"
    />
  );
}

function InlineNumber({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value != null ? String(value) : "");
  return (
    <input
      type="number"
      min={0}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const next = v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0);
        if (next !== value) onSave(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value != null ? String(value) : "");
      }}
      placeholder="—"
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[12px] font-mono text-right text-[var(--sa-text-primary)] hover:border-[var(--sa-border)] focus:border-[var(--sa-accent)] focus:bg-[var(--sa-bg)] outline-none"
    />
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  if (state === "saving") return <Loader2 size={11} className="text-[var(--sa-text-tertiary)] animate-spin" />;
  if (state === "saved") return <Check size={11} className="text-emerald-500" />;
  return <span className="text-[10px] text-red-500">Retry</span>;
}
