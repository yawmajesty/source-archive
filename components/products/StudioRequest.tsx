"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, ExternalLink, Loader2, Send, Zap } from "lucide-react";
import Link from "next/link";
import {
  listStudioOptions, getJobForProduct, requestTechPacks, setJobDueDate, setJobStudio,
  type StudioOption, type ProductJobSummary,
} from "@/app/(app)/techpacks/production-actions";
import { STATUS_META } from "@/lib/techpack-jobs";

// ─────────────────────────────────────────────────────────────
// Sending this style's tech pack out, from the style's own page.
//
// The decision to outsource a pack is made while looking at the garment,
// not while looking at a board, so the three things that decision needs —
// who draws it, by when, and anything they should know — are asked for
// here. It writes the same techpack_jobs row the board writes, so the
// board, the studio's link, and the deadline the studio sees are all the
// same record. There is no second place for a date to live and go stale.
//
// The deadline is the part that was missing. A pack with no date is a
// pack nobody is late for.
// ─────────────────────────────────────────────────────────────

function pretty(date: string | null): string {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Negative means it has already passed. */
function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const then = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((then - today) / 86_400_000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StudioRequest({ productId }: { productId: string }) {
  const [studios, setStudios] = useState<StudioOption[] | null>(null);
  const [job, setJob] = useState<ProductJobSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [studioId, setStudioId] = useState("");
  const [due, setDue] = useState("");
  const [rush, setRush] = useState(false);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  const [editingDue, setEditingDue] = useState(false);
  const [dueDraft, setDueDraft] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([listStudioOptions(), getJobForProduct(productId)])
      .then(([options, existing]) => {
        if (!live) return;
        setStudios(options);
        setJob(existing);
        setStudioId((prev) => prev || options[0]?.id || "");
        setLoading(false);
      })
      .catch(() => { if (live) { setStudios([]); setLoading(false); } });
    return () => { live = false; };
  }, [productId]);

  async function send() {
    if (!studioId) { setError("Pick a studio"); return; }
    if (!due) { setError("Give them a deadline — that's the whole point of sending it through here"); return; }
    setBusy(true); setError(null);
    const res = await requestTechPacks({
      studioId,
      productIds: [productId],
      dueDate: due,
      brief: brief.trim() || null,
      priority: rush ? "high" : "normal",
    });
    if (!res.success) { setBusy(false); setError(res.error); return; }
    const fresh = await getJobForProduct(productId);
    setBusy(false);
    setJob(fresh);
    setJustSent(true);
    setBrief(""); setRush(false);
    setTimeout(() => setJustSent(false), 3000);
  }

  async function saveDue() {
    if (!job) return;
    setBusy(true); setError(null);
    const res = await setJobDueDate({ jobId: job.id, dueDate: dueDraft || null });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setJob({ ...job, dueDate: dueDraft || null });
    setEditingDue(false);
  }

  async function moveStudio(next: string) {
    if (!job || !next || next === job.studioId) return;
    setBusy(true); setError(null);
    const res = await setJobStudio({ jobId: job.id, studioId: next });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    setJob(await getJobForProduct(productId));
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none transition-colors focus:border-[var(--sa-accent)]";
  const miniLabel =
    "mb-1 block text-[9.5px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]";

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-[var(--sa-text-tertiary)]">
        <Loader2 size={11} className="animate-spin" /> Checking the tech pack sheet…
      </p>
    );
  }

  // ── Already on somebody's list ──────────────────────────────
  if (job && job.status !== "cancelled") {
    const meta = STATUS_META[job.status];
    const left = daysUntil(job.dueDate);
    const open = job.status !== "accepted";
    // The studio's own date is only there once migration 051 is in.
    const etaLate = job.studioEta && job.dueDate && job.studioEta > job.dueDate;

    return (
      <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-[var(--sa-text-primary)]">
              {job.studioName ?? "No studio yet"}
            </p>
            <p className="text-[10.5px] text-[var(--sa-text-tertiary)]">
              Asked for {pretty(job.createdAt.slice(0, 10))}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: "var(--sa-hover)",
              color:
                meta.tone === "attention" ? "var(--sa-warning)"
                : meta.tone === "done" ? "var(--sa-success)"
                : meta.tone === "active" ? "var(--sa-accent)"
                : "var(--sa-text-tertiary)",
            }}
          >
            {meta.label}
          </span>
        </div>

        <div className="mt-2.5 border-t border-[var(--sa-border)] pt-2.5">
          {editingDue ? (
            <div className="flex items-center gap-1.5">
              <input
                type="date" value={dueDraft} min={todayIso()}
                onChange={(e) => setDueDraft(e.target.value)}
                className={inputCls}
              />
              <button onClick={saveDue} disabled={busy}
                className="shrink-0 rounded-lg bg-[var(--sa-accent)] px-2.5 py-1.5 text-[11.5px] font-medium text-white disabled:opacity-50">
                {busy ? "…" : "Save"}
              </button>
              <button onClick={() => setEditingDue(false)}
                className="shrink-0 px-1 text-[11.5px] text-[var(--sa-text-tertiary)]">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setDueDraft(job.dueDate ?? ""); setEditingDue(true); }}
              className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[var(--sa-hover)]"
            >
              <CalendarClock size={12} className="shrink-0 text-[var(--sa-text-tertiary)]" />
              <span className="text-[12px] text-[var(--sa-text-secondary)]">
                {job.dueDate ? `Wanted by ${pretty(job.dueDate)}` : "No deadline set"}
              </span>
              {open && left != null && (
                <span
                  className="ml-auto text-[11px] font-medium"
                  style={{ color: left < 0 ? "var(--sa-danger)" : left <= 3 ? "var(--sa-warning)" : "var(--sa-text-tertiary)" }}
                >
                  {left < 0 ? `${Math.abs(left)}d late` : left === 0 ? "today" : `${left}d`}
                </span>
              )}
            </button>
          )}

          {job.studioEta && (
            <p
              className="mt-1 px-1 text-[11.5px]"
              style={{ color: etaLate ? "var(--sa-warning)" : "var(--sa-text-tertiary)" }}
            >
              They say {pretty(job.studioEta)}{etaLate ? " — later than we asked" : ""}
            </p>
          )}
        </div>

        {/* Moving it to a different studio, when there is one to move it to. */}
        {(studios?.length ?? 0) > 1 && (
          <div className="mt-2.5 border-t border-[var(--sa-border)] pt-2.5">
            <label className={miniLabel}>Drawn by</label>
            <select
              value={job.studioId ?? ""} disabled={busy}
              onChange={(e) => moveStudio(e.target.value)}
              className={inputCls}
            >
              {!job.studioId && <option value="">Not assigned</option>}
              {(studios ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}

        <Link
          href="/techpacks"
          className="mt-2.5 flex items-center gap-1 text-[11px] text-[var(--sa-accent)] hover:underline"
        >
          Open the tech pack board <ExternalLink size={10} />
        </Link>
      </div>
    );
  }

  // ── Not sent yet ────────────────────────────────────────────
  if ((studios?.length ?? 0) === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--sa-border)] p-3">
        <p className="text-[12px] leading-snug text-[var(--sa-text-secondary)]">
          No tech pack studio on file yet.
        </p>
        <Link href="/techpacks" className="mt-1 flex items-center gap-1 text-[11.5px] text-[var(--sa-accent)] hover:underline">
          Add one on the tech pack board <ExternalLink size={10} />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-3">
      {justSent && (
        <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--sa-success)]">
          <Check size={12} /> On their list, and emailed.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={miniLabel}>Drawn by</label>
          <select value={studioId} onChange={(e) => setStudioId(e.target.value)} className={inputCls}>
            {(studios ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={miniLabel}>Wanted by</label>
          <input
            type="date" value={due} min={todayIso()}
            onChange={(e) => setDue(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-2">
        <label className={miniLabel}>Anything they should know</label>
        <textarea
          value={brief} rows={2}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Graded S–XL, embroidery placement called out…"
          className={`${inputCls} resize-none placeholder:text-[var(--sa-text-tertiary)]`}
        />
      </div>

      <button
        onClick={() => setRush((v) => !v)}
        className="mt-2 flex items-center gap-1.5 rounded-md px-1 py-1 text-[11.5px] transition-colors hover:bg-[var(--sa-hover)]"
        style={{ color: rush ? "var(--sa-warning)" : "var(--sa-text-tertiary)" }}
      >
        <Zap size={11} className={rush ? "" : "opacity-50"} />
        {rush ? "Marked urgent — it goes to the top of their list" : "Mark it urgent"}
      </button>

      {error && <p className="mt-1.5 text-[11.5px] text-red-500">{error}</p>}

      <button
        onClick={send}
        disabled={busy}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        {busy ? "Sending…" : "Send it to the studio"}
      </button>
      <p className="mt-1 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
        They get an email with the deadline, and it appears on their link straight away.
      </p>
    </div>
  );
}
