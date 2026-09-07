// ─────────────────────────────────────────────────────────────
// Carrying a calculation from the public tool into an account.
//
// "Sign up to save this" is a lie unless the thing they built survives
// the trip. The public page has no server state by design, so the work
// travels in localStorage: same origin either side of Clerk, so it is
// still there when they land in their new workspace.
//
// Deliberately a different key from the calculator's own autosave. That
// one is a convenience and gets overwritten constantly; this one is a
// promise made to someone, and must not be clobbered by the next visitor
// to open the calculator in the same browser.
// ─────────────────────────────────────────────────────────────

export const CALCULATOR_KEY = "sa-price-calculator-v1";
export const HANDOFF_KEY = "sa-price-handoff-v1";

/** How long a stashed calculation is honoured. Long enough to sign up,
 *  short enough that a sheet doesn't appear weeks later out of nowhere. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface Handoff<T> {
  savedAt: number;
  value: T;
}

export function stashForSignup<T>(value: T): boolean {
  try {
    window.localStorage.setItem(HANDOFF_KEY, JSON.stringify({ savedAt: Date.now(), value }));
    return true;
  } catch {
    // Private browsing, full quota, or storage blocked outright. The caller
    // needs to know, because without this the sign-up promise can't be kept.
    return false;
  }
}

export function takeHandoff<T>(): T | null {
  try {
    const raw = window.localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    // Read once and clear immediately: a failed import that stayed put
    // would try again on every visit to the page.
    window.localStorage.removeItem(HANDOFF_KEY);
    const parsed = JSON.parse(raw) as Handoff<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function hasHandoff(): boolean {
  try {
    return window.localStorage.getItem(HANDOFF_KEY) != null;
  } catch {
    return false;
  }
}

/**
 * Guard for the ?next= parameter carried through sign-up.
 *
 * Only same-site paths are honoured. Without this the parameter is an open
 * redirect: a link to our own sign-up page could bounce someone to an
 * attacker's site wearing our domain in the address bar on the way.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;   // absolute or scheme-relative
  if (next.startsWith("//")) return fallback;   // protocol-relative host
  if (next.includes("\\")) return fallback;     // backslash tricks some parsers
  return next;
}
