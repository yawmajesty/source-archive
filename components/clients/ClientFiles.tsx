"use client";

import { useEffect, useState } from "react";
import { FileText, Upload, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { uploadFile, MAX_UPLOAD_BYTES } from "@/lib/storage";
import {
  listClientFiles, shareFileWithClient, deleteSharedFile, type SharedFile,
} from "@/app/(app)/clients/file-actions";

// ─────────────────────────────────────────────────────────────
// Files, both directions.
//
// The portal's "Shared by agency" box has been promising QC reports and
// certificates since the beginning, with nothing anywhere able to put one
// there. This is the other end of it — and it also shows what clients have
// sent up, which previously landed in a table nobody read.
// ─────────────────────────────────────────────────────────────

function size(kb: number): string {
  if (kb >= 1048576) return `${(kb / 1048576).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ClientFiles({ clientId }: { clientId: string }) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function reload() {
    const res = await listClientFiles(clientId);
    setFiles(res.files);
    setSetupNeeded(res.setupNeeded);
  }

  useEffect(() => {
    let live = true;
    listClientFiles(clientId).then((res) => {
      if (!live) return;
      setFiles(res.files);
      setSetupNeeded(res.setupNeeded);
      setLoading(false);
    });
    return () => { live = false; };
  }, [clientId]);

  async function share(file: File) {
    setBusy(true);
    setError(null);
    const key = `${clientId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await uploadFile("portal-files", key, file);
    if (up.error || !up.url) { setError(up.error ?? "Upload failed"); setBusy(false); return; }
    const res = await shareFileWithClient({
      clientId, fileUrl: up.url, filePath: key, filename: file.name,
      sizeBytes: file.size, contentType: file.type || null, note: note || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setNote("");
    await reload();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this file from their portal?")) return;
    setBusy(true);
    setError(null);
    const res = await deleteSharedFile(id, clientId);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    await reload();
  }

  if (setupNeeded) {
    return (
      <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
        <p className="text-[12.5px] text-[var(--sa-text-secondary)]">
          File sharing needs a one-time database step — run{" "}
          <code className="text-[11.5px]">migrations/047_portal_file_sharing.sql</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
      <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
        <FileText size={14} className="shrink-0 text-[var(--sa-text-tertiary)]" />
        <h3 className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">Files</h3>
        <span className="tnum shrink-0 text-[11.5px] text-[var(--sa-text-tertiary)]">{files.length}</span>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
            Nothing shared either way yet. Anything you send here shows up under Files in their
            portal, and they get an email about it.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {files.map((f) => (
              <div key={f.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                <span className="shrink-0" title={f.source === "agency" ? "Sent by us" : "Sent by them"}>
                  {f.source === "agency"
                    ? <ArrowUpRight size={12} className="text-[var(--sa-accent)]" />
                    : <ArrowDownLeft size={12} className="text-[var(--sa-success)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  {f.file_url ? (
                    <a href={f.file_url} target="_blank" rel="noreferrer"
                      className="block truncate text-[12.5px] text-[var(--sa-accent)] hover:underline">
                      {f.filename}
                    </a>
                  ) : (
                    <span className="block truncate text-[12.5px] text-[var(--sa-text-primary)]">
                      {f.filename}
                    </span>
                  )}
                  <span className="block truncate text-[11px] text-[var(--sa-text-tertiary)]">
                    {size(f.size_kb)} · {when(f.uploaded_at)}
                    {f.uploaded_by_name ? ` · ${f.uploaded_by_name}` : ""}
                    {f.note ? ` · ${f.note}` : ""}
                  </span>
                </span>
                <button onClick={() => remove(f.id)} disabled={busy} aria-label="Remove"
                  className="shrink-0 rounded p-1 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--sa-danger)] focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-[var(--sa-border)] pt-3">
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="A line about what it is (optional)"
            className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]" />
          <label className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--sa-border)] py-2 text-[11.5px] text-[var(--sa-text-secondary)] transition-colors hover:bg-[var(--sa-hover)]">
            <Upload size={12} />
            {busy ? "Uploading…" : `Share a file · max ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB`}
            <input type="file" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) share(f); }} />
          </label>
        </div>

        {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
      </div>
    </section>
  );
}
