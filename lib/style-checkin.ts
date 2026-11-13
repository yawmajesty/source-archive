// ─────────────────────────────────────────────────────────────
// The daily check-in on styles that are being made.
//
// A style sitting in Sampling is work somebody is waiting on, and the
// way it goes wrong is not that anyone decides to drop it — it is that
// nobody looks. So every morning the people who run sourcing get the
// list, whether or not anybody opens the app.
//
// What counts as "being made" is Sampling or Production. Everything
// earlier is still being decided and everything later is done.
//
// Two things are deliberately left out:
//
//   · styles belonging to an inactive client. That is the same rule the
//     daily digest applies to invoices, and it exists because a list
//     that includes dead work is a list people stop reading.
//
//   · styles marked as not going to production. They are already
//     excluded from every financial total in the app; chasing them
//     daily would be chasing something already decided against.
//
// Pure helpers only — no "use server" here, so the constants survive
// into any bundle that needs them (see lib/stages.ts for what happens
// otherwise).
// ─────────────────────────────────────────────────────────────

import { STAGE_LABEL } from "./stages";

/** The stages a style is actually being made in. */
export const CHECKIN_STAGES = ["sampling", "production"] as const;

export type CheckinStage = (typeof CHECKIN_STAGES)[number];

export function isCheckinStage(stage: string | null | undefined): stage is CheckinStage {
  return stage === "sampling" || stage === "production";
}

export function checkinStageLabel(stage: CheckinStage): string {
  return STAGE_LABEL[stage] ?? stage;
}

/** One style, as the email prints it. */
export interface StyleInFlight {
  id: string;
  name: string;
  clientName: string;
  collectionName: string;
  stage: CheckinStage;
  /** When it entered this stage, if anybody has ever set it from the product page. */
  enteredAt: string | null;
  /** Days in the stage, or null when there is no recorded date. */
  daysInStage: number | null;
  /** Sampling only: the date a sample was expected. */
  expectedDate: string | null;
  /** Days past the expected date. Null when there is no date, 0 or less when not yet due. */
  daysLate: number | null;
  /** Which sample round, where it is past the first. */
  round: number | null;
  /** Production only: the free-text status someone typed on the product. */
  statusNote: string | null;
  url: string;
}

export interface StyleCheckinInput {
  id: string;
  name: string | null;
  stage: string | null;
  expected_sample_date: string | null;
  sample_round: number | null;
  production_status_note: string | null;
  production_excluded_at: string | null;
}

export function daysBetween(fromISO: string, now: Date): number {
  const then = Date.parse(fromISO);
  if (!Number.isFinite(then)) return 0;
  // Whole days, floored, so something set this morning reads as 0 rather
  // than rounding up to a day that has not passed.
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/** "today" / "yesterday" / "6 days" — what goes after "in sampling since". */
export function dayPhrase(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks`;
  return `${Math.floor(days / 30)} months`;
}

export function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The one line of detail under a style's name.
 *
 * Says the most useful true thing available and nothing else. A style
 * whose stage was never set from the product page has no date to show,
 * and saying so is the point — it is what gets the buttons used.
 */
export function styleDetail(style: StyleInFlight): string {
  const bits: string[] = [];
  if (style.round && style.round > 1) bits.push(`Round ${style.round}`);

  if (style.stage === "sampling") {
    const due = formatDay(style.expectedDate);
    if (due && style.daysLate != null && style.daysLate > 0) {
      bits.push(`sample was expected ${due} — ${dayPhrase(style.daysLate)} late`);
    } else if (due) {
      bits.push(`sample expected ${due}`);
    }
  } else if (style.statusNote) {
    bits.push(style.statusNote);
  }

  // Nothing is said when there is no date. Saying "no date recorded" on
  // every line made thirteen of fifteen rows end the same way and buried
  // the dates that did exist; the email counts them in one sentence
  // instead.
  const since = dayPhrase(style.daysInStage);
  if (since) {
    bits.push(since === "today" || since === "yesterday"
      ? `in ${checkinStageLabel(style.stage).toLowerCase()} since ${since}`
      : `in ${checkinStageLabel(style.stage).toLowerCase()} ${since}`);
  }

  return bits.join(" · ");
}

/** Late samples first, then longest in the stage, then by name. */
export function sortStyles(styles: StyleInFlight[]): StyleInFlight[] {
  return styles.slice().sort((a, b) => {
    const lateA = a.daysLate != null && a.daysLate > 0 ? a.daysLate : -1;
    const lateB = b.daysLate != null && b.daysLate > 0 ? b.daysLate : -1;
    if (lateA !== lateB) return lateB - lateA;
    const inA = a.daysInStage ?? -1;
    const inB = b.daysInStage ?? -1;
    if (inA !== inB) return inB - inA;
    return a.name.localeCompare(b.name);
  });
}

export interface ClientGroup {
  clientName: string;
  styles: StyleInFlight[];
}

/** Grouped by client, because that is who you would ring about it. */
export function groupByClient(styles: StyleInFlight[]): ClientGroup[] {
  const byClient = new Map<string, StyleInFlight[]>();
  for (const s of sortStyles(styles)) {
    const list = byClient.get(s.clientName);
    if (list) list.push(s);
    else byClient.set(s.clientName, [s]);
  }
  return Array.from(byClient, ([clientName, list]) => ({ clientName, styles: list }))
    .sort((a, b) => b.styles.length - a.styles.length || a.clientName.localeCompare(b.clientName));
}

export function countLate(styles: StyleInFlight[]): number {
  return styles.filter((s) => s.daysLate != null && s.daysLate > 0).length;
}

/**
 * How many have no recorded date for entering their stage.
 *
 * Worth saying once, because the fix is one click per style and nothing
 * else in the app will ever prompt it.
 */
export function countUndated(styles: StyleInFlight[]): number {
  return styles.filter((s) => s.daysInStage == null).length;
}

// ── Who it goes to ───────────────────────────────────────────
//
// The three people who run sourcing, by name, because this is a standing
// internal list rather than a per-client setting and there is nowhere in
// the app to keep it. STYLE_CHECKIN_TO in the environment overrides it
// without a deploy, and any other agency falls back to whatever address
// it nominated for notifications — never to this one's.

const RECIPIENTS_BY_AGENCY: Record<string, string[]> = {
  "ag-source-archive": [
    "yaw@sourcearchive.studio",
    "sam@sourcearchive.studio",
    "hello@sourcearchive.studio",
  ],
};

export function styleCheckinRecipients(agencyId: string, nominated: string | null): string[] {
  const fromEnv = (process.env.STYLE_CHECKIN_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  const named = RECIPIENTS_BY_AGENCY[agencyId];
  if (named) return named;

  return nominated ? [nominated.trim()] : [];
}
