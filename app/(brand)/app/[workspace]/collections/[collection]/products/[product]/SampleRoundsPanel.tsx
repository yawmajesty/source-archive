"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import {
  SAMPLE_STATUSES,
  SAMPLE_LABEL_SUGGESTIONS,
  type SampleRound,
  type SampleComment,
  type SampleStatus,
} from "@/lib/brand-sampling";
import { SampleStatusBadge } from "@/components/brand/SampleStatusBadge";
import { createSampleRound, updateSampleRound, addSampleComment, deleteSampleRound } from "../../../../samples-actions";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  productId: string;
  mode: WorkspaceMode;
  role: Role;
  rounds: SampleRound[];
  commentsByRound: Record<string, SampleComment[]>;
  userMap: Record<string, string>; // user_id → display name
}

export function SampleRoundsPanel(props: Props) {
  const [showNew, setShowNew] = useState(false);

  return (
    <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Sample rounds</h2>
          <p className="text-[11px] text-[var(--sa-text-tertiary)]">
            Every round in this product&apos;s lifecycle — with feedback, dates, and status.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
        >
          <Plus size={12} /> New round
        </button>
      </header>

      {props.rounds.length === 0 ? (
        <div className="px-6 py-10 text-center text-[12px] text-[var(--sa-text-tertiary)]">
          No sample rounds yet. Add one when you send the first prototype request.
        </div>
      ) : (
        <div className="divide-y divide-[var(--sa-border)]">
          {props.rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              comments={props.commentsByRound[round.id] ?? []}
              userMap={props.userMap}
              ctx={props}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewRoundModal
          existingCount={props.rounds.length}
          workspaceId={props.workspaceId}
          workspaceSlug={props.workspaceSlug}
          collectionId={props.collectionId}
          productId={props.productId}
          mode={props.mode}
          role={props.role}
          onClose={() => setShowNew(false)}
        />
      )}
    </section>
  );
}

// ── Round card ────────────────────────────────────────────────────

function RoundCard({
  round, comments, userMap, ctx,
}: {
  round: SampleRound;
  comments: SampleComment[];
  userMap: Record<string, string>;
  ctx: Props;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function persistPatch<K extends string>(patch: Record<K, any>) {
    startTransition(async () => {
      const res = await updateSampleRound({
        workspace_slug: ctx.workspaceSlug,
        collection_id: ctx.collectionId,
        product_id: ctx.productId,
        mode: ctx.mode,
        role: ctx.role,
        sample_round_id: round.id,
        patch: patch as any,
      });
      if (!res.success) alert("Couldn't save: " + res.error);
      else router.refresh();
    });
  }

  return (
    <article>
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown size={13} className="text-[var(--sa-text-tertiary)] shrink-0" /> : <ChevronRight size={13} className="text-[var(--sa-text-tertiary)] shrink-0" />}
          <span className="text-[13px] font-semibold text-[var(--sa-text-primary)] truncate">{round.label}</span>
          <SampleStatusBadge status={round.status} size="xs" />
          <span className="text-[10px] text-[var(--sa-text-tertiary)] shrink-0">
            {comments.length > 0 && (
              <span className="inline-flex items-center gap-1"><MessageSquare size={10} /> {comments.length}</span>
            )}
          </span>
        </button>
        <select
          value={round.status}
          onChange={(e) => persistPatch({ status: e.target.value as SampleStatus })}
          disabled={isPending}
          onClick={(e) => e.stopPropagation()}
          className="rounded border border-[var(--sa-border)] bg-transparent px-1.5 py-1 text-[11px] text-[var(--sa-text-secondary)] focus:border-[var(--sa-accent)] focus:bg-[var(--sa-bg)] outline-none"
        >
          {SAMPLE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-[var(--sa-border)] bg-[var(--sa-bg)]/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <DateField label="Requested" value={round.requested_at} onChange={(v) => persistPatch({ requested_at: v })} />
            <DateField label="ETA" value={round.eta_at} onChange={(v) => persistPatch({ eta_at: v })} />
            <DateField label="Shipped" value={round.shipped_at} onChange={(v) => persistPatch({ shipped_at: v })} />
            <DateField label="Received" value={round.received_at} onChange={(v) => persistPatch({ received_at: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField label="Tracking #" value={round.tracking_number} onChange={(v) => persistPatch({ tracking_number: v })} />
            <TextField label="Carrier" value={round.carrier} onChange={(v) => persistPatch({ carrier: v })} />
          </div>

          <TextField label="Revision summary — what changed from the last round" multiline value={round.revision_summary} onChange={(v) => persistPatch({ revision_summary: v })} />

          <FeedbackThread
            round={round}
            comments={comments}
            userMap={userMap}
            ctx={ctx}
          />

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                if (!window.confirm(`Delete "${round.label}"? This can't be undone.`)) return;
                startTransition(async () => {
                  await import("../../../../samples-actions").then((m) =>
                    m.deleteSampleRound({
                      workspace_slug: ctx.workspaceSlug,
                      collection_id: ctx.collectionId,
                      product_id: ctx.productId,
                      mode: ctx.mode,
                      role: ctx.role,
                      sample_round_id: round.id,
                    }),
                  );
                  router.refresh();
                });
              }}
              className="text-[11px] text-red-600 hover:underline"
            >
              Delete round
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Inline field helpers ──────────────────────────────────────────

function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">{label}</label>
      <input
        type="date"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== (value ?? "") && onChange(v || null)}
        className="w-full rounded border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1 text-[12px] text-[var(--sa-text-primary)] focus:border-[var(--sa-accent)] outline-none"
      />
    </div>
  );
}

function TextField({ label, value, onChange, multiline }: { label: string; value: string | null; onChange: (v: string | null) => void; multiline?: boolean }) {
  const [v, setV] = useState(value ?? "");
  const commonProps = {
    value: v,
    onChange: (e: any) => setV(e.target.value),
    onBlur: () => v !== (value ?? "") && onChange(v.trim() || null),
    className: "w-full rounded border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1 text-[12px] text-[var(--sa-text-primary)] focus:border-[var(--sa-accent)] outline-none",
  };
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">{label}</label>
      {multiline ? <textarea rows={3} {...commonProps as any} /> : <input type="text" {...commonProps as any} />}
    </div>
  );
}

// ── Feedback thread ───────────────────────────────────────────────

function FeedbackThread({
  round, comments, userMap, ctx,
}: {
  round: SampleRound;
  comments: SampleComment[];
  userMap: Record<string, string>;
  ctx: Props;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addSampleComment({
        workspace_id: ctx.workspaceId,
        workspace_slug: ctx.workspaceSlug,
        collection_id: ctx.collectionId,
        product_id: ctx.productId,
        mode: ctx.mode,
        role: ctx.role,
        sample_round_id: round.id,
        body: body.trim(),
      });
      if (!res.success) { alert(res.error); return; }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-2">Feedback</p>
      {comments.length > 0 && (
        <div className="rounded border border-[var(--sa-border)] bg-[var(--sa-window)] divide-y divide-[var(--sa-border)] mb-2">
          {comments.map((c) => (
            <div key={c.id} className="px-3 py-2">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-[var(--sa-text-primary)]">{userMap[c.user_id] ?? c.user_id.slice(0, 6)}</span>
                <span className="text-[10px] text-[var(--sa-text-tertiary)]">
                  {new Date(c.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-[12px] text-[var(--sa-text-secondary)] whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave feedback…"
          rows={2}
          className="flex-1 rounded border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1.5 text-[12px] text-[var(--sa-text-primary)] focus:border-[var(--sa-accent)] outline-none resize-none"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="self-start rounded bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Post
        </button>
      </form>
    </div>
  );
}

// ── New-round modal ───────────────────────────────────────────────

function NewRoundModal({
  existingCount, workspaceId, workspaceSlug, collectionId, productId, mode, role, onClose,
}: {
  existingCount: number;
  workspaceId: string;
  workspaceSlug: string;
  collectionId: string;
  productId: string;
  mode: WorkspaceMode;
  role: Role;
  onClose: () => void;
}) {
  const router = useRouter();
  const suggested = SAMPLE_LABEL_SUGGESTIONS[Math.min(existingCount, SAMPLE_LABEL_SUGGESTIONS.length - 1)];
  const [label, setLabel] = useState<string>(suggested);
  const [requested, setRequested] = useState<string>(new Date().toISOString().slice(0, 10));
  const [eta, setEta] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createSampleRound({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        collection_id: collectionId,
        product_id: productId,
        mode,
        role,
        label,
        requested_at: requested || null,
        eta_at: eta || null,
      });
      if (!res.success) { setError(res.error); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isPending && onClose()} />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">New sample round</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--sa-hover)]"><X size={16} className="text-[var(--sa-text-tertiary)]" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SAMPLE_LABEL_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLabel(s)}
                  className="rounded-full border border-[var(--sa-border)] px-2 py-0.5 text-[10px] text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)]"
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">Requested</label>
              <input type="date" value={requested} onChange={(e) => setRequested(e.target.value)} className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1">ETA</label>
              <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]" />
            </div>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-[var(--sa-border)] px-4 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]">Cancel</button>
          <button type="submit" disabled={isPending} className="rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50">{isPending ? "Creating…" : "Create round"}</button>
        </div>
      </form>
    </div>
  );
}
