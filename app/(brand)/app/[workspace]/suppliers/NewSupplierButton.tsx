"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createSupplier } from "./actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";

export function NewSupplierButton({
  workspaceId, workspaceSlug, mode, role, variant = "outline",
}: {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", country: "", city: "",
    contact_name: "", contact_email: "", contact_phone: "",
    specialties: "", quote_currency: "USD",
    lead_time_notes: "", notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createSupplier({
        workspace_slug: workspaceSlug,
        workspace_id: workspaceId,
        mode, role,
        name: form.name,
        country: form.country || undefined,
        city: form.city || undefined,
        contact_name: form.contact_name || undefined,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        quote_currency: form.quote_currency,
        lead_time_notes: form.lead_time_notes || undefined,
        notes: form.notes || undefined,
      });
      if (!res.success) { setError(res.error); return; }
      setOpen(false);
      setForm({ name: "", country: "", city: "", contact_name: "", contact_email: "", contact_phone: "", specialties: "", quote_currency: "USD", lead_time_notes: "", notes: "" });
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={variant === "primary"
          ? "inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
          : "inline-flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"}
      >
        <Plus size={variant === "primary" ? 14 : 12} /> New supplier
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && setOpen(false)} />
          <form onSubmit={submit} className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)] bg-[var(--sa-window)]">
              <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">New supplier</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-[var(--sa-hover)]"><X size={16} className="text-[var(--sa-text-tertiary)]" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <Field label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Guangzhou Denim Works" autoFocus required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} placeholder="China" />
                <Field label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} placeholder="Guangzhou" />
              </div>
              <Field label="Contact name" value={form.contact_name} onChange={(v) => setForm((f) => ({ ...f, contact_name: v }))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact email" value={form.contact_email} onChange={(v) => setForm((f) => ({ ...f, contact_email: v }))} type="email" />
                <Field label="Phone / WeChat" value={form.contact_phone} onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))} />
              </div>
              <Field label="Specialties (comma separated)" value={form.specialties} onChange={(v) => setForm((f) => ({ ...f, specialties: v }))} placeholder="denim, workwear, wash" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quote currency" value={form.quote_currency} onChange={(v) => setForm((f) => ({ ...f, quote_currency: v }))} />
                <Field label="Lead-time notes" value={form.lead_time_notes} onChange={(v) => setForm((f) => ({ ...f, lead_time_notes: v }))} placeholder="45 days from LC deposit" />
              </div>
              <Field label="General notes" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
              {error && <p className="text-[12px] text-red-500">{error}</p>}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-[var(--sa-border)] bg-[var(--sa-window)]">
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} className="rounded-lg border border-[var(--sa-border)] px-4 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]">Cancel</button>
              <button type="submit" disabled={isPending || !form.name.trim()} className="rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50">{isPending ? "Creating…" : "Create supplier"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, type, multiline, required, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; multiline?: boolean; required?: boolean; autoFocus?: boolean;
}) {
  const common = {
    value, onChange: (e: any) => onChange(e.target.value),
    placeholder, required, autoFocus,
    className: "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]",
  };
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">{label}</label>
      {multiline ? <textarea rows={2} {...common as any} /> : <input type={type ?? "text"} {...common as any} />}
    </div>
  );
}
