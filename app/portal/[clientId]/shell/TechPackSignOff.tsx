"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, Upload, Maximize2, ExternalLink, Download, X } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { imageUrl as sizedImage } from "@/lib/image-url";
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

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|bmp|tiff?)(\?|$)/i;
const PDF_EXT = /\.pdf(\?|$)/i;

/**
 * A look at the actual document, not a filename.
 *
 * A tech pack is the thing being signed, so asking somebody to agree to it
 * from a link they have to open elsewhere is asking them to sign something
 * they probably have not read.
 *
 * Three ways to read it, because one is never enough for a specification:
 * inline for a glance, full screen for actually going through it, and a
 * plain link for anyone who would rather have the file.
 *
 * PDFs go in an iframe, which is safe because Supabase serves them as
 * application/pdf with no attachment disposition and honours range
 * requests — a 17MB pack answered a Range header with a 206. The browser's
 * own viewer streams the first page rather than blocking on the whole file.
 */
function DocumentView({
  url, name, full,
}: {
  url: string;
  name: string | null;
  /** Full screen gets the viewer's toolbar; inline does not need it. */
  full?: boolean;
}) {
  const isImage = IMAGE_EXT.test(url);
  const isPdf = PDF_EXT.test(url);

  if (isImage) {
    return (
      <img
        loading="lazy"
        decoding="async"
        src={full ? url : sizedImage(url, 760, { resize: "contain", quality: 84 })}
        alt={name ?? "Tech pack"}
        className={full ? "mx-auto block max-h-full max-w-full object-contain" : "block w-full"}
        style={full ? undefined : { background: "var(--portal-surface)" }}
      />
    );
  }

  if (isPdf) {
    return (
      <iframe
        src={`${url}#view=FitH${full ? "" : "&toolbar=0"}`}
        title={name ?? "Tech pack"}
        loading="lazy"
        className={full ? "h-full w-full" : "block h-[clamp(420px,62vh,780px)] w-full"}
        style={{ background: "var(--portal-surface)" }}
      />
    );
  }

  // Anything a browser will not draw — a spreadsheet, a zip of patterns.
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 px-3.5 py-3"
      style={{ background: "var(--portal-surface-raised)" }}>
      <FileText size={15} style={{ color: "var(--portal-text-muted)" }} />
      <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--portal-text-primary)" }}>
        {name ?? "Open the tech pack"}
      </span>
      <span className="shrink-0 text-[11px]" style={{ color: "var(--portal-brand)" }}>Open</span>
    </a>
  );
}

/** The inline preview, with the ways out of it. */
function Preview({ url, name }: { url: string; name: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const readable = IMAGE_EXT.test(url) || PDF_EXT.test(url);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", onKey);
    // A document reader that leaves the page scrolling behind it is a
    // document reader nobody can use on a phone.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  return (
    <>
      <div className="mt-2.5 overflow-hidden rounded-xl" style={{ border: "1px solid var(--portal-border)" }}>
        <DocumentView url={url} name={name} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {readable && (
          <button onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-[11.5px] font-medium hover:underline"
            style={{ color: "var(--portal-brand)" }}>
            <Maximize2 size={11} /> Read it full screen
          </button>
        )}
        <a href={url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[11.5px] hover:underline"
          style={{ color: "var(--portal-text-muted)" }}>
          <ExternalLink size={11} /> Open in a new tab
        </a>
        <a href={url} download={name ?? undefined}
          className="flex items-center gap-1 text-[11.5px] hover:underline"
          style={{ color: "var(--portal-text-muted)" }}>
          <Download size={11} /> Download
        </a>
      </div>

      {expanded && (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "rgba(0,0,0,0.92)" }}>
          <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/70">{name ?? "Tech pack"}</p>
            <a href={url} target="_blank" rel="noreferrer"
              className="shrink-0 text-[12px] text-white/60 hover:text-white">Open in a new tab</a>
            <button onClick={() => setExpanded(false)} aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "rgba(255,255,255,0.14)" }}>
              <X size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            <DocumentView url={url} name={name} full />
          </div>
        </div>
      )}
    </>
  );
}

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
          <div>
            <div className="flex items-start gap-2.5 rounded-xl p-3.5"
              style={{ border: "1px solid var(--portal-border)", background: "var(--portal-surface-raised)" }}>
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

            <Preview url={current.file_url} name={current.file_name} />
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
                <details key={p.id} className="group">
                  <summary className="flex cursor-pointer items-baseline gap-2 py-0.5 text-[11px] list-none">
                    <span className="shrink-0 group-open:font-medium" style={{ color: "var(--portal-brand)" }}>
                      v{p.version}
                    </span>
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--portal-text-muted)" }}>
                      {p.client_signed_at ? `signed ${when(p.client_signed_at)}` : "not signed"}
                    </span>
                  </summary>
                  {/* Inside a details element, so nothing is fetched until
                      somebody asks to compare. */}
                  <Preview url={p.file_url} name={p.file_name} />
                </details>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-[12px]" style={{ color: "#C0392B" }}>{error}</p>}
    </div>
  );
}
