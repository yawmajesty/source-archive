// ─────────────────────────────────────────────────────────────
// Which prices a client can actually see.
//
// Deliberately NOT inside the "use server" action file next to it. Next.js
// only permits async function exports from such a module, so a constant
// declared there is silently dropped from the client bundle and the
// component importing it gets `undefined` at runtime — exactly the failure
// lib/stages.ts carries a comment about. Constants live here; the actions
// import them.
// ─────────────────────────────────────────────────────────────

/**
 * The price fields that reach the client's portal.
 *
 * target_cost_usd, internal_price_tiers and internal_composition_tiers are
 * deliberately absent: those are our numbers, and offering to email a
 * client about our own margin would be a very expensive mistake.
 */
export const CLIENT_PRICE_FIELDS = [
  "quoted_cost_usd",
  "client_unit_price_usd",
  "price_tiers",
  "composition_tiers",
] as const;

export type ClientPriceField = (typeof CLIENT_PRICE_FIELDS)[number];

/** In the client's language, not the column's. */
export const PRICE_FIELD_CLIENT_LABEL: Record<ClientPriceField, string> = {
  quoted_cost_usd: "Price per unit",
  client_unit_price_usd: "Price per unit",
  price_tiers: "Price by quantity",
  composition_tiers: "Price by composition",
};

export function isClientPriceField(value: unknown): value is ClientPriceField {
  return typeof value === "string" && (CLIENT_PRICE_FIELDS as readonly string[]).includes(value);
}

/** One line of "this moved from here to there", as the email prints it. */
export interface PriceChangeLine {
  label: string;
  before: string;
  after: string;
}

export interface PriceNoticeTarget {
  /** Whether there is anybody to tell at all. */
  canSend: boolean;
  reason: string | null;
  clientId: string | null;
  clientName: string | null;
  recipients: string[];
  productName: string;
  changes: PriceChangeLine[];
}

/**
 * Compare two values of a price field for "has this actually moved?".
 *
 * Tier arrays are compared by their contents, not by identity: re-saving
 * the same three tiers must not count as a change, or every visit to the
 * editor would offer to email the client.
 */
export function pricesDiffer(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return false;
  if (typeof a === "number" || typeof b === "number") return a !== b;
  return stable(a) !== stable(b);
}

function stable(value: unknown): string {
  if (value == null) return "";
  if (!Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(
    value.map((row) => {
      const r = row as Record<string, unknown>;
      return Object.keys(r).sort().map((k) => [k, r[k]]);
    }),
  );
}
