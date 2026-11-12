"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Circle, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone, Sample, Task } from "@/lib/mock-data";
import type { ProductJobSummary } from "@/app/(app)/techpacks/production-actions";
import { createTask, completeTask, completeMilestone } from "@/app/(app)/tasks/actions";

// ─────────────────────────────────────────────────────────────
// Dates — what replaced Milestones.
//
// The old card read a table nothing in the app could write to, so every
// product in the system showed "No milestones" and always would. The
// honest version of that card is this one: the dates the product really
// has, gathered from where they already live, sorted by when they fall,
// with the late ones saying so.
//
// Three kinds of row, deliberately distinguishable:
//   · read — happened, or belongs to another panel (a sample arriving)
//   · linked — editable, but somewhere else (the tech pack deadline)
//   · own — a date somebody added here, which is a task against this
//     product, so it is also on the task board where work gets looked at
//
// Adding a date writes a task rather than a milestone. A date nobody is
// shown is a date nobody meets, and the task board is where this agency
// looks. Legacy milestone rows still render, so nothing is lost.
// ─────────────────────────────────────────────────────────────

type Tone = "done" | "late" | "soon" | "future";

interface Row {
  key: string;
  label: string;
  date: string;            // yyyy-mm-dd
  tone: Tone;
  /** Shown under the label when there's something worth adding. */
  detail?: string | null;
  /** Present when the row can be ticked off from here. */
  complete?: () => Promise<void>;
}

function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function pretty(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC",
  });
}

function daysUntil(date: string): number {
  const then = Date.parse(`${date}T00:00:00Z`);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((then - today) / 86_400_000);
}

function toneFor(date: string, done: boolean): Tone {
  if (done) return "done";
  const left = daysUntil(date);
  if (left < 0) return "late";
  if (left <= 5) return "soon";
  return "future";
}

const TONE_COLOR: Record<Tone, string> = {
  done: "var(--sa-success)",
  late: "var(--sa-danger)",
  soon: "var(--sa-warning)",
  future: "var(--sa-text-tertiary)",
};

function relative(date: string, tone: Tone): string {
  if (tone === "done") return "done";
  const left = daysUntil(date);
  if (left < 0) return `${Math.abs(left)}d late`;
  if (left === 0) return "today";
  if (left === 1) return "tomorrow";
  return `${left}d`;
}

export function ProductDates({
  productId, projectId, expectedSampleDate, samples, milestones, tasks, job, canEdit,
}: {
  productId: string;
  projectId: string | null;
  expectedSampleDate: string | null;
  samples: Sample[];
  milestones: Milestone[];
  tasks: Task[];
  /** The outsourced tech pack request, if this product has one. */
  job: ProductJobSummary | null;
  canEdit: boolean;
}) {
  const sampleDate = iso(expectedSampleDate);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [localMilestones, setLocalMilestones] = useState(milestones);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newWho, setNewWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addDate() {
    if (!projectId) { setError("This product isn't in a project yet, so there's nowhere to hang a date"); return; }
    if (!newTitle.trim()) { setError("Give it a name"); return; }
    if (!newDate) { setError("Pick a date"); return; }
    setBusy(true); setError(null);
    const who = newWho.trim();
    const res = await createTask({
      project_id: projectId,
      product_id: productId,
      title: newTitle.trim(),
      status: "todo",
      assigned_to: who,
      assigned_initials: who ? who.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "",
      due_date: newDate,
      notes: "",
    });
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    // Mirrors what the server just wrote. The id is cosmetic until the
    // page is next loaded; nothing keys off it but React.
    setLocalTasks((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`, project_id: projectId, product_id: productId,
        title: newTitle.trim(), status: "todo" as Task["status"], assigned_to: who,
        assigned_initials: "", due_date: newDate, notes: "", created_at: new Date().toISOString(),
      },
    ]);
    setNewTitle(""); setNewDate(""); setNewWho(""); setAdding(false);
  }

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];

    // ── The tech pack, which is the deadline people actually chase ──
    const packDue = iso(job?.dueDate);
    if (packDue) {
      const delivered = job?.status === "delivered" || job?.status === "accepted";
      out.push({
        key: "pack-due",
        label: "Tech pack due",
        date: packDue,
        tone: toneFor(packDue, delivered),
        detail: job?.studioName ? `with ${job.studioName}` : "no studio yet",
      });
    }
    const packEta = iso(job?.studioEta);
    if (packEta) {
      // Overshooting the deadline is a warning, not lateness — the date
      // itself is still in the future, and colouring it red would say
      // something that isn't true yet.
      const over = packDue && packEta > packDue ? daysUntil(packEta) - daysUntil(packDue) : 0;
      out.push({
        key: "pack-eta",
        label: "Studio says it lands",
        date: packEta,
        tone: over > 0 ? "soon" : toneFor(packEta, false),
        detail: over > 0 ? `${over} day${over === 1 ? "" : "s"} after we asked for it` : null,
      });
    }

    // ── Sampling ──
    // Once a sample has actually arrived, the date one was expected is
    // history and only clutters the list — the arrival row says it better.
    const arrived = samples.some((s) => s.received_date);
    if (sampleDate && !arrived) {
      out.push({
        key: "sample-expected",
        label: "Sample expected",
        date: sampleDate,
        tone: toneFor(sampleDate, false),
      });
    }
    for (const s of samples) {
      const received = iso(s.received_date);
      if (received) {
        out.push({ key: `s-${s.id}-in`, label: `Round ${s.round} sample arrived`, date: received, tone: "done" });
      }
      const approved = iso(s.approved_at);
      if (approved) {
        out.push({ key: `s-${s.id}-ok`, label: `Round ${s.round} approved`, date: approved, tone: "done" });
      }
    }

    // ── Dates somebody added by hand ──
    for (const t of localTasks) {
      const due = iso(t.due_date);
      if (!due) continue;
      const done = t.status === "done";
      out.push({
        key: `t-${t.id}`,
        label: t.title,
        date: due,
        tone: toneFor(due, done),
        detail: t.assigned_to || null,
        complete: done || t.id.startsWith("local-") ? undefined : async () => {
          await completeTask(t.id);
          setLocalTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: "done" as Task["status"] } : x)));
        },
      });
    }

    // ── Anything left in the old milestones table ──
    for (const m of localMilestones) {
      const due = iso(m.due_date);
      if (!due) continue;
      const done = Boolean(m.completed_at);
      out.push({
        key: `m-${m.id}`,
        label: m.title,
        date: due,
        tone: toneFor(due, done),
        detail: m.notes || null,
        complete: done ? undefined : async () => {
          await completeMilestone(m.id);
          setLocalMilestones((prev) =>
            prev.map((x) => (x.id === m.id ? { ...x, completed_at: new Date().toISOString() } : x)));
        },
      });
    }

    // Soonest first, and anything already done sinks below what is not.
    return out.sort((a, b) => {
      const aDone = a.tone === "done" ? 1 : 0;
      const bDone = b.tone === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return a.date.localeCompare(b.date);
    });
  }, [job, sampleDate, samples, localTasks, localMilestones]);

  const open = rows.filter((r) => r.tone !== "done");
  const late = open.filter((r) => r.tone === "late").length;
  const next = open[0] ?? null;

  const inputCls =
    "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none transition-colors focus:border-[var(--sa-accent)]";

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3 panel-border-b">
        <div className="min-w-0">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
            Dates
          </span>
          <span className="ml-2 text-[10px] text-[var(--sa-text-tertiary)]">
            {late > 0
              ? `${late} late`
              : next
                ? `next: ${pretty(next.date)}`
                : "nothing scheduled"}
          </span>
        </div>
        {canEdit && !adding && (
          <button
            onClick={() => { setAdding(true); setError(null); }}
            className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--sa-accent)] transition-opacity hover:opacity-70"
          >
            <Plus size={11} strokeWidth={2.5} /> Add
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        {adding && (
          <div className="mb-3 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-2.5">
            <input
              autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What's happening? e.g. Fabric lands at the factory"
              className={inputCls}
            />
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputCls} />
              <input
                value={newWho} onChange={(e) => setNewWho(e.target.value)}
                placeholder="Who (optional)" className={inputCls}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                onClick={addDate} disabled={busy}
                className="shrink-0 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[11.5px] font-medium text-white disabled:opacity-50"
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : "Add"}
              </button>
              <button
                onClick={() => { setAdding(false); setError(null); }}
                className="shrink-0 px-1 text-[11.5px] text-[var(--sa-text-tertiary)]"
              >
                Cancel
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
              It goes on the task board too, against this style.
            </p>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="py-3 text-center text-[12px] leading-snug text-[var(--sa-text-tertiary)]">
            No dates on this style yet. A tech pack deadline, a sample date, or anything
            you add here will show up in order.
          </p>
        ) : (
          <ol className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-start gap-2.5 border-b border-[var(--sa-border)] py-2 last:border-b-0"
              >
                {row.complete ? (
                  <button
                    onClick={() => { void row.complete?.(); }}
                    title="Mark it done"
                    className="mt-[3px] shrink-0 text-[var(--sa-text-tertiary)] transition-colors hover:text-[var(--sa-success)]"
                  >
                    <Circle size={12} strokeWidth={1.75} />
                  </button>
                ) : (
                  <span className="mt-[3px] shrink-0" style={{ color: TONE_COLOR[row.tone] }}>
                    {row.tone === "done"
                      ? <Check size={12} strokeWidth={2.5} />
                      : <CalendarDays size={12} strokeWidth={1.75} />}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-[12.5px] leading-snug",
                    row.tone === "done"
                      ? "text-[var(--sa-text-tertiary)]"
                      : "text-[var(--sa-text-primary)]",
                  )}>
                    {row.label}
                  </p>
                  {row.detail && (
                    <p className="text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">{row.detail}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[11.5px] text-[var(--sa-text-secondary)]">{pretty(row.date)}</p>
                  <p className="text-[10px] font-medium" style={{ color: TONE_COLOR[row.tone] }}>
                    {relative(row.date, row.tone)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {error && <p className="mt-2 text-[11.5px] text-red-500">{error}</p>}
      </div>
    </section>
  );
}
