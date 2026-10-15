"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, FileText, Upload, History } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import {
  listTechPacks, addTechPackVersion, signTechPackAsAgency, unsignTechPackAsAgency,
  setProductPhases, type TechPack,
} from "@/app/(app)/products/[id]/techpack-actions";

// ─────────────────────────────────────────────────────────────
// Tech packs on our side.
//
// Two checkboxes decide whether a product has a design phase and a tech
// pack phase at all — most clients buy neither, and a timeline carrying two
// dead steps is worse than one without them.
//
// Below that, the versions. The newest is the one that counts; older ones
// keep their signatures, because "we sampled from v2" only means something
// if v1 is still readable.
// ─────────────────────────────────────────────────────────────

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function TechPackPanel({
  productId, needsDesign: initialDesign, needsTechpack: initialTechpack,
}: {
  productId: string; needsDesign: boolean; needsTechpack: boolean;
}) {
  const [needsDesign, setNeedsDesign] = useState(initialDesign);
  const [needsTechpack, setNeedsTechpack] = useState(initialTechpack);
  const [packs, setPacks] = useState<TechPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let live = true;
    listTechPacks(productId).then((rows) => { if (live) { setPacks(rows); setLoading(false); } });
    return () => { live = false; };
  }, [productId]);

  async function togglePhase(which: "design" | "techpack", next: boolean) {
    setError(null);
    if (which === "design") setNeedsDesign(next); else setNeedsTechpack(next);
    const res = await setProductPhases(
      productId,
      which === "design" ? { needs_design: next } : { needs_techpack: next },
    );
    if (!res.success) {
      setError(res.error);
      if (which === "design") setNeedsDesign(!next); else setNeedsTechpack(!next);
    }
  }

  async function upload(file: File) {
    setBusy(true); setError(null);
    const key = `techpack/${productId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await uploadFile("product-media", key, file);
    if (up.error || !up.url) { setError(up.error ?? "Upload failed"); setBusy(false); return; }
    const res = await addTechPackVersion({
      productId, fileUrl: up.url, filePath: key, fileName: file.name, changeNote: changeNote || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setChangeNote("");
    setPacks(await listTechPacks(productId));
  }

  async function sign(pack: TechPack) {
    setBusy(true); setError(null);
    const res = pack.agency_signed_at
      ? await unsignTechPackAsAgency(pack.id)
      : await signTechPackAsAgency(pack.id);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setPacks(await listTechPacks(productId));
  }

  const current = packs.find((p) => !p.superseded_at) ?? packs[0] ?? null;
  const history = packs.filter((p) => p.id !== current?.id);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)]">
      <div className="px-4 py-3 panel-border-b">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
          Extra phases
        </span>
        <p className="mt-0.5 text-[10px] text-[var(--sa-text-tertiary)]">
          Only on this product&apos;s timeline when ticked
        </p>
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-3">
        {([
          ["design", "Design", needsDesign, "We're drawing it up."],
          ["techpack", "Tech pack", needsTechpack, "A spec both sides sign before sampling."],
        ] as const).map(([id, label, on, hint]) => (
          <button key={id} onClick={() => togglePhase(id, !on)}
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--sa-hover)]">
            <span className="mt-[1px] shrink-0">
              {on ? <CheckCircle2 size={15} className="text-[var(--sa-accent)]" />
                  : <Circle size={15} className="text-[var(--sa-border-strong)]" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-[var(--sa-text-primary)]">{label}</span>
              <span className="block text-[11px] leading-snug text-[var(--sa-text-tertiary)]">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      {needsTechpack && (
        <div className="border-t border-[var(--sa-border)] px-4 py-3">
          {loading ? (
            <p className="text-[12px] text-[var(--sa-text-tertiary)]">Loading…</p>
          ) : (
            <>
              {current ? (
                <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="mt-0.5 shrink-0 text-[var(--sa-text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <a href={current.file_url} target="_blank" rel="noreferrer"
                        className="block truncate text-[12.5px] font-medium text-[var(--sa-accent)] hover:underline">
                        v{current.version} · {current.file_name ?? "Tech pack"}
                      </a>
                      <p className="text-[10.5px] text-[var(--sa-text-tertiary)]">
                        {current.uploaded_by === "client" ? "Uploaded by the client" : "Uploaded by us"} · {when(current.created_at)}
                      </p>
                      {current.change_note && (
                        <p className="mt-1 text-[11.5px] leading-snug text-[var(--sa-text-secondary)]">{current.change_note}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[var(--sa-border)] pt-2.5">
                    <button onClick={() => sign(current)} disabled={busy}
                      className="flex items-center gap-1.5 text-left text-[12px] disabled:opacity-50"
                      style={{ color: current.agency_signed_at ? "var(--sa-success)" : "var(--sa-text-secondary)" }}>
                      {current.agency_signed_at ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      {current.agency_signed_at
                        ? `Signed off by us · ${when(current.agency_signed_at)}`
                        : "Sign off on our side"}
                    </button>
                    <p className="flex items-center gap-1.5 text-[12px]"
                      style={{ color: current.client_signed_at ? "var(--sa-success)" : "var(--sa-text-tertiary)" }}>
                      {current.client_signed_at ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      {current.client_signed_at
                        ? `Signed by ${current.client_signed_name ?? "the client"} · ${when(current.client_signed_at)}`
                        : current.agency_signed_at ? "Waiting on the client" : "The client can sign once we have"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--sa-text-tertiary)]">
                  No tech pack yet. Upload one and the client is asked to sign it.
                </p>
              )}

              <div className="mt-3">
                <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)}
                  placeholder={current ? "What changed in this version?" : "Note (optional)"}
                  className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]" />
                <label className="mt-1.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--sa-border)] py-2 text-[11.5px] text-[var(--sa-text-secondary)] transition-colors hover:bg-[var(--sa-hover)]">
                  <Upload size={12} />
                  {busy ? "Uploading…" : current ? `Upload v${current.version + 1}` : "Upload the tech pack"}
                  <input type="file" className="hidden" disabled={busy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                </label>
                {current && (
                  <p className="mt-1 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
                    A new version replaces this one and clears both signatures — the client is asked to sign again.
                  </p>
                )}
              </div>

              {history.length > 0 && (
                <>
                  <button onClick={() => setShowHistory((v) => !v)}
                    className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]">
                    <History size={11} /> {showHistory ? "Hide" : `${history.length} earlier version${history.length === 1 ? "" : "s"}`}
                  </button>
                  {showHistory && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      {history.map((p) => (
                        <div key={p.id} className="flex items-baseline gap-2 text-[11px]">
                          <a href={p.file_url} target="_blank" rel="noreferrer"
                            className="shrink-0 text-[var(--sa-accent)] hover:underline">v{p.version}</a>
                          <span className="min-w-0 flex-1 truncate text-[var(--sa-text-tertiary)]">
                            {p.client_signed_at
                              ? `signed by ${p.client_signed_name ?? "the client"} · ${when(p.client_signed_at)}`
                              : "never signed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
        </div>
      )}

      {!needsTechpack && error && <p className="px-4 pb-3 text-[11.5px] text-red-500">{error}</p>}
    </section>
  );
}
