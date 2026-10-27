"use client";

import { useState } from "react";
import { CloudUpload, FileText, Check, Clock, TriangleAlert } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { deliverTechPack, type StudioBoard, type StudioJob } from "./actions";

// ─────────────────────────────────────────────────────────────
// What the outside studio sees.
//
// One screen, one job per card, and nothing on it they have to decide.
// They do not pick the client, they do not pick the product, and above
// all they do not type a version number — the version is worked out from
// what is already on the product, because a studio guessing "v2" against
// a product already holding a v2 is a failed upload they cannot diagnose.
// ─────────────────────────────────────────────────────────────

function StatusChip({ job }: { job: StudioJob }) {
  const delivered = job.status === "delivered" || job.status === "accepted";
  const accepted = job.status === "accepted";
  const label = accepted ? "Accepted" : delivered ? "Delivered" : "Waiting on you";
  const colour = accepted
    ? "var(--sa-success)"
    : delivered
      ? "var(--sa-text-secondary)"
      : "var(--sa-warning)";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: colour, background: "var(--sa-hover)" }}
    >
      {accepted ? <Check size={10} /> : delivered ? <Check size={10} /> : <Clock size={10} />}
      {label}
    </span>
  );
}

function JobCard({ job, token, onDone }: { job: StudioJob; token: string; onDone: (v: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [justSent, setJustSent] = useState<number | null>(null);

  const next = job.currentVersion + 1;

  async function send(file: File) {
    setBusy(true);
    setError(null);
    const key = `${job.productId}/techpack-${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const up = await uploadFile("product-media", key, file);
    if (up.error || !up.url) {
      setError(up.error ?? "Upload failed");
      setBusy(false);
      return;
    }
    const res = await deliverTechPack({
      token,
      jobId: job.id,
      fileUrl: up.url,
      filePath: key,
      fileName: file.name,
      changeNote: note || null,
      uploaderName: who || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setJustSent(res.version);
    setNote("");
    onDone(res.version);
  }

  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {job.clientName && (
            <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
              {job.clientName}
            </div>
          )}
          <h2 className="mt-0.5 truncate text-sm font-semibold text-[var(--sa-text-primary)]">
            {job.productName}
          </h2>
        </div>
        <StatusChip job={job} />
      </div>

      {job.brief && (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--sa-text-secondary)]">
          {job.brief}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--sa-text-tertiary)]">
        {job.dueDate && <span>Due {new Date(job.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>}
        <span>
          {job.currentVersion === 0
            ? "Nothing delivered yet"
            : `Version ${job.currentVersion} is the current pack`}
        </span>
      </div>

      {job.delivered.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-[var(--sa-border)] pt-2">
          {job.delivered.map((d) => (
            <a
              key={d.version}
              href={d.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[11px] text-[var(--sa-text-secondary)] hover:underline"
            >
              <FileText size={11} className="shrink-0" />
              <span className="min-w-0 truncate">v{d.version} — {d.fileName ?? "Tech pack"}</span>
            </a>
          ))}
        </div>
      )}

      {justSent != null ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--sa-hover)] p-2.5 text-xs font-medium" style={{ color: "var(--sa-success)" }}>
          <Check size={13} /> Version {justSent} received. The team has been told.
        </p>
      ) : (
        <div className="mt-3 border-t border-[var(--sa-border)] pt-3">
          <div className="flex flex-col gap-2">
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full min-w-0 rounded-md border border-[var(--sa-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={next === 1 ? "Anything we should know (optional)" : "What changed in this version (optional)"}
              className="w-full min-w-0 rounded-md border border-[var(--sa-border)] bg-transparent px-2.5 py-1.5 text-xs text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
            <label
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--sa-accent)", opacity: busy ? 0.6 : 1 }}
            >
              <CloudUpload size={13} />
              {busy ? "Sending…" : `Upload version ${next}`}
              <input
                type="file"
                className="hidden"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ""; }}
              />
            </label>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--sa-text-tertiary)]">
            The version number is worked out for you — you never need to set it.
          </p>
          {error && <p className="mt-1.5 text-[11px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export function StudioClient({ token, board }: { token: string; board: StudioBoard }) {
  const [jobs, setJobs] = useState(board.jobs);

  if (board.problem === "setup") {
    return (
      <Shell title="Not ready yet">
        <p className="text-xs text-[var(--sa-text-secondary)]">{board.setupMessage}</p>
      </Shell>
    );
  }
  if (board.problem === "revoked") {
    return (
      <Shell title={board.studioName}>
        <p className="flex items-start gap-2 text-xs text-[var(--sa-text-secondary)]">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-[var(--sa-warning)]" />
          This link has been turned off. Please get in touch with the team for a new one.
        </p>
      </Shell>
    );
  }

  const waiting = jobs.filter((j) => j.status === "requested");
  const done = jobs.filter((j) => j.status !== "requested");

  return (
    <Shell title={board.studioName} subtitle="Tech packs we've asked you for.">
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
          Nothing assigned to you at the moment. This page will fill up when the team sends work
          your way — keep the link.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {waiting.length > 0 && (
            <Section label={`Waiting on you (${waiting.length})`}>
              {waiting.map((job) => (
                <JobCard key={job.id} job={job} token={token} onDone={() => refresh(job.id)} />
              ))}
            </Section>
          )}
          {done.length > 0 && (
            <Section label={`Delivered (${done.length})`}>
              {done.map((job) => (
                <JobCard key={job.id} job={job} token={token} onDone={() => refresh(job.id)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </Shell>
  );

  // Move a job out of "waiting" the moment it is delivered, without a reload.
  function refresh(jobId: string) {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "delivered", deliveredAt: new Date().toISOString() } : j)),
    );
  }
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
        {label}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--sa-bg)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Source[Archive]
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[var(--sa-text-primary)]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--sa-text-secondary)]">{subtitle}</p>}
        </header>
        {children}
      </div>
    </main>
  );
}
