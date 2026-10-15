"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, Upload } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import {
  listTechPacksForPortal, signTechPackAsClient, uploadTechPackAsClient,
  type PortalTechPack,
} from "@/app/portal/[clientId]/techpack-actions";

// ─────────────────────────────────────────────────────────────
// Signing the specification.
//
// This is the thing a sample gets cut from, so the wording has to be plain
// about what ticking the box commits to: everything in this document, as it
// stands, is what gets made. Vague consent is worse than none — it is the
// argument you have later when the sample arrives.
//
// Only the current version can be signed, and a new version clears the
// signatures rather than carrying them forward. Agreement to v2 is not
// agreement to v3.
// ─────────────────────────────────────────────────────────────

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function TechPackSignOff({
  productId,
  clientId,
  clientName,
}: {
  productId: string;
  clientId: string;
  clientName: string;
}) {
  const [packs, setPacks] = useState<PortalTechPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedName, setSignedName] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function reload() {
    setPacks(await listTechPacksForPortal(productId, clientId));
  }

  useEffect(() => {
    let live = true;
    listTechPacksForPortal(productId, clientId).then((rows) => {
      if (!live) return;
      setPacks(rows);
      setLoading(false);
    });
    return () => { live = false; };
  }, [productId, clientId]);

  const current = packs.find((p) => !p.superseded_at) ?? packs[0] ?? null;
  const older = packs.filter((p) => p.id !== current?.id);

  async function sign() {
    if (!current) return;
    setBusy(true);
    setError(null);
    const res = await signTechPackAsClient({
      techpackId: current.id,
      clientId,
      signedName: signedName || clientName,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setConfirmed(false);
    setSignedName("");
    await reload();
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const key = `techpack/${productId}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await uploadFile("product-media", key, file);
    if (up.error || !up.url) { setError(up.error ?? "Upload failed"); setBusy(false); return; }
    const res = await uploadTechPackAsClient({
      productId, clientId, fileUrl: up.url, filePath: key, fileName: file.name, uploaderName: clientName,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    await reload();
  }

  if (loading) return null;

  return (
    <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--portal-border-subtle)" }}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
        Tech pack
      </p>

      {!current ? (
        <>
          <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--portal-text-secondary)" }}>
            No tech pack yet. We&apos;ll upload one for you to read and sign — or if you already have
            one, send it over here.
          </p>
          <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px]"
            style={{ border: "1px dashed var(--portal-border)", color: "var(--portal-text-secondary)" }}>
            <Upload size={13} /> {busy ? "Uploading…" : "Upload your tech pack"}
            <input type="file" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </label>
        </>
      ) : (
        <>
          <div className="rounded-xl p-3.5" style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface-raised)" }}>
            <div className="flex items-start gap-2.5">
              <FileText size={15} className="mt-0.5 shrink-0" style={{ color: "var(--portal-text-muted)" }} />
              <div className="min-w-0 flex-1">
                <a href={current.file_url} target="_blank" rel="noreferrer"
                  className="block truncate text-[13.5px] font-medium hover:underline"
                  style={{ color: "var(--portal-brand)" }}>
                  {current.file_name ?? `Tech pack v${current.version}`}
                </a>
                <p className="text-[11px]" style={{ color: "var(--portal-text-muted)" }}>
                  Version {current.version} · {when(current.created_at)}
                  {current.uploaded_by === "client" && " · sent by you"}
                </p>
                {current.change_note && (
                  <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--portal-text-secondary)" }}>
                    {current.change_note}
                  </p>
                )}
              </div>
            </div>
          </div>

          {current.client_signed_at ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl px-3.5 py-3"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "#0E7C66" }} />
              <p className="text-[12.5px] leading-snug" style={{ color: "#0E7C66" }}>
                Signed off by {current.client_signed_name ?? "you"} on {when(current.client_signed_at)}.
                We&apos;re making the sample to this version.
              </p>
            </div>
          ) : !current.agency_signed_at ? (
            <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--portal-text-muted)" }}>
              We&apos;re checking this version over. You&apos;ll be asked to sign it once we&apos;re done.
            </p>
          ) : (
            <div className="mt-3 rounded-xl p-3.5" style={{ border: "1px solid var(--portal-border)" }}>
              <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--portal-text-secondary)" }}>
                Please read it through. Signing below means <strong style={{ color: "var(--portal-text-primary)" }}>
                everything specified in version {current.version} is what you want made</strong> — the
                designs, the measurements, the materials and the finishing. We&apos;ll cut the sample from
                it. If anything needs changing, tell us first and we&apos;ll send a new version.
              </p>

              <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-[12.5px] leading-snug" style={{ color: "var(--portal-text-primary)" }}>
                  I&apos;ve read version {current.version} and I&apos;m signing it off.
                </span>
              </label>

              <input value={signedName} onChange={(e) => setSignedName(e.target.value)}
                placeholder={`Your name (e.g. ${clientName})`}
                className="mt-2.5 w-full rounded-lg px-3 py-2 text-[13px] outline-none"
                style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface)", color: "var(--portal-text-primary)" }} />

              <button onClick={sign} disabled={busy || !confirmed || !(signedName || clientName).trim()}
                className="mt-2.5 w-full rounded-xl py-2.5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: "var(--portal-brand)" }}>
                {busy ? "Signing…" : "Sign off on this tech pack"}
              </button>
            </div>
          )}

          <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[11.5px]"
            style={{ border: "1px dashed var(--portal-border)", color: "var(--portal-text-muted)" }}>
            <Upload size={11} /> {busy ? "Uploading…" : "Send a revised tech pack instead"}
            <input type="file" className="hidden" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </label>

          {older.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[10.5px]" style={{ color: "var(--portal-text-muted)" }}>Earlier versions</p>
              {older.map((p) => (
                <div key={p.id} className="flex items-baseline gap-2 text-[11px]">
                  <a href={p.file_url} target="_blank" rel="noreferrer" className="shrink-0 hover:underline"
                    style={{ color: "var(--portal-brand)" }}>v{p.version}</a>
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--portal-text-muted)" }}>
                    {p.client_signed_at ? `signed ${when(p.client_signed_at)}` : "not signed"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-[12px]" style={{ color: "#C0392B" }}>{error}</p>}
    </div>
  );
}
