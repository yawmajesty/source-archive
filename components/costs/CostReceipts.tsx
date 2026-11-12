"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { listCostReceipts, removeCostReceipt } from "@/app/(app)/costs/receipt-actions";
import {
  MAX_RECEIPTS_PER_COST, RECEIPT_ACCEPT, formatReceiptSize, isAllowedReceipt,
  receiptKey, receiptKind, type CostReceipt,
} from "@/lib/cost-receipts";

// ─────────────────────────────────────────────────────────────
// The receipt for an expense.
//
// Most of these are a photo of a courier slip or a one-page PDF from a
// supplier — small, dull, and the only proof the money went where the line
// says it did. So this is built for the quick case: drop it in, see it
// listed, move on.
//
// Files go browser → Supabase directly against a one-time token, so a 12MP
// photo never touches a Server Action body.
// ─────────────────────────────────────────────────────────────

/**
 * Send files up for an expense that already exists.
 *
 * Shared with the add-an-expense form, which holds its files back until the
 * row is saved — the upload is authorized against the expense, so there has
 * to be an expense first.
 */
export async function uploadReceipts(
  costId: string,
  files: File[],
): Promise<{ uploaded: number; error: string | null }> {
  let uploaded = 0;
  for (const file of files) {
    if (!isAllowedReceipt(file)) {
      return { uploaded, error: `${file.name} is not an image or a PDF.` };
    }
    const result = await uploadFile("cost-receipts", receiptKey(costId, file.name), file);
    if (result.error) return { uploaded, error: result.error };
    uploaded += 1;
  }
  return { uploaded, error: null };
}

function Thumb({ receipt }: { receipt: CostReceipt }) {
  // HEIC is the live case: iPhones produce it, Chrome and Firefox will not
  // draw it, and a broken-image box next to an expense reads as a lost
  // receipt. The icon is the honest fallback — the file is still there and
  // the link still opens it.
  const [broken, setBroken] = useState(false);

  if (receiptKind(receipt) === "pdf" || broken || !receipt.url) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)]">
        <FileText size={15} className="text-[var(--sa-text-tertiary)]" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={receipt.url}
      alt={receipt.name}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="h-10 w-10 shrink-0 rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] object-cover"
    />
  );
}

export function CostReceipts({ costId }: { costId: string }) {
  const [receipts, setReceipts] = useState<CostReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const res = await listCostReceipts(costId);
    setReceipts(res.receipts);
    if (res.error) setError(res.error);
    setLoading(false);
  }, [costId]);

  useEffect(() => {
    let live = true;
    listCostReceipts(costId).then((res) => {
      if (!live) return;
      setReceipts(res.receipts);
      setError(res.error);
      setLoading(false);
    });
    return () => { live = false; };
  }, [costId]);

  const room = MAX_RECEIPTS_PER_COST - receipts.length;

  async function add(picked: FileList | File[] | null) {
    const files = Array.from(picked ?? []);
    if (files.length === 0) return;
    setError(null);

    if (files.length > room) {
      setError(
        room <= 0
          ? `That's the ${MAX_RECEIPTS_PER_COST}-file limit on one entry.`
          : `Room for ${room} more file${room === 1 ? "" : "s"} on this entry.`,
      );
      return;
    }

    setBusy(true);
    const res = await uploadReceipts(costId, files);
    setBusy(false);
    if (res.error) setError(res.error);
    // Even a part-way failure put something up, so the list is refreshed
    // either way rather than leaving the successful ones invisible.
    if (res.uploaded > 0) await reload();
  }

  async function drop(receipt: CostReceipt) {
    setRemoving(receipt.path);
    setError(null);
    const res = await removeCostReceipt(costId, receipt.path);
    setRemoving(null);
    if (!res.success) { setError(res.error ?? "Couldn't remove that file."); return; }
    setReceipts((rows) => rows.filter((r) => r.path !== receipt.path));
  }

  return (
    <div
      // min-w-0 because this sits inside a dialog laid out as a grid, and a
      // grid item defaults to min-width:auto — a long filename would widen
      // the whole column and push the card's own header out with it.
      className="min-w-0"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
    >
      {loading ? (
        <p className="py-2 text-[12px] text-[var(--sa-text-tertiary)]">Looking…</p>
      ) : (
        <>
          {receipts.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5">
              {receipts.map((receipt) => (
                <div
                  key={receipt.path}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1.5"
                >
                  <a href={receipt.url} target="_blank" rel="noreferrer" className="shrink-0">
                    <Thumb receipt={receipt} />
                  </a>
                  <div className="min-w-0 flex-1">
                    <a
                      href={receipt.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-[12.5px] font-medium text-[var(--sa-accent)] hover:underline"
                    >
                      {receipt.name}
                    </a>
                    <p className="text-[10.5px] text-[var(--sa-text-tertiary)]">
                      {receiptKind(receipt) === "pdf" ? "PDF" : "Image"}
                      {receipt.size > 0 ? ` · ${formatReceiptSize(receipt.size)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => drop(receipt)}
                    disabled={removing === receipt.path}
                    title="Remove this file"
                    className="shrink-0 rounded p-1 text-[var(--sa-text-tertiary)] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
                  >
                    {removing === receipt.path ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => input.current?.click()}
            disabled={busy || room <= 0}
            className={[
              "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[11.5px] transition-colors disabled:opacity-50",
              dragging
                ? "border-[var(--sa-accent)] bg-[var(--sa-hover)] text-[var(--sa-accent)]"
                : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]",
            ].join(" ")}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : receipts.length > 0 ? <Plus size={12} /> : <Paperclip size={12} />}
            {busy
              ? "Uploading…"
              : room <= 0
                ? `${MAX_RECEIPTS_PER_COST} files is the limit`
                : receipts.length > 0
                  ? "Add another"
                  : "Attach a receipt — photo or PDF"}
          </button>

          {receipts.length === 0 && !error && (
            <p className="mt-1 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
              Only people with costing access can see these, and the link
              expires, so it can&apos;t be forwarded on.
            </p>
          )}

          <input
            ref={input}
            type="file"
            multiple
            accept={RECEIPT_ACCEPT}
            className="hidden"
            onChange={(e) => { add(e.target.files); e.target.value = ""; }}
          />
        </>
      )}

      {error && <p className="mt-1.5 text-[11.5px] text-[var(--sa-danger)]">{error}</p>}
    </div>
  );
}

/**
 * The same thing on the add-an-expense form, where the expense does not
 * exist yet. Files are held here and sent up by the form once the row is
 * saved, so cancelling the form leaves nothing behind in storage.
 */
export function StagedReceipts({
  files, onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function add(picked: FileList | null) {
    const incoming = Array.from(picked ?? []);
    if (incoming.length === 0) return;
    const bad = incoming.find((f) => !isAllowedReceipt(f));
    if (bad) { setError(`${bad.name} is not an image or a PDF.`); return; }
    const next = [...files, ...incoming].slice(0, MAX_RECEIPTS_PER_COST);
    setError(next.length < files.length + incoming.length ? `${MAX_RECEIPTS_PER_COST} files is the limit.` : null);
    onChange(next);
  }

  return (
    <div>
      {files.length > 0 && (
        <div className="mb-1.5 flex flex-col gap-1">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1.5 text-[12px]"
            >
              <Paperclip size={11} className="shrink-0 text-[var(--sa-text-tertiary)]" />
              <span className="min-w-0 flex-1 truncate text-[var(--sa-text-primary)]">{file.name}</span>
              <span className="shrink-0 text-[10.5px] text-[var(--sa-text-tertiary)]">{formatReceiptSize(file.size)}</span>
              <button
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                title="Remove"
                className="shrink-0 rounded p-0.5 text-[var(--sa-text-tertiary)] hover:text-red-500"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => input.current?.click()}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--sa-border)] py-2 text-[11.5px] text-[var(--sa-text-secondary)] transition-colors hover:bg-[var(--sa-hover)]"
      >
        <Paperclip size={12} />
        {files.length > 0 ? "Add another" : "Attach a receipt — photo or PDF"}
      </button>

      <input
        ref={input}
        type="file"
        multiple
        accept={RECEIPT_ACCEPT}
        className="hidden"
        onChange={(e) => { add(e.target.files); e.target.value = ""; }}
      />

      {error && <p className="mt-1 text-[11.5px] text-[var(--sa-danger)]">{error}</p>}
    </div>
  );
}
