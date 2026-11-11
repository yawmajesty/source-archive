"use client";

import { useState } from "react";
import {
  CloudUpload, FileText, Check, Clock, TriangleAlert, Flame,
  MessageSquare, Play, ChevronDown, ChevronRight, Inbox,
} from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { imageUrl } from "@/lib/image-url";
import { ASK_OPTIONS, ASK_LABEL, STATUS_META, daysLate, type JobNote } from "@/lib/techpack-jobs";
import {
  deliverTechPack, postStudioNote, startJob,
  type StudioBoard, type StudioJob,
} from "./actions";

// ─────────────────────────────────────────────────────────────
// What the outside studio sees.
//
// One card per job, each carrying everything needed to draw the pack
// without writing to ask: the spec we hold, what we said, what we last
// asked to be changed, and every version so far.
//
// Nothing on it has to be decided. They do not pick the client, they do
// not pick the product, and above all they do not type a version number —
// the version is worked out from what is already on the product, because
// a studio guessing "v2" against a product already holding a v2 is a
// failed upload they cannot diagnose.
// ─────────────────────────────────────────────────────────────

const TONE: Record<string, string> = {
  waiting: "var(--sa-text-secondary)",
  active: "var(--sa-accent)",
  attention: "var(--sa-warning)",
  done: "var(--sa-success)",
};

const field =
  "w-full min-w-0 rounded-md border border-[var(--sa-border)] bg-transparent px-2.5 py-1.5 " +
  "text-xs text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";

function Thread({ notes }: { notes: JobNote[] }) {
  if (notes.length === 0) {
    return <p className="text-[11px] text-[var(--sa-text-tertiary)]">Nothing said yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {notes.map((n) => (
        <div
          key={n.id}
          className="rounded-lg border p-2.5"
          style={{
            background: n.author === "agency" ? "var(--sa-hover)" : "var(--sa-window)",
            borderColor: n.asksFor && !n.resolvedAt ? "var(--sa-warning)" : "var(--sa-border)",
          }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] font-semibold text-[var(--sa-text-secondary)]">
              {n.author === "agency" ? "Source Archive" : n.authorName ?? "You"}
            </span>
            <span className="shrink-0 text-[10px] text-[var(--sa-text-tertiary)]">
              {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          </div>
          {n.asksFor && (
            <div
              className="mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: n.resolvedAt ? "var(--sa-success)" : "var(--sa-warning)", background: "var(--sa-bg)" }}
            >
              <Inbox size={9} /> Asked for: {ASK_LABEL[n.asksFor] ?? n.asksFor}
              {n.resolvedAt && " · sent"}
            </div>
          )}
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--sa-text-primary)]">{n.body}</p>
        </div>
      ))}
    </div>
  );
}

function JobCard({
  job, token, canTalk, onChanged,
}: {
  job: StudioJob;
  token: string;
  canTalk: boolean;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [justSent, setJustSent] = useState<number | null>(null);
  const [openSpec, setOpenSpec] = useState(false);
  const [openTalk, setOpenTalk] = useState(false);
  const [message, setMessage] = useState("");
  const [asksFor, setAsksFor] = useState("");
  const [localNotes, setLocalNotes] = useState<JobNote[]>(job.notes);

  const next = job.currentVersion + 1;
  const meta = STATUS_META[job.status];
  const late = daysLate(job.dueDate, job.status);
  const needsWork = job.status === "requested" || job.status === "revision_requested" || job.status === "in_progress";

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
      token, jobId: job.id, fileUrl: up.url, filePath: key, fileName: file.name,
      changeNote: note || null, uploaderName: who || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setJustSent(res.version);
    setNote("");
    onChanged({ status: "delivered", currentVersion: res.version });
  }

  async function talk() {
    const body = message.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    const res = await postStudioNote({
      token, jobId: job.id, body, asksFor: asksFor || null, authorName: who || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setLocalNotes((prev) => [...prev, {
      id: `local-${Date.now()}`, author: "studio", authorName: who || "You",
      body, asksFor: asksFor || null, resolvedAt: null, createdAt: new Date().toISOString(),
    }]);
    setMessage("");
    setAsksFor("");
  }

  const openAsks = localNotes.filter((n) => n.asksFor && !n.resolvedAt).length;

  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4">
      <div className="flex items-start gap-3">
        {job.productImage ? (
          <img
            src={imageUrl(job.productImage, 56, { height: 56, resize: "cover" })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-14 w-14 shrink-0 rounded-lg border border-[var(--sa-border)] object-cover"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-hover)]" />
        )}

        <div className="min-w-0 flex-1">
          {job.clientName && (
            <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
              {job.clientName}
            </div>
          )}
          <div className="flex items-center gap-1">
            {job.priority === "high" && <Flame size={11} className="shrink-0" style={{ color: "var(--sa-danger)" }} />}
            <h2 className="min-w-0 truncate text-sm font-semibold text-[var(--sa-text-primary)]">{job.productName}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: TONE[meta.tone], background: "var(--sa-hover)" }}
            >
              {job.status === "delivered" || job.status === "accepted" ? <Check size={9} /> : <Clock size={9} />}
              {job.status === "requested" ? "Waiting on you" : meta.label}
            </span>
            {job.currentVersion > 0 && (
              <span className="rounded bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--sa-text-secondary)]">
                v{job.currentVersion} current
              </span>
            )}
            {late != null && (
              <span className="text-[10px] font-semibold" style={{ color: "var(--sa-danger)" }}>{late}d late</span>
            )}
            {job.dueDate && late == null && (
              <span className="text-[10px] text-[var(--sa-text-tertiary)]">
                due {new Date(job.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* What we last asked to be changed — the most important thing on the card */}
      {job.status === "revision_requested" && job.revisionNote && (
        <div className="mt-3 rounded-lg border p-2.5" style={{ borderColor: "var(--sa-warning)", background: "var(--sa-hover)" }}>
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--sa-warning)" }}>
            <TriangleAlert size={10} /> Changes asked for
            {job.revisionCount > 1 && <span className="font-normal">· round {job.revisionCount}</span>}
          </div>
          <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-[var(--sa-text-primary)]">{job.revisionNote}</p>
        </div>
      )}

      {job.brief && (
        <p className="mt-2.5 whitespace-pre-wrap text-xs leading-relaxed text-[var(--sa-text-secondary)]">{job.brief}</p>
      )}

      {/* The spec we hold */}
      {job.productSpec.length > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setOpenSpec((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)]"
          >
            {openSpec ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            What we know about this style ({job.productSpec.length})
          </button>
          {openSpec && (
            <dl className="mt-1.5 grid gap-x-3 gap-y-1 rounded-lg border border-[var(--sa-border)] p-2.5 sm:grid-cols-2">
              {job.productSpec.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[9.5px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">{label}</dt>
                  <dd className="break-words text-[11.5px] text-[var(--sa-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Versions */}
      {job.versions.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-[var(--sa-border)] pt-2">
          {job.versions.map((v) => (
            <a
              key={v.version}
              href={v.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[11px] text-[var(--sa-text-secondary)] hover:underline"
            >
              <FileText size={11} className="shrink-0" />
              <span className="min-w-0 truncate">
                v{v.version} — {v.fileName ?? "Tech pack"}
                {v.changeNote ? ` · ${v.changeNote}` : ""}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Conversation */}
      {canTalk && (
        <div className="mt-2.5 border-t border-[var(--sa-border)] pt-2">
          <button
            onClick={() => setOpenTalk((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)]"
          >
            {openTalk ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <MessageSquare size={11} /> Messages ({localNotes.length})
            {openAsks > 0 && (
              <span className="font-semibold" style={{ color: "var(--sa-warning)" }}>· {openAsks} outstanding</span>
            )}
          </button>
          {openTalk && (
            <div className="mt-2 flex flex-col gap-2">
              <Thread notes={localNotes} />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Ask a question, or tell us what you need…"
                className={`${field} resize-y`}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <select value={asksFor} onChange={(e) => setAsksFor(e.target.value)} className={`${field} w-auto flex-1`}>
                  <option value="">Just a comment</option>
                  {ASK_OPTIONS.map((a) => <option key={a.id} value={a.id}>Need: {a.label}</option>)}
                </select>
                <button
                  onClick={talk}
                  disabled={busy || !message.trim()}
                  className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--sa-accent)" }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delivering */}
      {justSent != null ? (
        <p
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-[var(--sa-hover)] p-2.5 text-xs font-medium"
          style={{ color: "var(--sa-success)" }}
        >
          <Check size={13} /> Version {justSent} received. The team has been told.
        </p>
      ) : (
        <div className="mt-3 border-t border-[var(--sa-border)] pt-3">
          {job.status === "requested" && (
            <button
              onClick={async () => { setBusy(true); await startJob({ token, jobId: job.id }); setBusy(false); onChanged({ status: "in_progress" }); }}
              disabled={busy}
              className="mb-2 inline-flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
            >
              <Play size={10} /> Mark as started
            </button>
          )}
          <div className="flex flex-col gap-2">
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Your name (optional)"
              className={field}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={next === 1 ? "Anything we should know (optional)" : "What changed in this version (optional)"}
              className={field}
            />
            <label
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: needsWork ? "var(--sa-accent)" : "var(--sa-text-tertiary)", opacity: busy ? 0.6 : 1 }}
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

  function patch(id: string, change: Partial<StudioJob>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...change } : j)));
  }

  const todo = jobs.filter((j) => j.status === "requested" || j.status === "in_progress" || j.status === "revision_requested");
  const done = jobs.filter((j) => j.status === "delivered" || j.status === "accepted");

  return (
    <Shell title={board.studioName} subtitle="Tech packs we've asked you for.">
      {jobs.length === 0 ? (
        <p className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
          Nothing assigned to you at the moment. This page will fill up when the team sends work
          your way — keep the link.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {todo.length > 0 && (
            <Section label={`With you (${todo.length})`}>
              {todo.map((job) => (
                <JobCard key={job.id} job={job} token={token} canTalk={board.canTalk}
                  onChanged={(change) => patch(job.id, change)} />
              ))}
            </Section>
          )}
          {done.length > 0 && (
            <Section label={`Delivered (${done.length})`}>
              {done.map((job) => (
                <JobCard key={job.id} job={job} token={token} canTalk={board.canTalk}
                  onChanged={(change) => patch(job.id, change)} />
              ))}
            </Section>
          )}
        </div>
      )}
    </Shell>
  );
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
