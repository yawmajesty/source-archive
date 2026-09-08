"use client";

import Link from "next/link";
import {
  FileText, Inbox, CalendarClock, Clock, Receipt, Camera,
  Megaphone, PauseCircle, CheckSquare, CheckCircle2,
} from "lucide-react";
import {
  QUEUE_META, URGENCY_STYLE, STALL_DAYS,
  type CommandCentre, type QueueKind,
} from "@/lib/command-centre";

const ICON: Record<QueueKind, React.ElementType> = {
  brief: FileText,
  lead: Inbox,
  followup: CalendarClock,
  approval: Clock,
  invoice: Receipt,
  shoot: Camera,
  marketing: Megaphone,
  stalled: PauseCircle,
  task: CheckSquare,
};

/**
 * The first screen after signing in.
 *
 * It answers one question — what happens if I do nothing today — so it
 * leads with what gets worse when ignored rather than with a list of
 * everything that exists.
 */
export function CommandCentreClient({ centre }: { centre: CommandCentre }) {
  const { queues, totals } = centre;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--sa-border)] px-6 py-3">
        <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Command centre</h1>
        <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
          {totals.needsYou === 0
            ? "Nothing waiting on you."
            : `${totals.needsYou} thing${totals.needsYou === 1 ? "" : "s"} waiting on you.`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {/* The numbers worth glancing at */}
          <div className="mb-6 flex flex-wrap gap-3">
            <Stat
              label="Waiting on you"
              value={String(totals.needsYou)}
              tone={totals.needsYou > 0 ? "var(--sa-warning)" : "var(--sa-success)"}
            />
            {totals.owed > 0 && (
              <Stat
                label="Invoiced, unpaid"
                value={`$${totals.owed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                tone="var(--sa-danger)"
              />
            )}
            <Stat label="Products in flight" value={String(totals.activeProducts)} />
            <Stat label="Active clients" value={String(totals.activeClients)} />
          </div>

          {queues.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <CheckCircle2 size={24} className="text-[var(--sa-success)]" />
              <p className="mt-2.5 text-[14px] font-medium text-[var(--sa-text-primary)]">
                Nothing needs you
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
                No unanswered briefs, no new enquiries, no follow-ups due and nothing overdue.
                Everything that was going to shout has been dealt with.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {queues.map((queue) => {
                const meta = QUEUE_META[queue.kind];
                const Icon = ICON[queue.kind];
                return (
                  <section key={queue.kind}>
                    <div className="mb-2 flex flex-wrap items-baseline gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded"
                        style={{ background: `${meta.tone}1F`, color: meta.tone }}
                      >
                        <Icon size={12} />
                      </span>
                      <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">
                        {queue.label}
                      </p>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums"
                        style={{ background: `${meta.tone}1F`, color: meta.tone }}
                      >
                        {queue.total}
                      </span>
                      <p className="min-w-0 flex-1 text-[11.5px] text-[var(--sa-text-tertiary)]">
                        {queue.stake}
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[var(--sa-border)]">
                      {queue.items.map((item, i) => {
                        const u = URGENCY_STYLE[item.urgency];
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            className={`flex items-center gap-3 bg-[var(--sa-window)] px-4 py-2.5 hover:bg-[var(--sa-hover)] ${
                              i > 0 ? "border-t border-[var(--sa-border)]" : ""
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] text-[var(--sa-text-primary)]">
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="block truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                            {item.age && (
                              <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)]">
                                {item.age}
                              </span>
                            )}
                            <span
                              className="w-[62px] shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                              style={{ background: u.bg, color: u.fg }}
                            >
                              {u.label}
                            </span>
                          </Link>
                        );
                      })}

                      {queue.total > queue.items.length && (
                        <div className="border-t border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-2">
                          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                            {queue.total - queue.items.length} more
                            {queue.kind === "stalled" && ` — nothing logged in over ${STALL_DAYS} days`}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
        {label}
      </p>
      <p
        className="mt-0.5 text-[20px] font-semibold tabular-nums leading-tight"
        style={{ color: tone ?? "var(--sa-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
