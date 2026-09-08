// ─────────────────────────────────────────────────────────────
// What needs a person today.
//
// The old dashboard listed products, which is a view of the work rather
// than a view of what's stuck. A dashboard earns its place by answering
// one question — what happens if I do nothing today — and everything
// here is something that gets worse when ignored.
//
// Ordered by what it costs to leave: money already earned but not
// collected, then people waiting on an answer, then work drifting.
// ─────────────────────────────────────────────────────────────

export type QueueKind =
  | "brief"
  | "lead"
  | "followup"
  | "approval"
  | "invoice"
  | "shoot"
  | "marketing"
  | "stalled"
  | "margin"
  | "quiet"
  | "task";

export type Urgency = "overdue" | "today" | "soon" | "waiting";

export interface QueueItem {
  id: string;
  kind: QueueKind;
  title: string;
  subtitle: string | null;
  /** How long it's been sitting, in plain words. */
  age: string | null;
  urgency: Urgency;
  href: string;
  /** Sorts within a queue; lower is more urgent. */
  rank: number;
}

export interface Queue {
  kind: QueueKind;
  label: string;
  /** How many are really in it, before the display cap. */
  total: number;
  /** What doing nothing costs. Shown when the queue is empty is pointless,
   *  so this only ever appears above real items. */
  stake: string;
  items: QueueItem[];
}

export const QUEUE_META: Record<QueueKind, { label: string; stake: string; tone: string; order: number }> = {
  invoice:   { label: "Money owed",            stake: "Work already done, not yet paid for",         tone: "#B4453C", order: 0 },
  brief:     { label: "Briefs waiting on you", stake: "A client asked and nobody has answered",      tone: "#0058B0", order: 1 },
  lead:      { label: "New enquiries",         stake: "Someone got in touch and hasn't heard back",  tone: "#1E8E4E", order: 2 },
  followup:  { label: "Follow-ups due",        stake: "You said you'd come back to them",            tone: "#B07A17", order: 3 },
  approval:  { label: "Waiting on the client", stake: "Samples sitting unapproved hold up the run",  tone: "#8E5BC7", order: 4 },
  shoot:     { label: "Shoots coming up",      stake: "A missing sample moves the whole day",        tone: "#0058B0", order: 5 },
  marketing: { label: "Marketing overdue",     stake: "A drop loses its build-up if the run slips",  tone: "#B07A17", order: 6 },
  margin:    { label: "Margin slipping",       stake: "Real cost has crept past what you quoted",    tone: "#B4453C", order: 5 },
  stalled:   { label: "Nothing's moved",       stake: "Products drifting quietly is how deadlines go", tone: "#6E6E73", order: 7 },
  quiet:     { label: "Gone quiet",            stake: "They stopped opening the portal before they said anything", tone: "#6E6E73", order: 8 },
  task:      { label: "Your tasks",            stake: "Due now or in the next few days",             tone: "#6E6E73", order: 9 },
};

/** No portal visit in this long and a client is drifting. */
export const QUIET_PORTAL_DAYS = 30;

/** Something that just happened, for the strip along the top. */
export interface Happening {
  id: string;
  text: string;
  detail: string | null;
  at: string;
  href: string;
}

/** How long something has been sitting, in words rather than a date. */
export function ageOf(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  return `${Math.floor(days / 30)} months`;
}

/**
 * How urgent a dated thing is.
 *
 * Anything without a date counts as "waiting" rather than fine — a lead
 * with no date is still a person who hasn't heard back.
 */
export function urgencyFor(dueISO: string | null, now = Date.now()): Urgency {
  if (!dueISO) return "waiting";
  const due = dueISO.slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);

  // Compared as dates, not as a duration. Measuring milliseconds to the
  // end of today and rounding up makes anything due today land a whole
  // day away, so "due today" read as "soon" — which is the one thing it
  // definitely isn't.
  if (due < today) return "overdue";
  if (due === today) return "today";

  const days = Math.round(
    (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(days)) return "waiting";
  return days <= 3 ? "soon" : "waiting";
}

export const URGENCY_STYLE: Record<Urgency, { label: string; bg: string; fg: string }> = {
  overdue: { label: "Overdue", bg: "rgba(255,59,48,.12)",  fg: "var(--sa-danger)" },
  today:   { label: "Today",   bg: "rgba(255,149,0,.14)",  fg: "var(--sa-warning)" },
  soon:    { label: "Soon",    bg: "rgba(0,88,176,.10)",   fg: "var(--sa-accent)" },
  waiting: { label: "Waiting", bg: "var(--sa-hover)",      fg: "var(--sa-text-secondary)" },
};

const URGENCY_RANK: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, waiting: 3 };

export function sortQueue(a: QueueItem, b: QueueItem): number {
  const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
  if (byUrgency !== 0) return byUrgency;
  return a.rank - b.rank;
}

export function sortQueues(a: Queue, b: Queue): number {
  return QUEUE_META[a.kind].order - QUEUE_META[b.kind].order;
}

/** A product that hasn't moved in this long is drifting, not progressing. */
export const STALL_DAYS = 21;

export interface CommandCentre {
  queues: Queue[];
  totals: {
    needsYou: number;
    owed: number;
    owedCurrency: string;
    activeProducts: number;
    activeClients: number;
  };
}
