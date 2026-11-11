"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Mail, Ban, RotateCcw, Check, FileText, Copy, Search, X,
  LayoutGrid, Rows3, CalendarDays, Flame, MessageSquare, CornerUpLeft, Inbox,
  CalendarClock,
} from "lucide-react";
import { imageUrl } from "@/lib/image-url";
import {
  BOARD_COLUMNS, STATUS_META, ASK_LABEL, STUDIO_RANKS, daysLate,
  type JobStatus, type JobNote,
} from "@/lib/techpack-jobs";
import {
  createStudio, setStudioRevoked, requestTechPacks, setJobStatus, setJobPriority,
  requestRevision, addAgencyNote, resolveRequest, getJobThread, emailStudioLink,
  type ProductionBoard as Board, type ProductionJob,
} from "./production-actions";

// ─────────────────────────────────────────────────────────────
// Outsourced tech packs, our side of the glass.
//
// Three views of one list, because three different questions get asked of
// it: a Kanban for where everything stands, a table for reading twenty
// rows at once, and a timeline for what is late. None of them is a
// different list — they all render the same jobs.
// ─────────────────────────────────────────────────────────────

const field =
  "w-full min-w-0 rounded-md border border-[var(--sa-border)] bg-transparent px-2.5 py-1.5 " +
  "text-xs text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";

const TONE: Record<string, string> = {
  waiting: "var(--sa-text-secondary)",
  active: "var(--sa-accent)",
  attention: "var(--sa-warning)",
  done: "var(--sa-success)",
};

function StatusChip({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: TONE[meta.tone], background: "var(--sa-hover)" }}
    >
      {meta.label}
    </span>
  );
}

function Thumb({ job, size = 34 }: { job: ProductionJob; size?: number }) {
  if (!job.productImage) {
    return (
      <div
        className="shrink-0 rounded border border-[var(--sa-border)] bg-[var(--sa-hover)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src={imageUrl(job.productImage, size, { height: size, resize: "cover" })}
      alt=""
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded border border-[var(--sa-border)] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function Late({ job }: { job: ProductionJob }) {
  const late = daysLate(job.dueDate, job.status);
  if (late == null) return null;
  return (
    <span className="shrink-0 text-[10px] font-semibold" style={{ color: "var(--sa-danger)" }}>
      {late}d late
    </span>
  );
}

/**
 * What the studio says about this job — their own date and their own
 * order, set on their link. Shown next to ours rather than instead of it,
 * because the gap between the two is the early warning.
 */
function StudioPlan({ job, long }: { job: ProductionJob; long?: boolean }) {
  const rank = STUDIO_RANKS.find((r) => r.id === job.studioRank);
  const slip = job.dueDate && job.studioEta && job.studioEta > job.dueDate;
  if (!rank && !job.studioEta) return null;
  return (
    <>
      {rank && (
        <span className="rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold"
          style={{ borderColor: rank.tone, color: rank.tone }}>
          {long ? `Studio: ${rank.label}` : rank.short}
        </span>
      )}
      {job.studioEta && (
        <span
          className="inline-flex items-center gap-0.5"
          style={{ color: slip ? "var(--sa-warning)" : undefined }}
          title={slip ? "Later than the date we asked for" : "The date the studio gave"}
        >
          <CalendarClock size={9} />
          {long ? "studio says " : ""}
          {new Date(`${job.studioEta}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
        </span>
      )}
    </>
  );
}

// ── One job, as a card on the Kanban ──
function JobCard({ job, onOpen }: { job: ProductionJob; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-2.5 text-left transition-colors hover:border-[var(--sa-accent)]"
    >
      <div className="flex items-start gap-2">
        <Thumb job={job} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {job.priority === "high" && <Flame size={10} className="shrink-0" style={{ color: "var(--sa-danger)" }} />}
            <span className="min-w-0 truncate text-xs font-medium text-[var(--sa-text-primary)]">{job.productName}</span>
          </div>
          <div className="truncate text-[10px] text-[var(--sa-text-tertiary)]">
            {job.clientName ?? "No client"}{job.studioName ? ` · ${job.studioName}` : ""}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--sa-text-tertiary)]">
        {job.currentVersion > 0 && (
          <span className="rounded bg-[var(--sa-hover)] px-1.5 py-0.5 font-semibold">v{job.currentVersion}</span>
        )}
        {job.revisionCount > 0 && <span>{job.revisionCount} revision{job.revisionCount === 1 ? "" : "s"}</span>}
        {job.openRequests > 0 && (
          <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: "var(--sa-warning)" }}>
            <Inbox size={9} /> {job.openRequests} needed
          </span>
        )}
        {job.noteCount > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare size={9} /> {job.noteCount}
          </span>
        )}
        <StudioPlan job={job} />
        <Late job={job} />
        <span className="ml-auto">{job.ageDays}d</span>
      </div>
    </button>
  );
}

// ── The detail panel ──
function JobPanel({
  job, onClose, onChanged,
}: {
  job: ProductionJob;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [thread, setThread] = useState<JobNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [revision, setRevision] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getJobThread(job.id).then((rows) => {
      if (!live) return;
      setThread(rows);
      setLoading(false);
    });
    return () => { live = false; };
  }, [job.id]);

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.success) { setError(res.error ?? "That didn't work"); return false; }
    onChanged();
    return true;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[var(--sa-bg)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-start gap-2 border-b border-[var(--sa-border)] bg-[var(--sa-bg)] p-4">
          <Thumb job={job} size={44} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/products/${job.productId}`}
              className="block truncate text-sm font-semibold text-[var(--sa-text-primary)] hover:underline"
            >
              {job.productName}
            </Link>
            <div className="truncate text-[11px] text-[var(--sa-text-tertiary)]">
              {job.clientName ?? "No client"}
              {job.productCategory ? ` · ${job.productCategory}` : ""}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusChip status={job.status} />
              {job.currentVersion > 0 && (
                <span className="rounded bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--sa-text-secondary)]">
                  v{job.currentVersion}
                </span>
              )}
              <Late job={job} />
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
            <X size={14} />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-4">
          {/* What they were asked for */}
          <section>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
              The ask
            </h3>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--sa-text-secondary)]">
              {job.brief || "No brief was written."}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--sa-text-tertiary)]">
              <span>{job.studioName ?? "No studio"}</span>
              {job.dueDate && <span>due {new Date(job.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>}
              <span>asked {job.ageDays}d ago</span>
              <StudioPlan job={job} long />
            </div>
            <button
              onClick={() => run(() => setJobPriority(job.id, job.priority === "high" ? "normal" : "high"))}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
            >
              <Flame size={10} /> {job.priority === "high" ? "Remove priority" : "Mark as priority"}
            </button>
          </section>

          {/* Versions */}
          {job.versions.length > 0 && (
            <section>
              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
                Versions
              </h3>
              <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
                {job.versions.map((v) => (
                  <a
                    key={v.version}
                    href={v.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-2 border-b border-[var(--sa-border)] px-2.5 py-2 last:border-0 hover:bg-[var(--sa-hover)]"
                  >
                    <FileText size={12} className="mt-0.5 shrink-0 text-[var(--sa-text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-[var(--sa-text-primary)]">
                        v{v.version} — {v.fileName ?? "Tech pack"}
                      </div>
                      <div className="truncate text-[10px] text-[var(--sa-text-tertiary)]">
                        {v.uploadedBy} · {new Date(v.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {v.changeNote ? ` · ${v.changeNote}` : ""}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Conversation */}
          <section>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
              Conversation
            </h3>
            {loading ? (
              <p className="text-[11px] text-[var(--sa-text-tertiary)]">Loading…</p>
            ) : thread.length === 0 ? (
              <p className="text-[11px] text-[var(--sa-text-tertiary)]">Nothing said yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {thread.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-[var(--sa-border)] p-2.5"
                    style={{
                      background: n.author === "studio" ? "var(--sa-window)" : "var(--sa-hover)",
                      borderColor: n.asksFor && !n.resolvedAt ? "var(--sa-warning)" : undefined,
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-semibold text-[var(--sa-text-secondary)]">
                        {n.authorName ?? (n.author === "studio" ? "Studio" : "Us")}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--sa-text-tertiary)]">
                        {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    {n.asksFor && (
                      <div className="mb-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: n.resolvedAt ? "var(--sa-success)" : "var(--sa-warning)", background: "var(--sa-bg)" }}>
                        <Inbox size={9} /> Needs: {ASK_LABEL[n.asksFor] ?? n.asksFor}
                        {n.resolvedAt && " · sent"}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--sa-text-primary)]">{n.body}</p>
                    {n.asksFor && !n.resolvedAt && (
                      <button
                        onClick={async () => {
                          if (await run(() => resolveRequest(n.id))) {
                            setThread((prev) => prev.map((x) => x.id === n.id ? { ...x, resolvedAt: new Date().toISOString() } : x));
                          }
                        }}
                        disabled={busy}
                        className="mt-1.5 rounded-md border border-[var(--sa-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-bg)] disabled:opacity-50"
                      >
                        Mark as sent
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-1.5">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                placeholder="Write to the studio…"
                className={`${field} resize-y`}
              />
              <button
                onClick={async () => {
                  const text = body.trim();
                  if (!text) return;
                  if (await run(() => addAgencyNote({ jobId: job.id, body: text }))) {
                    setBody("");
                    setThread((prev) => [...prev, {
                      id: `local-${Date.now()}`, author: "agency", authorName: "Us",
                      body: text, asksFor: null, resolvedAt: null, createdAt: new Date().toISOString(),
                    }]);
                  }
                }}
                disabled={busy || !body.trim()}
                className="self-start rounded-md px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--sa-accent)" }}
              >
                Send
              </button>
            </div>
          </section>

          {/* What to do next */}
          <section className="border-t border-[var(--sa-border)] pt-3">
            {showRevision ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  rows={3}
                  placeholder="What needs changing?"
                  className={`${field} resize-y`}
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      if (await run(() => requestRevision({ jobId: job.id, note: revision }))) onClose();
                    }}
                    disabled={busy || !revision.trim()}
                    className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--sa-warning)" }}
                  >
                    Ask for changes
                  </button>
                  <button
                    onClick={() => { setShowRevision(false); setRevision(""); }}
                    className="rounded-md border border-[var(--sa-border)] px-3 py-1.5 text-[11px] text-[var(--sa-text-secondary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(job.status === "delivered" || job.status === "accepted") && (
                  <button
                    onClick={() => setShowRevision(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
                  >
                    <CornerUpLeft size={11} /> Ask for changes
                  </button>
                )}
                {job.status === "delivered" && (
                  <button
                    onClick={async () => { if (await run(() => setJobStatus(job.id, "accepted"))) onClose(); }}
                    disabled={busy}
                    className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--sa-success)" }}
                  >
                    Accept
                  </button>
                )}
                {job.status !== "accepted" && (
                  <button
                    onClick={async () => { if (await run(() => setJobStatus(job.id, "cancelled"))) onClose(); }}
                    disabled={busy}
                    className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
                  >
                    Cancel job
                  </button>
                )}
              </div>
            )}
            {error && <p className="mt-1.5 text-[11px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── The three views ──
function KanbanView({ jobs, onOpen }: { jobs: ProductionJob[]; onOpen: (j: ProductionJob) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map((status) => {
        const inColumn = jobs.filter((j) => j.status === status);
        return (
          <div key={status} className="flex w-60 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: TONE[STATUS_META[status].tone] }}>
                {STATUS_META[status].column}
              </span>
              <span className="text-[10px] tabular-nums text-[var(--sa-text-tertiary)]">{inColumn.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {inColumn.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--sa-border)] p-3 text-center text-[10px] text-[var(--sa-text-tertiary)]">
                  Nothing here
                </div>
              ) : (
                inColumn.map((j) => <JobCard key={j.id} job={j} onOpen={() => onOpen(j)} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TH = "px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)] whitespace-nowrap";

function TableView({ jobs, onOpen }: { jobs: ProductionJob[]; onOpen: (j: ProductionJob) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="border-b border-[var(--sa-border)]">
          <tr>
            <th className={TH}>Product</th>
            <th className={TH}>Client</th>
            <th className={TH}>Studio</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Ver</th>
            <th className={TH}>Due</th>
            <th className={TH}>Studio says</th>
            <th className={`${TH} text-right`}>Age</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr
              key={j.id}
              onClick={() => onOpen(j)}
              className="cursor-pointer border-b border-[var(--sa-border)] last:border-0 hover:bg-[var(--sa-hover)]"
            >
              <td className="max-w-[220px] px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <Thumb job={j} size={24} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      {j.priority === "high" && <Flame size={9} className="shrink-0" style={{ color: "var(--sa-danger)" }} />}
                      <span className="truncate font-medium text-[var(--sa-text-primary)]">{j.productName}</span>
                    </div>
                    {j.openRequests > 0 && (
                      <span className="text-[10px] font-semibold" style={{ color: "var(--sa-warning)" }}>
                        {j.openRequests} thing{j.openRequests === 1 ? "" : "s"} needed from us
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="max-w-[130px] truncate px-2.5 py-2 text-[var(--sa-text-secondary)]">{j.clientName ?? "—"}</td>
              <td className="max-w-[130px] truncate px-2.5 py-2 text-[var(--sa-text-secondary)]">{j.studioName ?? "—"}</td>
              <td className="px-2.5 py-2"><StatusChip status={j.status} /></td>
              <td className="px-2.5 py-2 text-right tabular-nums text-[var(--sa-text-secondary)]">
                {j.currentVersion > 0 ? `v${j.currentVersion}` : "—"}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2 text-[var(--sa-text-secondary)]">
                {j.dueDate ? new Date(j.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                {daysLate(j.dueDate, j.status) != null && (
                  <span className="ml-1 font-semibold" style={{ color: "var(--sa-danger)" }}>late</span>
                )}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2">
                <span className="inline-flex flex-wrap items-center gap-1 text-[10px] text-[var(--sa-text-tertiary)]">
                  <StudioPlan job={j} />
                </span>
              </td>
              <td className="px-2.5 py-2 text-right tabular-nums text-[var(--sa-text-tertiary)]">{j.ageDays}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Grouped by when it is due, which is the only question a timeline answers. */
function TimelineView({ jobs, onOpen }: { jobs: ProductionJob[]; onOpen: (j: ProductionJob) => void }) {
  const groups = useMemo(() => {
    const now = new Date();
    const endOfWeek = new Date(now); endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    const endOfNext = new Date(endOfWeek); endOfNext.setDate(endOfWeek.getDate() + 7);

    const buckets: Array<{ label: string; jobs: ProductionJob[] }> = [
      { label: "Overdue", jobs: [] },
      { label: "This week", jobs: [] },
      { label: "Next week", jobs: [] },
      { label: "Later", jobs: [] },
      { label: "No date set", jobs: [] },
    ];
    for (const j of jobs) {
      if (!j.dueDate) { buckets[4].jobs.push(j); continue; }
      const due = new Date(j.dueDate);
      if (daysLate(j.dueDate, j.status) != null) buckets[0].jobs.push(j);
      else if (due <= endOfWeek) buckets[1].jobs.push(j);
      else if (due <= endOfNext) buckets[2].jobs.push(j);
      else buckets[3].jobs.push(j);
    }
    for (const b of buckets) {
      b.jobs.sort((a, c) => (a.dueDate ?? "9999").localeCompare(c.dueDate ?? "9999"));
    }
    return buckets.filter((b) => b.jobs.length > 0);
  }, [jobs]);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
        Nothing scheduled.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.label}>
          <h3
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: group.label === "Overdue" ? "var(--sa-danger)" : "var(--sa-text-tertiary)" }}
          >
            {group.label} ({group.jobs.length})
          </h3>
          <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
            {group.jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => onOpen(j)}
                className="flex w-full items-center gap-2.5 border-b border-[var(--sa-border)] px-3 py-2.5 text-left last:border-0 hover:bg-[var(--sa-hover)]"
              >
                <div className="w-16 shrink-0 text-[11px] tabular-nums text-[var(--sa-text-tertiary)]">
                  {j.dueDate ? new Date(j.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                </div>
                <Thumb job={j} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-[var(--sa-text-primary)]">{j.productName}</div>
                  <div className="truncate text-[10px] text-[var(--sa-text-tertiary)]">
                    {j.clientName ?? "No client"}{j.studioName ? ` · ${j.studioName}` : ""}
                  </div>
                </div>
                <StatusChip status={j.status} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── The page ──
export function ProductionBoard({ board }: { board: Board }) {
  const reload = () => window.location.reload();

  const [view, setView] = useState<"kanban" | "table" | "timeline">("kanban");
  const [open, setOpen] = useState<ProductionJob | null>(null);

  const [showStudio, setShowStudio] = useState(false);
  const [studioName, setStudioName] = useState("");
  const [studioEmail, setStudioEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showAsk, setShowAsk] = useState(false);
  const [jobStudio, setJobStudio] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [jobBrief, setJobBrief] = useState("");
  const [jobDue, setJobDue] = useState("");
  const [jobPriority, setJobPriority] = useState(false);

  const live = board.studios.filter((s) => !s.revokedAt);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? board.products.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.clientName ?? "").toLowerCase().includes(q),
        )
      : board.products;
    return list.slice(0, 60);
  }, [board.products, search]);

  if (board.needsSetup) {
    return (
      <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
        <h2 className="text-sm font-semibold text-[var(--sa-text-primary)]">One database step first</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--sa-text-secondary)]">{board.setupMessage}</p>
      </div>
    );
  }
  if (!board.allowed) {
    return (
      <p className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 text-center text-xs text-[var(--sa-text-secondary)]">
        You don&apos;t have permission to manage tech packs.
      </p>
    );
  }

  async function addStudio() {
    setBusy(true); setError(null);
    const res = await createStudio({ name: studioName, contactEmail: studioEmail || null });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    reload();
  }

  async function ask() {
    setBusy(true); setError(null);
    const res = await requestTechPacks({
      studioId: jobStudio,
      productIds: Array.from(picked),
      brief: jobBrief || null,
      dueDate: jobDue || null,
      priority: jobPriority ? "high" : "normal",
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    reload();
  }

  const waiting = board.jobs.filter((j) => j.status !== "accepted");
  const needsUs = board.jobs.reduce((n, j) => n + j.openRequests, 0);

  return (
    <div className="flex flex-col gap-4">
      {board.needsNotesSetup && (
        <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-hover)] p-3">
          <p className="text-[11px] leading-relaxed text-[var(--sa-text-secondary)]">
            <strong className="font-semibold text-[var(--sa-text-primary)]">Comments, revisions and studio dates need one database step.</strong>{" "}
            Run migrations/051_studio_workspace.sql — it covers 050 too, and is safe to run twice.
            Everything else on this page works without it.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-[var(--sa-border)]">
          {([
            ["kanban", LayoutGrid, "Board"],
            ["table", Rows3, "Table"],
            ["timeline", CalendarDays, "Timeline"],
          ] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                background: view === key ? "var(--sa-accent)" : "transparent",
                color: view === key ? "#fff" : "var(--sa-text-secondary)",
              }}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--sa-text-tertiary)]">
          <span>{waiting.length} open</span>
          {needsUs > 0 && (
            <span className="font-semibold" style={{ color: "var(--sa-warning)" }}>
              {needsUs} waiting on us
            </span>
          )}
        </div>

        {live.length > 0 && (
          <button
            onClick={() => setShowAsk((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-white"
            style={{ background: "var(--sa-accent)" }}
          >
            <Plus size={11} /> Ask for packs
          </button>
        )}
      </div>

      {/* Ask for packs */}
      {showAsk && live.length > 0 && (
        <section className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[var(--sa-text-primary)]">Ask a studio for packs</h2>
            <button onClick={() => setShowAsk(false)} className="rounded p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
              <X size={12} />
            </button>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <select value={jobStudio} onChange={(e) => setJobStudio(e.target.value)} className={field}>
              <option value="">Which studio…</option>
              {live.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={jobDue} onChange={(e) => setJobDue(e.target.value)} className={field} />
          </div>

          <div className="mt-2">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2.5 top-2 text-[var(--sa-text-tertiary)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find products by name or client…"
                className={`${field} pl-7`}
              />
            </div>
            <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-[var(--sa-border)]">
              {matches.length === 0 ? (
                <p className="p-3 text-center text-[11px] text-[var(--sa-text-tertiary)]">Nothing matches.</p>
              ) : (
                matches.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-[var(--sa-border)] px-2.5 py-1.5 last:border-0 hover:bg-[var(--sa-hover)]"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(p.id)}
                      onChange={() => setPicked((prev) => {
                        const next = new Set(prev);
                        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                        return next;
                      })}
                      style={{ accentColor: "var(--sa-accent)", width: 13, height: 13, flexShrink: 0 }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] text-[var(--sa-text-primary)]">{p.name}</div>
                      <div className="truncate text-[10px] text-[var(--sa-text-tertiary)]">
                        {p.clientName ?? "No client"}{p.category ? ` · ${p.category}` : ""}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <textarea
            value={jobBrief}
            onChange={(e) => setJobBrief(e.target.value)}
            rows={2}
            placeholder="What the studio needs to know — applies to every pack in this batch (optional)"
            className={`${field} mt-2 resize-y`}
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--sa-text-secondary)]">
              <input
                type="checkbox"
                checked={jobPriority}
                onChange={(e) => setJobPriority(e.target.checked)}
                style={{ accentColor: "var(--sa-danger)", width: 13, height: 13 }}
              />
              Priority
            </label>
            <button
              onClick={ask}
              disabled={busy || !jobStudio || picked.size === 0}
              className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--sa-accent)" }}
            >
              {busy ? "Sending…" : `Add ${picked.size || ""} to their list`}
            </button>
            {picked.size > 0 && (
              <button onClick={() => setPicked(new Set())} className="text-[11px] text-[var(--sa-text-tertiary)] hover:underline">
                Clear
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--sa-text-tertiary)]">
            One job per product, all with the same brief and date. They appear on the studio&apos;s link straight away.
          </p>
        </section>
      )}

      {error && <p className="text-[11px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}

      {/* The work */}
      {board.jobs.length === 0 ? (
        <p className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
          Nothing out with a studio yet.
        </p>
      ) : view === "kanban" ? (
        <KanbanView jobs={board.jobs} onOpen={setOpen} />
      ) : view === "table" ? (
        <TableView jobs={board.jobs} onOpen={setOpen} />
      ) : (
        <TimelineView jobs={board.jobs} onOpen={setOpen} />
      )}

      {/* Studios */}
      <section className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
        <div className="flex items-center justify-between border-b border-[var(--sa-border)] px-3.5 py-2.5">
          <h2 className="text-xs font-semibold text-[var(--sa-text-primary)]">Studios</h2>
          <button
            onClick={() => setShowStudio((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--sa-accent)]"
          >
            <Plus size={11} /> Add a studio
          </button>
        </div>

        {showStudio && (
          <div className="flex flex-col gap-2 border-b border-[var(--sa-border)] p-3.5 sm:flex-row">
            <input value={studioName} onChange={(e) => setStudioName(e.target.value)} placeholder="Studio name" className={field} />
            <input value={studioEmail} onChange={(e) => setStudioEmail(e.target.value)} placeholder="Email (optional)" className={field} />
            <button
              onClick={addStudio}
              disabled={busy || !studioName.trim()}
              className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--sa-accent)" }}
            >
              Create link
            </button>
          </div>
        )}

        {board.studios.length === 0 ? (
          <p className="px-3.5 py-5 text-center text-xs text-[var(--sa-text-secondary)]">
            Add the team who draw your packs, and they get one link that never changes.
          </p>
        ) : (
          board.studios.map((s) => <StudioRow key={s.id} studio={s} onChange={reload} />)
        )}
      </section>

      {open && (
        <JobPanel
          job={open}
          onClose={() => setOpen(null)}
          onChanged={() => { /* the panel keeps its own state; the board refreshes on close */ }}
        />
      )}
    </div>
  );
}

function StudioRow({ studio, onChange }: { studio: Board["studios"][number]; onChange: () => void }) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/packs/${studio.token}`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--sa-border)] px-3.5 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-[var(--sa-text-primary)]">
          {studio.name}
          {studio.revokedAt && <span className="ml-1.5 text-[10px] text-[var(--sa-danger)]">link off</span>}
        </div>
        <div className="truncate text-[11px] text-[var(--sa-text-tertiary)]">
          {studio.openJobs > 0 ? `${studio.openJobs} open` : "nothing open"}
          {studio.contactEmail ? ` · ${studio.contactEmail}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied" : "Link"}
        </button>
        {studio.contactEmail && !studio.revokedAt && (
          <button
            onClick={async () => { setBusy(true); const r = await emailStudioLink(studio.id); setBusy(false); setSent(r.success ? "Sent" : r.error); setTimeout(() => setSent(null), 2500); }}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
          >
            <Mail size={11} /> {sent ?? "Email it"}
          </button>
        )}
        <button
          onClick={async () => { setBusy(true); await setStudioRevoked(studio.id, !studio.revokedAt); setBusy(false); onChange(); }}
          disabled={busy}
          className="rounded-md border border-[var(--sa-border)] p-1.5 text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
          aria-label={studio.revokedAt ? "Turn the link back on" : "Turn the link off"}
        >
          {studio.revokedAt ? <RotateCcw size={12} /> : <Ban size={12} />}
        </button>
      </div>
    </div>
  );
}
