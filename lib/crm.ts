// ─────────────────────────────────────────────────────────────
// CRM shapes and the rules for what needs attention.
//
// The timeline is assembled at read time from the tables that already
// own each kind of event — emails from email_messages, stage moves from
// product_stage_events, portal visits from portal_visits — plus the
// manual touchpoints the CRM adds. Copying those into a feed table would
// mean two records of one thing, and the copy would be the one that
// drifted.
// ─────────────────────────────────────────────────────────────

export type TouchpointKind = "call" | "meeting" | "note" | "whatsapp" | "email" | "other";
export type TouchpointDirection = "outbound" | "inbound" | "internal";

export const TOUCHPOINT_KINDS: { id: TouchpointKind; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "meeting", label: "Meeting" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email (logged by hand)" },
  { id: "note", label: "Note" },
  { id: "other", label: "Other" },
];

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  notes: string | null;
}

export interface Touchpoint {
  id: string;
  client_id: string;
  contact_id: string | null;
  kind: TouchpointKind;
  direction: TouchpointDirection;
  summary: string;
  detail: string | null;
  occurred_at: string;
  created_by_name: string | null;
}

/** One row in the merged relationship feed. */
export interface TimelineItem {
  id: string;
  /** Where it came from, which decides the icon and whether it's editable. */
  source: "touchpoint" | "email" | "stage" | "portal";
  kind: string;
  direction: TouchpointDirection;
  title: string;
  detail: string | null;
  at: string;
  /** Only set for rows the CRM owns, so the UI knows what it can delete. */
  touchpointId?: string;
  status?: string | null;
}

export interface ClientCrmSummary {
  id: string;
  name: string;
  status: string | null;
  contactEmail: string | null;
  productCount: number;
  lastContactAt: string | null;
  daysSinceContact: number | null;
  nextFollowUpAt: string | null;
  followUpNote: string | null;
  followUpOverdue: boolean;
  attention: AttentionLevel;
  reason: string;
}

export type AttentionLevel = "overdue" | "due" | "quiet" | "fine";

/** Anything beyond this without contact is worth a nudge. Four weeks is
 *  long enough not to nag during an active sampling round and short
 *  enough that a client never quietly goes cold. */
export const QUIET_DAYS = 28;

export function daysBetween(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

/**
 * What the list sorts on.
 *
 * A follow-up you set yourself outranks silence, because you decided it
 * mattered. Silence only counts against an active client — an
 * onboarding client hasn't started and an inactive one has finished.
 */
export function assessClient(input: {
  status: string | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  now?: number;
}): { level: AttentionLevel; reason: string; overdue: boolean } {
  const now = input.now ?? Date.now();
  const days = daysBetween(input.lastContactAt, now);

  if (input.nextFollowUpAt) {
    const due = new Date(`${input.nextFollowUpAt}T23:59:59`).getTime();
    if (due < now) {
      const late = Math.floor((now - due) / 86_400_000);
      return {
        level: "overdue",
        reason: late < 1 ? "Follow-up due today" : `Follow-up ${late} day${late === 1 ? "" : "s"} overdue`,
        overdue: true,
      };
    }
    const inDays = Math.ceil((due - now) / 86_400_000);
    if (inDays <= 3) {
      return { level: "due", reason: inDays <= 1 ? "Follow-up due today" : `Follow-up in ${inDays} days`, overdue: false };
    }
  }

  if (input.status === "inactive") return { level: "fine", reason: "Inactive", overdue: false };
  if (input.status === "onboarding") {
    return days == null
      ? { level: "due", reason: "Onboarding — no contact logged yet", overdue: false }
      : { level: "fine", reason: `Onboarding · last contact ${days}d ago`, overdue: false };
  }

  if (days == null) return { level: "quiet", reason: "No contact logged yet", overdue: false };
  if (days >= QUIET_DAYS) return { level: "quiet", reason: `No contact in ${days} days`, overdue: false };

  return { level: "fine", reason: days === 0 ? "Spoke today" : `Last contact ${days}d ago`, overdue: false };
}

const ORDER: Record<AttentionLevel, number> = { overdue: 0, due: 1, quiet: 2, fine: 3 };

export function sortByAttention(a: ClientCrmSummary, b: ClientCrmSummary): number {
  const byLevel = ORDER[a.attention] - ORDER[b.attention];
  if (byLevel !== 0) return byLevel;
  // Within a level, the one you've ignored longest comes first.
  return (b.daysSinceContact ?? 99_999) - (a.daysSinceContact ?? 99_999);
}

export const ATTENTION_STYLE: Record<AttentionLevel, { label: string; bg: string; fg: string }> = {
  overdue: { label: "Overdue", bg: "rgba(255,59,48,0.12)", fg: "var(--sa-danger)" },
  due:     { label: "Due",     bg: "rgba(255,149,0,0.12)", fg: "var(--sa-warning)" },
  quiet:   { label: "Quiet",   bg: "rgba(255,149,0,0.10)", fg: "var(--sa-warning)" },
  fine:    { label: "Fine",    bg: "rgba(52,199,89,0.12)", fg: "var(--sa-success)" },
};
