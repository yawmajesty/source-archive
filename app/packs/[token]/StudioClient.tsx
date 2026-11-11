"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CloudUpload, FileText, Check, Clock, TriangleAlert, Flame,
  MessageSquare, Play, ChevronDown, ChevronRight, Inbox,
  LayoutGrid, Rows3, Search, X, CalendarClock,
} from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { imageUrl } from "@/lib/image-url";
import {
  ASK_OPTIONS, ASK_LABEL, STATUS_META, STUDIO_RANKS, RANK_ORDER,
  daysLate, daysUntil, type JobNote, type StudioRank,
} from "@/lib/techpack-jobs";
import {
  deliverTechPack, postStudioNote, startJob, setStudioEta, setStudioRank,
  type StudioBoard, type StudioJob,
} from "./actions";

// ─────────────────────────────────────────────────────────────
// What the outside studio sees.
//
// One job per row or card, each carrying everything needed to draw the
// pack without writing to ask: the spec we hold, what we said, what we
// last asked to be changed, and every version so far.
//
// Nothing about our side of the job can be edited here. They do not pick
// the client, they do not pick the product, they do not move the date we
// asked for, and above all they do not type a version number — the
// version is worked out from what is already on the product, because a
// studio guessing "v2" against a product already holding a v2 is a failed
// upload they cannot diagnose.
//
// What they do own is their own plan: which pack they are on today, and
// when they honestly expect to deliver. Those are their columns, and the
// distance between their date and ours is the board's early warning.
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

const VIEW_KEY = "sa-studio-view";

function shortDate(d: string | null) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

const OPEN_STATUSES = ["requested", "in_progress", "revision_requested"];
const isOpen = (j: StudioJob) => OPEN_STATUSES.includes(j.status);

/**
 * Their list, in the order they would work through it: what they said
 * they are on, then anything late, then by the date we asked for.
 */
function sortJobs(jobs: StudioJob[]): StudioJob[] {
  return [...jobs].sort((a, b) => {
    const rank = (RANK_ORDER[a.studioRank ?? ""] ?? 2) - (RANK_ORDER[b.studioRank ?? ""] ?? 2);
    if (rank !== 0) return rank;
    const late = (daysLate(b.dueDate, b.status) ?? 0) - (daysLate(a.dueDate, a.status) ?? 0);
    if (late !== 0) return late;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });
}

function StatusChip({ job }: { job: StudioJob }) {
  const meta = STATUS_META[job.status];
  const done = job.status === "delivered" || job.status === "accepted";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: TONE[meta.tone], background: "var(--sa-hover)" }}
    >
      {done ? <Check size={9} /> : <Clock size={9} />}
      {job.status === "requested" ? "Waiting on you" : meta.label}
    </span>
  );
}

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

/**
 * The studio's own two fields. Saved the moment they are touched, because
 * a Save button on a date is a date that never gets updated.
 */
function usePlanning(
  job: StudioJob,
  token: string,
  who: string,
  onChanged: (patch: Partial<StudioJob>) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  // Both writes are optimistic and roll back on failure. A date picker
  // that waits on a round trip before it shows the date feels broken, and
  // these two are meant to be changed in passing.
  async function rank(next: StudioRank | null) {
    const previous = job.studioRank;
    onChanged({ studioRank: next });
    setBusy(true);
    setError(null);
    const res = await setStudioRank({ token, jobId: job.id, rank: next });
    setBusy(false);
    if (!res.success) { onChanged({ studioRank: previous }); setError(res.error); return; }
    flash();
  }

  async function eta(value: string) {
    const previous = job.studioEta;
    onChanged({ studioEta: value || null });
    setBusy(true);
    setError(null);
    const res = await setStudioEta({ token, jobId: job.id, eta: value || null, authorName: who || null });
    setBusy(false);
    if (!res.success) { onChanged({ studioEta: previous }); setError(res.error); return; }
    flash();
  }

  return { busy, error, saved, rank, eta };
}

function Planning({
  job, token, who, onChanged,
}: {
  job: StudioJob;
  token: string;
  who: string;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const { busy, error, saved, rank, eta } = usePlanning(job, token, who, onChanged);
  const slip = job.dueDate && job.studioEta && job.studioEta > job.dueDate;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
          Your order
        </span>
        {STUDIO_RANKS.map((r) => {
          const on = job.studioRank === r.id;
          return (
            <button
              key={r.id}
              onClick={() => rank(on ? null : r.id)}
              disabled={busy}
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50"
              style={{
                borderColor: on ? r.tone : "var(--sa-border)",
                color: on ? r.tone : "var(--sa-text-tertiary)",
                background: on ? "var(--sa-hover)" : "transparent",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            You'll have it
          </span>
          <input
            type="date"
            value={job.studioEta ?? ""}
            onChange={(e) => eta(e.target.value)}
            disabled={busy}
            className={`${field} w-auto py-1 text-[11px]`}
          />
        </label>
        {job.dueDate && (
          <span className="text-[10px] text-[var(--sa-text-tertiary)]">
            we asked for {shortDate(job.dueDate)}
          </span>
        )}
        {slip && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: "var(--sa-warning)" }}>
            <TriangleAlert size={9} /> after our date — we've been told
          </span>
        )}
        {saved && (
          <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--sa-success)" }}>
            <Check size={9} /> saved
          </span>
        )}
      </div>

      {error && <p className="text-[10.5px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
    </div>
  );
}

/** The conversation, used from a card and from an expanded table row. */
function Talk({
  job, token, who, onChanged,
}: {
  job: StudioJob;
  token: string;
  who: string;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const [message, setMessage] = useState("");
  const [asksFor, setAsksFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const body = message.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    const res = await postStudioNote({
      token, jobId: job.id, body, asksFor: asksFor || null, authorName: who || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onChanged({
      notes: [...job.notes, {
        id: `local-${Date.now()}`, author: "studio", authorName: who || "You",
        body, asksFor: asksFor || null, resolvedAt: null, createdAt: new Date().toISOString(),
      }],
    });
    setMessage("");
    setAsksFor("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Thread notes={job.notes} />
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
          onClick={send}
          disabled={busy || !message.trim()}
          className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--sa-accent)" }}
        >
          Send
        </button>
      </div>
      {error && <p className="text-[10.5px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
    </div>
  );
}

/** Uploading the pack itself. */
function Deliver({
  job, token, who, setWho, onChanged,
}: {
  job: StudioJob;
  token: string;
  who: string;
  setWho: (v: string) => void;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [justSent, setJustSent] = useState<number | null>(null);

  const next = job.currentVersion + 1;
  const needsWork = isOpen(job);

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
    onChanged({ status: "delivered", currentVersion: res.version, studioRank: null });
  }

  if (justSent != null) {
    return (
      <p
        className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-hover)] p-2.5 text-xs font-medium"
        style={{ color: "var(--sa-success)" }}
      >
        <Check size={13} /> Version {justSent} received. The team has been told.
      </p>
    );
  }

  return (
    <div>
      {job.status === "requested" && (
        <button
          onClick={async () => {
            setBusy(true);
            await startJob({ token, jobId: job.id });
            setBusy(false);
            onChanged({ status: "in_progress" });
          }}
          disabled={busy}
          className="mb-2 inline-flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
        >
          <Play size={10} /> Mark as started
        </button>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Your name (optional)"
            className={`${field} sm:w-40 sm:shrink-0`}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={next === 1 ? "Notes for us (optional)" : "What changed (optional)"}
            className={field}
          />
        </div>
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
  );
}

/** Everything about one job, below its heading. Shared by card and row. */
function JobBody({
  job, token, canTalk, canPlan, who, setWho, onChanged, openByDefault,
}: {
  job: StudioJob;
  token: string;
  canTalk: boolean;
  canPlan: boolean;
  who: string;
  setWho: (v: string) => void;
  onChanged: (patch: Partial<StudioJob>) => void;
  openByDefault?: boolean;
}) {
  const [openSpec, setOpenSpec] = useState(Boolean(openByDefault));
  const [openTalk, setOpenTalk] = useState(Boolean(openByDefault));
  const openAsks = job.notes.filter((n) => n.asksFor && !n.resolvedAt).length;

  return (
    <>
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

      {canPlan && isOpen(job) && (
        <div className="mt-3 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] p-2.5">
          <Planning job={job} token={token} who={who} onChanged={onChanged} />
        </div>
      )}

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

      {canTalk && (
        <div className="mt-2.5 border-t border-[var(--sa-border)] pt-2">
          <button
            onClick={() => setOpenTalk((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:text-[var(--sa-accent)]"
          >
            {openTalk ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <MessageSquare size={11} /> Notes and questions ({job.notes.length})
            {openAsks > 0 && (
              <span className="font-semibold" style={{ color: "var(--sa-warning)" }}>· {openAsks} outstanding</span>
            )}
          </button>
          {openTalk && (
            <div className="mt-2">
              <Talk job={job} token={token} who={who} onChanged={onChanged} />
            </div>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-[var(--sa-border)] pt-3">
        <Deliver job={job} token={token} who={who} setWho={setWho} onChanged={onChanged} />
      </div>
    </>
  );
}

function JobCard(props: {
  job: StudioJob;
  token: string;
  canTalk: boolean;
  canPlan: boolean;
  who: string;
  setWho: (v: string) => void;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const { job } = props;
  const late = daysLate(job.dueDate, job.status);
  const rank = STUDIO_RANKS.find((r) => r.id === job.studioRank);

  return (
    <div
      className="rounded-xl border bg-[var(--sa-window)] p-4"
      style={{ borderColor: job.studioRank === "now" ? "var(--sa-accent)" : "var(--sa-border)" }}
    >
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
            <StatusChip job={job} />
            {rank && (
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ borderColor: rank.tone, color: rank.tone }}>
                {rank.label}
              </span>
            )}
            {job.currentVersion > 0 && (
              <span className="rounded bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--sa-text-secondary)]">
                v{job.currentVersion} current
              </span>
            )}
            {late != null && (
              <span className="text-[10px] font-semibold" style={{ color: "var(--sa-danger)" }}>{late}d late</span>
            )}
            {job.dueDate && late == null && (
              <span className="text-[10px] text-[var(--sa-text-tertiary)]">due {shortDate(job.dueDate)}</span>
            )}
            {job.studioEta && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--sa-text-tertiary)]">
                <CalendarClock size={9} /> yours {shortDate(job.studioEta)}
              </span>
            )}
          </div>
        </div>
      </div>

      <JobBody {...props} />
    </div>
  );
}

/**
 * The two planning cells, editable where they stand. A table you have to
 * open a drawer to change is a report, not a worklist.
 *
 * Both stop the click from reaching the row, which would otherwise expand
 * it underneath the picker.
 */
function EtaCell({
  job, token, who, canPlan, onChanged,
}: {
  job: StudioJob;
  token: string;
  who: string;
  canPlan: boolean;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const { busy, eta } = usePlanning(job, token, who, onChanged);
  const left = daysUntil(job.studioEta);
  const slip = job.dueDate && job.studioEta && job.studioEta > job.dueDate;

  if (!canPlan || !isOpen(job)) {
    return <span className="tabular-nums">{job.studioEta ? shortDate(job.studioEta) : "—"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        type="date"
        value={job.studioEta ?? ""}
        disabled={busy}
        onChange={(e) => eta(e.target.value)}
        className="rounded border border-[var(--sa-border)] bg-transparent px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--sa-accent)] disabled:opacity-50"
        style={{
          color: slip ? "var(--sa-warning)" : job.studioEta ? "var(--sa-text-primary)" : "var(--sa-text-tertiary)",
          opacity: job.studioEta ? 1 : 0.65,
        }}
      />
      {left != null && left >= 0 && (
        <span className="text-[10px] text-[var(--sa-text-tertiary)]">{left === 0 ? "today" : `in ${left}d`}</span>
      )}
    </span>
  );
}

function RankCell({
  job, token, who, canPlan, onChanged,
}: {
  job: StudioJob;
  token: string;
  who: string;
  canPlan: boolean;
  onChanged: (patch: Partial<StudioJob>) => void;
}) {
  const { busy, rank } = usePlanning(job, token, who, onChanged);
  const current = STUDIO_RANKS.find((r) => r.id === job.studioRank);

  if (!canPlan || !isOpen(job)) {
    return current
      ? <span className="text-[10px] font-semibold" style={{ color: current.tone }}>{current.short}</span>
      : <span className="text-[var(--sa-text-tertiary)]">—</span>;
  }
  return (
    <select
      value={job.studioRank ?? ""}
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => rank((e.target.value || null) as StudioRank | null)}
      className="rounded border border-[var(--sa-border)] bg-transparent px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--sa-accent)] disabled:opacity-50"
      style={{ color: current ? current.tone : "var(--sa-text-tertiary)" }}
    >
      <option value="">—</option>
      {STUDIO_RANKS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select>
  );
}

const TH = "px-2.5 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)] whitespace-nowrap";
const TD = "px-2.5 py-2 align-middle text-[11.5px] text-[var(--sa-text-secondary)]";

function JobTable({
  jobs, token, canTalk, canPlan, who, setWho, patch,
}: {
  jobs: StudioJob[];
  token: string;
  canTalk: boolean;
  canPlan: boolean;
  who: string;
  setWho: (v: string) => void;
  patch: (id: string, change: Partial<StudioJob>) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
      <table className={`w-full border-collapse ${canPlan ? "min-w-[860px]" : "min-w-[620px]"}`}>
        <thead>
          <tr className="border-b border-[var(--sa-border)]">
            <th className={TH} style={{ width: 34 }} />
            <th className={TH}>Product</th>
            <th className={TH}>Status</th>
            <th className={TH}>We asked for</th>
            {/* Two dead columns of dashes is worse than no columns, so the
                studio's own fields appear with the database step that
                creates them. */}
            {canPlan && <th className={TH}>You&apos;ll have it</th>}
            {canPlan && <th className={TH}>Your order</th>}
            <th className={`${TH} text-right`}>Versions</th>
            <th className={`${TH} text-right`}>Notes</th>
          </tr>
        </thead>
        {/* One tbody per job — a tbody cannot nest, and keeping the summary
            row and its expanded detail in the same group is what lets the
            pair stripe and border as one thing. */}
        {jobs.map((job) => {
            const late = daysLate(job.dueDate, job.status);
            const openAsks = job.notes.filter((n) => n.asksFor && !n.resolvedAt).length;
            const expanded = open === job.id;

            return (
              <tbody key={job.id} className="border-b border-[var(--sa-border)] last:border-0">
                <tr
                  className="cursor-pointer hover:bg-[var(--sa-hover)]"
                  onClick={() => setOpen(expanded ? null : job.id)}
                >
                  <td className={`${TD} text-center`}>
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </td>
                  <td className={TD}>
                    <div className="flex min-w-0 items-center gap-2">
                      {job.priority === "high" && <Flame size={11} className="shrink-0" style={{ color: "var(--sa-danger)" }} />}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-[var(--sa-text-primary)]">{job.productName}</div>
                        {job.clientName && (
                          <div className="truncate text-[10px] text-[var(--sa-text-tertiary)]">{job.clientName}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={TD}><StatusChip job={job} /></td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>
                    {shortDate(job.dueDate)}
                    {late != null && (
                      <span className="ml-1.5 font-semibold" style={{ color: "var(--sa-danger)" }}>{late}d late</span>
                    )}
                  </td>
                  {canPlan && (
                    <td className={`${TD} whitespace-nowrap`}>
                      <EtaCell job={job} token={token} who={who} canPlan={canPlan}
                        onChanged={(change) => patch(job.id, change)} />
                    </td>
                  )}
                  {canPlan && (
                    <td className={TD}>
                      <RankCell job={job} token={token} who={who} canPlan={canPlan}
                        onChanged={(change) => patch(job.id, change)} />
                    </td>
                  )}
                  <td className={`${TD} text-right tabular-nums`}>
                    {job.currentVersion > 0 ? `v${job.currentVersion}` : "—"}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>
                    {job.notes.length}
                    {openAsks > 0 && (
                      <span className="ml-1.5 whitespace-nowrap text-[10px] font-semibold" style={{ color: "var(--sa-warning)" }}>
                        {openAsks} open
                      </span>
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={canPlan ? 8 : 6} className="bg-[var(--sa-bg)] px-3 pb-4 pt-1">
                      <div className="mx-auto max-w-3xl">
                        <JobBody
                          job={job}
                          token={token}
                          canTalk={canTalk}
                          canPlan={canPlan}
                          who={who}
                          setWho={setWho}
                          onChanged={(change) => patch(job.id, change)}
                          openByDefault
                        />
                      </div>
                    </td>
                  </tr>
                )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

type Filter = "open" | "all" | "late" | "delivered";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "open", label: "With you" },
  { id: "late", label: "Late" },
  { id: "delivered", label: "Delivered" },
  { id: "all", label: "Everything" },
];

export function StudioClient({ token, board }: { token: string; board: StudioBoard }) {
  const [jobs, setJobs] = useState(board.jobs);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [who, setWho] = useState("");

  // Which view they like is a per-browser convenience, so it lives in
  // localStorage and the page renders correctly when that throws.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "table" || saved === "cards") setView(saved);
    } catch { /* private window, blocked storage — the default is fine */ }
  }, []);

  function chooseView(next: "cards" | "table") {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* ignore */ }
  }

  function patch(id: string, change: Partial<StudioJob>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...change } : j)));
  }

  const counts = useMemo(() => ({
    open: jobs.filter(isOpen).length,
    late: jobs.filter((j) => daysLate(j.dueDate, j.status) != null).length,
    asks: jobs.reduce((n, j) => n + j.notes.filter((x) => x.asksFor && !x.resolvedAt).length, 0),
    delivered: jobs.filter((j) => j.status === "delivered" || j.status === "accepted").length,
  }), [jobs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (j: StudioJob) =>
      !q ||
      j.productName.toLowerCase().includes(q) ||
      (j.clientName ?? "").toLowerCase().includes(q) ||
      (j.brief ?? "").toLowerCase().includes(q);

    const byFilter = (j: StudioJob) => {
      if (filter === "all") return true;
      if (filter === "open") return isOpen(j);
      if (filter === "late") return daysLate(j.dueDate, j.status) != null;
      return j.status === "delivered" || j.status === "accepted";
    };

    return sortJobs(jobs.filter((j) => byFilter(j) && matches(j)));
  }, [jobs, filter, query]);

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

  if (jobs.length === 0) {
    return (
      <Shell title={board.studioName} subtitle="Tech packs we've asked you for.">
        <p className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
          Nothing assigned to you at the moment. This page will fill up when the team sends work
          your way — keep the link.
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      title={board.studioName}
      subtitle="Tech packs we've asked you for."
      stats={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <Stat n={counts.open} label="with you" />
          {counts.late > 0 && <Stat n={counts.late} label="late" tone="var(--sa-danger)" />}
          {counts.asks > 0 && <Stat n={counts.asks} label="waiting on the team" tone="var(--sa-warning)" />}
          <Stat n={counts.delivered} label="delivered" tone="var(--sa-success)" />
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-[var(--sa-border)]">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-2.5 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: filter === f.id ? "var(--sa-hover)" : "transparent",
                color: filter === f.id ? "var(--sa-text-primary)" : "var(--sa-text-tertiary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sa-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product, client or brief"
            className={`${field} pl-7 pr-7`}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex overflow-hidden rounded-lg border border-[var(--sa-border)]">
          <ViewTab on={view === "cards"} onClick={() => chooseView("cards")} icon={<LayoutGrid size={11} />} label="Cards" />
          <ViewTab on={view === "table"} onClick={() => chooseView("table")} icon={<Rows3 size={11} />} label="Table" />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
          Nothing here. Try another filter.
        </p>
      ) : view === "table" ? (
        <JobTable
          jobs={shown} token={token} canTalk={board.canTalk} canPlan={board.canPlan}
          who={who} setWho={setWho} patch={patch}
        />
      ) : (
        // grid-cols-1 is not redundant. A bare `grid` has no explicit columns,
        // so the implicit one is auto-sized and a wide card pushes straight
        // past the viewport; grid-cols-1 is minmax(0,1fr), which can shrink.
        // items-start so an opened card grows on its own rather than
        // stretching every card in its row to match.
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              token={token}
              canTalk={board.canTalk}
              canPlan={board.canPlan}
              who={who}
              setWho={setWho}
              onChanged={(change) => patch(job.id, change)}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-sm font-semibold tabular-nums" style={{ color: tone ?? "var(--sa-text-primary)" }}>{n}</span>
      <span className="text-[var(--sa-text-tertiary)]">{label}</span>
    </span>
  );
}

function ViewTab({
  on, onClick, icon, label,
}: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
      style={{
        background: on ? "var(--sa-hover)" : "transparent",
        color: on ? "var(--sa-text-primary)" : "var(--sa-text-tertiary)",
      }}
    >
      {icon} {label}
    </button>
  );
}

function Shell({
  title, subtitle, stats, children,
}: {
  title: string;
  subtitle?: string;
  stats?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full bg-[var(--sa-bg)] px-4 py-8 sm:px-6 lg:px-8">
      {/* Wide enough to lay jobs out side by side on a desktop. A single
          672px column made a studio with twelve packs scroll for a minute
          to see what it had. */}
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Source[Archive]
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[var(--sa-text-primary)]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--sa-text-secondary)]">{subtitle}</p>}
          {stats && <div className="mt-2">{stats}</div>}
        </header>
        {children}
      </div>
    </main>
  );
}
