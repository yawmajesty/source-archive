"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { getLeadTrail, setLeadCallBooked, type TrailEvent } from "@/app/(app)/leads/trail-actions";

// ─────────────────────────────────────────────────────────────
// Who has been contacted, who has booked, who hasn't.
//
// Every reply already wrote a row to the email log against this lead, so
// the history existed and was simply invisible: the only way to tell
// whether someone had been written to was to open the Emails page and read
// addresses. This shows it in order, in the panel where the decision gets
// made.
//
// Booking a call is the one event with no email behind it — it happens in a
// calendar, not here — so it is the one thing that needs marking by hand.
// ─────────────────────────────────────────────────────────────

const DOT: Record<TrailEvent["kind"], string> = {
  intake: "var(--sa-accent)",
  sent: "var(--sa-border-strong)",
  revised: "var(--sa-warning)",
  call: "var(--sa-success)",
  status: "var(--sa-border-strong)",
};

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const time = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (days === 0) return `today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return "yesterday";
  return time;
}

export function LeadTrail({
  leadId,
  callBookedAt,
  onChanged,
}: {
  leadId: string;
  callBookedAt: string | null;
  onChanged?: (bookedAt: string | null) => void;
}) {
  const [events, setEvents] = useState<TrailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booked = Boolean(callBookedAt);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getLeadTrail(leadId).then((rows) => {
      if (!live) return;
      setEvents(rows);
      setLoading(false);
    });
    return () => { live = false; };
  }, [leadId, callBookedAt]);

  async function toggle() {
    setBusy(true);
    setError(null);
    const next = !booked;
    const res = await setLeadCallBooked(leadId, next);
    setBusy(false);
    if (!res.success) { setError(res.error); return; }
    onChanged?.(next ? new Date().toISOString() : null);
  }

  return (
    <div className="pt-2 border-t border-[var(--sa-border)]">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
        History
      </p>

      <button
        onClick={toggle}
        disabled={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-50"
        style={
          booked
            ? { background: "rgba(52,199,89,0.12)", color: "var(--sa-success)" }
            : { border: "1px solid var(--sa-border)", color: "var(--sa-text-secondary)" }
        }
      >
        {booked ? <CalendarCheck size={12} /> : <CalendarPlus size={12} />}
        {busy ? "Saving…" : booked ? "Call booked" : "Mark a call as booked"}
      </button>
      <p className="mt-1 text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
        {booked
          ? "Click again if it falls through. Doesn't change their status."
          : "For when they've actually picked a slot. Doesn't change their status."}
      </p>
      {error && <p className="mt-1 text-[11px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}

      <div className="mt-3">
        {loading ? (
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">Loading the history…</p>
        ) : events.length === 0 ? (
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">Nothing recorded yet.</p>
        ) : (
          <ol className="flex flex-col">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex gap-2.5">
                {/* A line down the left so it reads as a sequence rather than
                    a list of unrelated facts. */}
                <span className="relative flex w-[9px] shrink-0 justify-center">
                  <span
                    className="absolute top-[5px] h-[7px] w-[7px] rounded-full"
                    style={{ background: DOT[e.kind] }}
                  />
                  {i < events.length - 1 && (
                    <span
                      className="absolute top-[13px] bottom-0 w-px"
                      style={{ background: "var(--sa-border)" }}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1 pb-2.5">
                  <span className="block text-[12px] leading-snug text-[var(--sa-text-primary)]">
                    {e.label}
                  </span>
                  <span className="block text-[10.5px] text-[var(--sa-text-tertiary)]">
                    {when(e.at)}
                    {e.detail && ` · ${e.detail}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
