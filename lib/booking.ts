// ─────────────────────────────────────────────────────────────
// Where people book a call.
//
// One link, in one place, so the brief alert and the "let's talk" reply
// can never drift apart. It lives in code with an environment override
// rather than in the database because changing it needs no migration and
// no deploy: set BOOKING_URL in Vercel and both emails follow.
// ─────────────────────────────────────────────────────────────

const FALLBACK = "https://calendar.app.google/UAsdV1EzyLyxAm338";

export function bookingUrl(): string {
  const configured = process.env.BOOKING_URL?.trim();
  // A half-set variable is worse than none: anything that isn't a URL
  // would go out in an email as literal text.
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  return FALLBACK;
}
