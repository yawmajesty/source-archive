"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText, Inbox, CalendarClock, Clock, Receipt, Camera, Megaphone,
  PauseCircle, CheckSquare, CheckCircle2, TrendingDown, EyeOff, Activity,
  Check, Clock3, X, ArrowUpRight, Package, MessageSquare, Eye,
} from "lucide-react";
import {
  QUEUE_META, URGENCY_STYLE, STALL_DAYS,
  type CommandCentre, type QueueKind, type QueueItem, type Happening,
} from "@/lib/command-centre";
import { quickAction } from "./command-actions";
import { BriefReviewer } from "./BriefReviewer";

const ICON: Record<QueueKind, React.ElementType> = {
  brief: FileText,
  lead: Inbox,
  followup: CalendarClock,
  approval: Clock,
  invoice: Receipt,
  shoot: Camera,
  marketing: Megaphone,
  stalled: PauseCircle,
  margin: TrendingDown,
  quiet: EyeOff,
  task: CheckSquare,
};

/** What each row can have done to it without leaving the page. */
const ACTIONS: Partial<Record<QueueKind, Array<{ action: string; label: string; icon: React.ElementType }>>> = {
  lead:      [{ action: "contacted", label: "Replied", icon: Check }, { action: "lost", label: "Not for us", icon: X }],
  followup:  [{ action: "done", label: "Done", icon: Check }, { action: "snooze", label: "Next week", icon: Clock3 }],
  invoice:   [{ action: "paid", label: "Paid", icon: Check }],
  task:      [{ action: "done", label: "Done", icon: Check }],
  marketing: [{ action: "done", label: "Went out", icon: Check }],
  stalled:   [{ action: "complete", label: "Finished", icon: Check }],
};

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/** Happenings get an icon from what they are, read off the text. */
function happeningIcon(text: string): React.ElementType {
  if (text.startsWith("New brief")) return FileText;
  if (text.includes("opened their portal")) return Eye;
  if (text.startsWith("Update on")) return MessageSquare;
  return Package;
}

export function CommandCentreClient({
  centre, happenings,
}: {
  centre: CommandCentre;
  happenings: Happening[];
}) {
  const [queues, setQueues] = useState(centre.queues);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { totals } = centre;

  function dropItem(itemId: string) {
    setQueues((prev) =>
      prev
        .map((q) => ({ ...q, items: q.items.filter((i) => i.id !== itemId), total: q.total - 1 }))
        .filter((q) => q.items.length > 0),
    );
  }

  async function act(item: QueueItem, action: string) {
    setError(null);
    // The id is prefixed for uniqueness across queues; the row's own id
    // is what the server needs.
    const rawId = item.id.replace(/^[a-z]+-/, "");
    dropItem(item.id);
    startTransition(async () => {
      const res = await quickAction(item.kind, rawId, action);
      if (!res.success) setError(res.error ?? "That didn't work — reload and try again");
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--sa-border)] px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Command centre</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            {totals.needsYou === 0
              ? "Nothing waiting on you."
              : `${totals.needsYou} thing${totals.needsYou === 1 ? "" : "s"} waiting on you.`}
          </p>
        </div>
      </div>

      {error && (
        <p className="border-b border-[var(--sa-border)] px-6 py-2 text-[12.5px] text-red-500">{error}</p>
      )}

      {/* Fills the width it's given — the sidebar is the only fixed thing */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Numbers */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Waiting on you"
            value={String(totals.needsYou)}
            tone={totals.needsYou > 0 ? "#B07A17" : "#1E8E4E"}
          />
          <Stat
            label="Invoiced, unpaid"
            value={totals.owed > 0 ? `$${totals.owed.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            tone={totals.owed > 0 ? "#B4453C" : undefined}
            href="/invoices"
          />
          <Stat label="Products in flight" value={String(totals.activeProducts)} href="/products" />
          <Stat label="Active clients" value={String(totals.activeClients)} href="/clients" />
        </div>

        {/* Just happened — the one part of this screen that isn't a problem */}
        {happenings.length > 0 && (
          <section className="mt-6">
            <div className="mb-2.5 flex items-center gap-2">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: "rgba(30,142,78,.14)", color: "#1E8E4E" }}
              >
                <Activity size={13} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Just happened</p>
              <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">The last seven days</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {happenings.map((h) => {
                const Icon = happeningIcon(h.text);
                return (
                  <Link
                    key={h.id}
                    href={h.href}
                    className="group flex gap-3 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-3.5 transition-colors hover:border-[var(--sa-accent)]"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "rgba(30,142,78,.10)", color: "#1E8E4E" }}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-snug text-[var(--sa-text-primary)]">
                        {h.text}
                      </span>
                      {h.detail && (
                        <span className="mt-0.5 block truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                          {h.detail}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] tabular-nums text-[var(--sa-text-tertiary)]">
                        {when(h.at)}
                      </span>
                    </span>
                    <ArrowUpRight
                      size={13}
                      className="shrink-0 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Queues */}
        {queues.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <CheckCircle2 size={24} className="text-[var(--sa-success)]" />
            <p className="mt-2.5 text-[14px] font-medium text-[var(--sa-text-primary)]">
              Nothing needs you
            </p>
            <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
              No unanswered briefs, no new enquiries, no follow-ups due and nothing overdue.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {queues.map((queue) => {
              const meta = QUEUE_META[queue.kind];
              const Icon = ICON[queue.kind];
              const actions = ACTIONS[queue.kind];
              return (
                <section
                  key={queue.kind}
                  className="overflow-hidden rounded-xl border bg-[var(--sa-window)]"
                  style={{ borderColor: `${meta.tone}33` }}
                >
                  {/* Each queue is tinted its own colour — the eye finds
                      "money owed" without reading the heading. */}
                  <div
                    className="flex flex-wrap items-center gap-2 px-4 py-2.5"
                    style={{ background: `${meta.tone}12` }}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ background: `${meta.tone}22`, color: meta.tone }}
                    >
                      <Icon size={13} />
                    </span>
                    <p className="text-[13px] font-semibold" style={{ color: meta.tone }}>
                      {queue.label}
                    </p>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-white"
                      style={{ background: meta.tone }}
                    >
                      {queue.total}
                    </span>
                    <p className="min-w-0 flex-1 text-[11px] text-[var(--sa-text-secondary)]">
                      {queue.stake}
                    </p>
                  </div>

                  <div>
                    {queue.items.map((item, i) => {
                      const u = URGENCY_STYLE[item.urgency];
                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--sa-hover)] ${
                            i > 0 ? "border-t border-[var(--sa-border)]" : ""
                          }`}
                        >
                          {queue.kind === "brief" ? (
                            <button
                              onClick={() => setReviewing(item.id.replace(/^brief-/, ""))}
                              className="min-w-0 flex-1 text-left"
                            >
                              <RowText item={item} />
                            </button>
                          ) : (
                            <Link href={item.href} className="min-w-0 flex-1">
                              <RowText item={item} />
                            </Link>
                          )}

                          {item.age && (
                            <span className="hidden shrink-0 text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)] sm:block">
                              {item.age}
                            </span>
                          )}

                          <span
                            className="w-[58px] shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide"
                            style={{ background: u.bg, color: u.fg }}
                          >
                            {u.label}
                          </span>

                          {queue.kind === "brief" ? (
                            <button
                              onClick={() => setReviewing(item.id.replace(/^brief-/, ""))}
                              className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-white"
                              style={{ background: meta.tone }}
                            >
                              Review
                            </button>
                          ) : actions ? (
                            <span className="flex shrink-0 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              {actions.map((a) => {
                                const AIcon = a.icon;
                                return (
                                  <button
                                    key={a.action}
                                    onClick={() => act(item, a.action)}
                                    title={a.label}
                                    className="flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-1.5 py-1 text-[11px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-window)]"
                                  >
                                    <AIcon size={10} /> {a.label}
                                  </button>
                                );
                              })}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}

                    {queue.total > queue.items.length && (
                      <div className="border-t border-[var(--sa-border)] px-4 py-2">
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

      {reviewing && (
        <BriefReviewer
          briefId={reviewing}
          onClose={() => setReviewing(null)}
          onDecided={(id) => {
            dropItem(`brief-${id}`);
            setReviewing(null);
          }}
        />
      )}
    </div>
  );
}

function RowText({ item }: { item: QueueItem }) {
  return (
    <>
      <span className="block truncate text-[13px] text-[var(--sa-text-primary)]">{item.title}</span>
      {item.subtitle && (
        <span className="block truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
          {item.subtitle}
        </span>
      )}
    </>
  );
}

function Stat({
  label, value, tone, href,
}: {
  label: string; value: string; tone?: string; href?: string;
}) {
  const inner = (
    <>
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
        {label}
      </p>
      <p
        className="mt-0.5 text-[24px] font-semibold leading-tight tabular-nums"
        style={{ color: tone ?? "var(--sa-text-primary)" }}
      >
        {value}
      </p>
    </>
  );

  const className =
    "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-3" +
    (href ? " transition-colors hover:border-[var(--sa-accent)]" : "");

  return href ? <Link href={href} className={className}>{inner}</Link> : <div className={className}>{inner}</div>;
}
