// ─────────────────────────────────────────────────────────────
// The shape of outsourced tech pack work.
//
// Shared by our board and the studio's link so the two can never disagree
// about what a status means or what a version is. Pure data — no server
// imports — because both a Server Component and a Client Component read it.
// ─────────────────────────────────────────────────────────────

/**
 * requested → started → delivered → accepted, with a loop back through
 * revision_requested for as many rounds as it takes.
 *
 * 'cancelled' is terminal and is filtered out of every view rather than
 * shown greyed, because a board full of abandoned work is a board nobody
 * reads.
 */
export const JOB_STATUSES = [
  "requested",
  "in_progress",
  "delivered",
  "revision_requested",
  "accepted",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export interface StatusMeta {
  label: string;
  /** What it means from our side, in the board's own voice. */
  column: string;
  tone: "waiting" | "active" | "attention" | "done";
}

export const STATUS_META: Record<JobStatus, StatusMeta> = {
  requested:          { label: "Requested",      column: "Requested",       tone: "waiting" },
  in_progress:        { label: "In progress",    column: "In progress",     tone: "active" },
  delivered:          { label: "Delivered",      column: "Waiting on us",   tone: "attention" },
  revision_requested: { label: "Changes asked",  column: "Changes asked",   tone: "attention" },
  accepted:           { label: "Accepted",       column: "Accepted",        tone: "done" },
  cancelled:          { label: "Cancelled",      column: "Cancelled",       tone: "done" },
};

/** The columns a Kanban shows, in the order work moves through them. */
export const BOARD_COLUMNS: JobStatus[] = [
  "requested",
  "in_progress",
  "delivered",
  "revision_requested",
  "accepted",
];

export interface JobVersion {
  version: number;
  fileName: string | null;
  fileUrl: string;
  changeNote: string | null;
  createdAt: string;
  uploadedBy: string;
}

export interface JobNote {
  id: string;
  author: "agency" | "studio";
  authorName: string | null;
  body: string;
  /** Set when the note is a request for something from us. */
  asksFor: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/**
 * The things a studio runs out of mid-pack.
 *
 * A fixed list rather than free text, for the same reason file tags are:
 * "logo", "Logo" and "the logo" are three filters and one need.
 */
export const ASK_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "logo",         label: "Logo files" },
  { id: "artwork",      label: "Artwork / print files" },
  { id: "measurements", label: "Measurements or size chart" },
  { id: "reference",    label: "Reference photos" },
  { id: "fabric",       label: "Fabric or trim detail" },
  { id: "sample",       label: "A physical sample" },
  { id: "other",        label: "Something else" },
];

export const ASK_LABEL: Record<string, string> = Object.fromEntries(
  ASK_OPTIONS.map((a) => [a.id, a.label]),
);

/**
 * The studio's own ordering, which is theirs to set and ours only to read.
 *
 * Three buckets rather than a free ranking: a studio with fifteen packs
 * open can answer "what are you on today" in one click, and a number they
 * have to keep renumbering is a number they stop maintaining.
 */
export const STUDIO_RANKS = [
  { id: "now",   label: "On it now", short: "Now",   tone: "var(--sa-accent)" },
  { id: "next",  label: "Up next",   short: "Next",  tone: "var(--sa-warning)" },
  { id: "later", label: "Later",     short: "Later", tone: "var(--sa-text-tertiary)" },
] as const;

export type StudioRank = (typeof STUDIO_RANKS)[number]["id"];

export const STUDIO_RANK_LABEL: Record<string, string> =
  Object.fromEntries(STUDIO_RANKS.map((r) => [r.id, r.label]));

/** Sort order for the ranks; anything unranked falls to the bottom. */
export const RANK_ORDER: Record<string, number> = { now: 0, next: 1, later: 3 };

export function isStudioRank(value: unknown): value is StudioRank {
  return typeof value === "string" && STUDIO_RANKS.some((r) => r.id === value);
}

/**
 * A plain yyyy-mm-dd, or null. Dates arrive from a date input and go
 * straight into a DATE column, so anything else is rejected here rather
 * than by Postgres with an error nobody outside can act on.
 */
export function cleanDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : value;
}

/** Days between today and a date: negative is in the past. */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - start) / 86_400_000);
}

/** How late a job is, or null when nothing is due. */
export function daysLate(dueDate: string | null, status: JobStatus): number | null {
  if (!dueDate) return null;
  if (status === "accepted" || status === "cancelled") return null;
  const diff = Date.now() - new Date(dueDate).getTime();
  const days = Math.floor(diff / 86_400_000);
  return days > 0 ? days : null;
}
