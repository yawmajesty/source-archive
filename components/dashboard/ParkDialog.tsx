"use client";

import { useEffect, useState } from "react";
import { PauseCircle, CheckCircle2, X } from "lucide-react";
import { setProjectStatus, setInvoiceAside } from "@/app/(app)/dashboard/park-actions";
import type { ProjectStatus } from "@/lib/command-centre";

// ─────────────────────────────────────────────────────────────
// Two clicks, not one.
//
// The morning digest links here, and a link in an email cannot be allowed
// to change anything on its own: spam filters and link previews fetch
// every URL they find, so a one-click park would quietly mark projects
// done that nobody touched. The email gets you to the decision; the
// decision is made here.
// ─────────────────────────────────────────────────────────────

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-t-2xl bg-[var(--sa-window)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--sa-border)] px-5 py-3.5">
          <p className="min-w-0 flex-1 text-[14px] font-semibold text-[var(--sa-text-primary)]">{title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)]"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Choice({
  icon, label, detail, busy, onClick,
}: {
  icon: React.ReactNode; label: string; detail: string; busy: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-start gap-3 rounded-lg border border-[var(--sa-border)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--sa-hover)] disabled:opacity-50"
    >
      <span className="mt-0.5 shrink-0 text-[var(--sa-text-secondary)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--sa-text-primary)]">
          {busy ? "Saving…" : label}
        </span>
        <span className="block text-[11.5px] leading-snug text-[var(--sa-text-tertiary)]">{detail}</span>
      </span>
    </button>
  );
}

export function ParkProjectDialog({
  projectId,
  projectName,
  onClose,
  onDone,
}: {
  projectId: string;
  projectName?: string | null;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const [busy, setBusy] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function choose(status: ProjectStatus) {
    setBusy(status); setError(null);
    const res = await setProjectStatus(projectId, status);
    setBusy(null);
    if (!res.success) { setError(res.error); return; }
    onDone?.(`${res.name} is now ${res.label.toLowerCase()}`);
    onClose();
  }

  return (
    <Shell title="Stop this coming back" onClose={onClose}>
      <p className="text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
        {projectName ? (
          <><strong className="text-[var(--sa-text-primary)]">{projectName}</strong> keeps</>
        ) : (
          "This project keeps"
        )}{" "}
        appearing in your morning digest. Putting it aside stops that. Nothing is deleted or hidden —
        the products, portal and invoices all stay exactly as they are.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Choice
          icon={<PauseCircle size={15} />}
          label="On ice"
          detail="Paused for now. Bring it back whenever it starts moving again."
          busy={busy === "on_ice"}
          onClick={() => choose("on_ice")}
        />
        <Choice
          icon={<CheckCircle2 size={15} />}
          label="Done"
          detail="Finished. It stays in the records and stops asking for attention."
          busy={busy === "done"}
          onClick={() => choose("done")}
        />
      </div>

      {error && <p className="mt-3 text-[12px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
    </Shell>
  );
}

export function ParkInvoiceDialog({
  invoiceId,
  onClose,
  onDone,
}: {
  invoiceId: string;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function park() {
    setBusy(true); setError(null);
    const res = await setInvoiceAside(invoiceId, true);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onDone?.("Set aside — it won't be chased again until you put it back.");
    onClose();
  }

  return (
    <Shell title="Stop chasing this invoice" onClose={onClose}>
      <p className="text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
        It stays on the record and the money is still owed — it just stops appearing in the digest
        and in what you&apos;re chasing. Use this when someone has told you when they&apos;ll pay, or
        when it isn&apos;t worth the chase.
      </p>
      <p className="mt-2 text-[12px] text-[var(--sa-text-tertiary)]">
        This is not the same as marking it paid. Nothing here touches your books.
      </p>

      <div className="mt-4">
        <Choice
          icon={<PauseCircle size={15} />}
          label="Set it aside"
          detail="Put it back from the Invoices page whenever you want to chase again."
          busy={busy}
          onClick={park}
        />
      </div>

      {error && <p className="mt-3 text-[12px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
    </Shell>
  );
}
