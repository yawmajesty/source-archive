"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, MapPin, Trash2 } from "lucide-react";
import type { Supplier } from "@/lib/brand-suppliers";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { deleteSupplier } from "./actions";

export function SupplierList({
  workspaceSlug, mode, role, suppliers, canManage,
}: {
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  suppliers: Supplier[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(s: Supplier) {
    if (!window.confirm(`Remove "${s.name}" from your suppliers?`)) return;
    startTransition(async () => {
      const res = await deleteSupplier({
        workspace_slug: workspaceSlug,
        mode, role,
        supplier_id: s.id,
      });
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {suppliers.map((s) => (
        <div key={s.id} className="group rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-[var(--sa-text-primary)] truncate">{s.name}</h3>
              {(s.country || s.city) && (
                <p className="text-[11px] text-[var(--sa-text-tertiary)] mt-0.5 flex items-center gap-1">
                  <MapPin size={10} /> {[s.city, s.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            {canManage && (
              <button
                onClick={() => handleDelete(s)}
                disabled={isPending}
                className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-[var(--sa-text-tertiary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                title="Remove supplier"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {s.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {s.specialties.slice(0, 5).map((sp, i) => (
                <span key={i} className="rounded-full bg-[var(--sa-hover)] px-2 py-0.5 text-[10px] text-[var(--sa-text-secondary)] border border-[var(--sa-border)]">{sp}</span>
              ))}
            </div>
          )}

          {s.contact_name && (
            <p className="text-[12px] text-[var(--sa-text-secondary)] font-medium mt-1">{s.contact_name}</p>
          )}
          {s.contact_email && (
            <a href={`mailto:${s.contact_email}`} className="flex items-center gap-1.5 text-[11px] text-[var(--sa-accent)] hover:underline truncate">
              <Mail size={10} /> {s.contact_email}
            </a>
          )}
          {s.contact_phone && (
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--sa-text-secondary)]">
              <Phone size={10} /> {s.contact_phone}
            </p>
          )}

          {(s.lead_time_notes || s.quote_currency) && (
            <div className="mt-2 pt-2 border-t border-[var(--sa-border)] space-y-0.5">
              {s.quote_currency && (
                <p className="text-[10px] text-[var(--sa-text-tertiary)]">Quotes in <span className="font-mono">{s.quote_currency}</span></p>
              )}
              {s.lead_time_notes && (
                <p className="text-[10px] text-[var(--sa-text-tertiary)] line-clamp-2">{s.lead_time_notes}</p>
              )}
            </div>
          )}

          {s.notes && (
            <p className="text-[11px] text-[var(--sa-text-tertiary)] italic mt-1 line-clamp-3">{s.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
