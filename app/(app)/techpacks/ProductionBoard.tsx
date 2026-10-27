"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Mail, Ban, RotateCcw, Check, FileText, Copy } from "lucide-react";
import {
  createStudio, setStudioRevoked, requestTechPack, setJobStatus, emailStudioLink,
  type ProductionBoard as Board, type ProductionJob,
} from "./production-actions";

// ─────────────────────────────────────────────────────────────
// Outsourced tech packs, our side of the glass.
//
// The board comes first and the admin second, because the question this
// page exists to answer is "what is still out with the studio, and how
// long has it been there" — not "how do I add a studio".
// ─────────────────────────────────────────────────────────────

const input =
  "w-full min-w-0 rounded-md border border-[var(--sa-border)] bg-transparent px-2.5 py-1.5 " +
  "text-xs text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";

function Age({ job }: { job: ProductionJob }) {
  if (job.status !== "requested") return null;
  const tone =
    job.ageDays > 21 ? "var(--sa-danger)" : job.ageDays > 10 ? "var(--sa-warning)" : "var(--sa-text-tertiary)";
  return (
    <span className="shrink-0 text-[11px] tabular-nums" style={{ color: tone }}>
      {job.ageDays === 0 ? "today" : `${job.ageDays}d`}
    </span>
  );
}

function JobRow({ job, onChange }: { job: ProductionJob; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const overdue = job.dueDate && job.status === "requested" && new Date(job.dueDate) < new Date();

  async function mark(status: "accepted" | "cancelled") {
    setBusy(true);
    await setJobStatus(job.id, status);
    setBusy(false);
    onChange();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--sa-border)] px-3 py-2.5 last:border-0 hover:bg-[var(--sa-hover)]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/products/${job.productId}`}
            className="min-w-0 truncate text-xs font-medium text-[var(--sa-text-primary)] hover:underline"
          >
            {job.productName}
          </Link>
          {job.currentVersion > 0 && (
            <span className="shrink-0 rounded bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--sa-text-secondary)]">
              v{job.currentVersion}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--sa-text-tertiary)]">
          {job.clientName && <span className="truncate">{job.clientName}</span>}
          {job.studioName && <span className="truncate">· {job.studioName}</span>}
          {job.dueDate && (
            <span style={{ color: overdue ? "var(--sa-danger)" : undefined }}>
              · due {new Date(job.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>

      <Age job={job} />

      <div className="flex shrink-0 items-center gap-1.5">
        {job.latestFileUrl && (
          <a
            href={job.latestFileUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[var(--sa-border)] p-1.5 text-[var(--sa-text-secondary)] hover:bg-[var(--sa-window)]"
            aria-label="Open the pack"
          >
            <FileText size={12} />
          </a>
        )}
        {job.status === "delivered" && (
          <button
            onClick={() => mark("accepted")}
            disabled={busy}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--sa-success)" }}
          >
            Accept
          </button>
        )}
        {job.status !== "accepted" && (
          <button
            onClick={() => mark("cancelled")}
            disabled={busy}
            className="rounded-md border border-[var(--sa-border)] px-2 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-window)] disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function ProductionBoard({ board }: { board: Board }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => { setRefreshKey((k) => k + 1); window.location.reload(); };

  const [showStudio, setShowStudio] = useState(false);
  const [studioName, setStudioName] = useState("");
  const [studioEmail, setStudioEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [jobStudio, setJobStudio] = useState("");
  const [jobProduct, setJobProduct] = useState("");
  const [jobBrief, setJobBrief] = useState("");
  const [jobDue, setJobDue] = useState("");

  const live = board.studios.filter((s) => !s.revokedAt);
  const waiting = useMemo(() => board.jobs.filter((j) => j.status === "requested"), [board.jobs]);
  const delivered = useMemo(() => board.jobs.filter((j) => j.status === "delivered"), [board.jobs]);
  const accepted = useMemo(() => board.jobs.filter((j) => j.status === "accepted"), [board.jobs]);

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
    setBusy(true); setError(null); setNote(null);
    const res = await createStudio({ name: studioName, contactEmail: studioEmail || null });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setStudioName(""); setStudioEmail(""); setShowStudio(false);
    reload();
  }

  async function ask() {
    setBusy(true); setError(null); setNote(null);
    const res = await requestTechPack({
      studioId: jobStudio, productId: jobProduct,
      brief: jobBrief || null, dueDate: jobDue || null,
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setJobProduct(""); setJobBrief(""); setJobDue("");
    reload();
  }

  return (
    <div className="flex flex-col gap-5" key={refreshKey}>
      {/* ── Ask for a pack ── */}
      {live.length > 0 && (
        <section className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3.5">
          <h2 className="text-xs font-semibold text-[var(--sa-text-primary)]">Ask a studio for a pack</h2>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <select value={jobStudio} onChange={(e) => setJobStudio(e.target.value)} className={input}>
              <option value="">Which studio…</option>
              {live.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={jobProduct} onChange={(e) => setJobProduct(e.target.value)} className={input}>
              <option value="">Which product…</option>
              {board.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName ? `${p.clientName} — ${p.name}` : p.name}
                </option>
              ))}
            </select>
            <input
              value={jobBrief}
              onChange={(e) => setJobBrief(e.target.value)}
              placeholder="What they need to know (optional)"
              className={`${input} sm:col-span-2`}
            />
            <input type="date" value={jobDue} onChange={(e) => setJobDue(e.target.value)} className={input} />
            <button
              onClick={ask}
              disabled={busy || !jobStudio || !jobProduct}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--sa-accent)" }}
            >
              {busy ? "Sending…" : "Add to their list"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--sa-text-tertiary)]">
            It appears on their link straight away. No email needed unless you want to nudge them.
          </p>
        </section>
      )}

      {error && <p className="text-[11px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
      {note && <p className="text-[11px]" style={{ color: "var(--sa-success)" }}>{note}</p>}

      {/* ── The board ── */}
      {board.jobs.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Group label={`Out with the studio (${waiting.length})`} jobs={waiting} onChange={reload} />
          <Group label={`Delivered, waiting on us (${delivered.length})`} jobs={delivered} onChange={reload} />
          <Group label={`Accepted (${accepted.length})`} jobs={accepted} onChange={reload} />
        </div>
      ) : (
        <p className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 text-center text-xs text-[var(--sa-text-secondary)]">
          Nothing out with a studio yet.
        </p>
      )}

      {/* ── Studios ── */}
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
            <input value={studioName} onChange={(e) => setStudioName(e.target.value)} placeholder="Studio name" className={input} />
            <input value={studioEmail} onChange={(e) => setStudioEmail(e.target.value)} placeholder="Email (optional)" className={input} />
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
    </div>
  );
}

function Group({ label, jobs, onChange }: { label: string; jobs: ProductionJob[]; onChange: () => void }) {
  if (jobs.length === 0) return null;
  return (
    <section>
      <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
        {label}
      </h2>
      <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)]">
        {jobs.map((j) => <JobRow key={j.id} job={j} onChange={onChange} />)}
      </div>
    </section>
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
          {studio.openJobs > 0 ? `${studio.openJobs} waiting` : "nothing waiting"}
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
