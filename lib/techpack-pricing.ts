// ─────────────────────────────────────────────────────────────
// What a tech pack costs.
//
// Tech packs are sold per garment at one of three prices, picked by how
// much drawing the garment takes. The price lives here, in one place, so
// the quote builder, the invoice and anything added later cannot drift
// apart — which is what happens when a number like 220 is typed into a
// component.
//
// The tier is chosen while the quote is being built and then written into
// the line item's name ("Boxy Tee — Tech pack (Technical)"). Nothing is
// stored against the product, deliberately: the invoice is the record of
// what was charged, and a tier remembered on the product would quietly
// disagree with an invoice sent last month.
//
// Pure helpers only — no "use server" here. A const exported from a
// "use server" file is dropped from the client bundle and arrives as
// undefined (see lib/stages.ts).
// ─────────────────────────────────────────────────────────────

export type TechpackTier = "simple" | "technical" | "advanced";

export interface TechpackTierMeta {
  tier: TechpackTier;
  label: string;
  /** US dollars, per tech pack. */
  price: number;
}

/** Cheapest first, which is also the order they are shown in. */
export const TECHPACK_TIERS: TechpackTierMeta[] = [
  { tier: "simple",    label: "Simple",    price: 150 },
  { tier: "technical", label: "Technical", price: 220 },
  { tier: "advanced",  label: "Advanced",  price: 310 },
];

/** What a product gets when it is ticked and nothing else is said. */
export const DEFAULT_TECHPACK_TIER: TechpackTier = "simple";

/** The kind written to sampling_invoices.invoice_kind for these quotes. */
export const TECHPACK_INVOICE_KIND = "techpack";

/** The title printed on the quote, the PDF and the client's email. */
export const TECHPACK_INVOICE_TITLE = "Tech Pack Quote";

export function techpackTierMeta(tier: TechpackTier): TechpackTierMeta {
  return TECHPACK_TIERS.find((t) => t.tier === tier) ?? TECHPACK_TIERS[0];
}

export function techpackPrice(tier: TechpackTier): number {
  return techpackTierMeta(tier).price;
}

export function isTechpackTier(value: unknown): value is TechpackTier {
  return typeof value === "string" && TECHPACK_TIERS.some((t) => t.tier === value);
}

export function isTechpackInvoice(kind: string | null | undefined): boolean {
  return kind === TECHPACK_INVOICE_KIND;
}

/**
 * How a tech pack reads on the invoice. The tier goes in the name because
 * a line item has nowhere else to put it, and a client who is charged $310
 * should be able to see which of the three they were charged for.
 */
export function techpackLineName(productName: string, tier: TechpackTier): string {
  return `${productName} — Tech pack (${techpackTierMeta(tier).label})`;
}
