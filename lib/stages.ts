// ─────────────────────────────────────────────────────────────
// Product stages — plain constants, deliberately NOT in a "use server" file.
//
// These previously lived alongside changeProductStage in stage-actions.ts,
// which carries the "use server" directive. Next.js only permits async
// function exports from such a module, so the constants were silently
// dropped from the client bundle: StageSelector mapped over `undefined` and
// the portal's Progress timeline threw on an undefined label map, taking the
// whole product view down with it. It compiled cleanly and failed only in the
// browser.
// ─────────────────────────────────────────────────────────────

export const PRODUCT_STAGES = [
  { id: "brief",      label: "Concept / design",  hint: "Working out what it is." },
  { id: "design",     label: "Design",            hint: "Drawing it up." },
  { id: "techpack",   label: "Tech pack",          hint: "Specification written, and signed by both sides." },
  { id: "pattern",    label: "Pattern making",    hint: "Drafting and correcting the pattern." },
  { id: "sampling",   label: "Sampling",          hint: "First sample being made." },
  { id: "review",     label: "Review",            hint: "With the client for comment." },
  { id: "revision",   label: "Revision sample",   hint: "Second round after feedback." },
  { id: "production", label: "Production",        hint: "In bulk production." },
  { id: "shipped",    label: "Item complete",     hint: "Finished and with the client." },
] as const;

export type ProductStageId = (typeof PRODUCT_STAGES)[number]["id"];

/** Covers legacy stored values too, so older products still render a label. */
export const STAGE_LABEL: Record<string, string> = {
  brief: "Concept / design",
  design: "Design",
  techpack: "Tech pack",
  pattern: "Pattern making",
  sourcing: "Sourcing",
  sampling: "Sampling",
  review: "Review",
  approved: "Approved",
  revision: "Revision sample",
  production: "Production",
  qc: "Quality check",
  shipped: "Item complete",
};

// ── Optional phases ──────────────────────────────────────────
//
// Some clients buy design and a tech pack; most do not. Putting both on
// every product would mean two dead steps on most timelines, and leaving
// them out means the work that matters most on the products that do have
// them has nowhere to live. So they are opt-in per product, and the
// timeline is assembled rather than fixed.

/** Stage ids that only appear when a product has asked for them. */
export const OPTIONAL_STAGES = {
  design: "needs_design",
  techpack: "needs_techpack",
} as const;

export type OptionalStageId = keyof typeof OPTIONAL_STAGES;

/**
 * The stages this particular product actually goes through.
 *
 * Pass the flags; get the canonical list with the opted-out phases removed,
 * in order. Everything that draws a timeline or offers a stage to move to
 * should go through here, so a product cannot be put into a phase it was
 * never signed up for.
 */
export function stagesForProduct(product: {
  needs_design?: boolean | null;
  needs_techpack?: boolean | null;
}): Array<{ id: string; label: string; hint: string }> {
  return PRODUCT_STAGES.filter((stage) => {
    if (stage.id === "design") return Boolean(product.needs_design);
    if (stage.id === "techpack") return Boolean(product.needs_techpack);
    return true;
  }).map((s) => ({ id: s.id, label: s.label, hint: s.hint }));
}

/**
 * Whether a product is allowed to move past its tech pack.
 *
 * The point of two signatures is that work downstream rests on them, so
 * this is the check that gives them weight. Nothing enforces it in the
 * database — a stage is just a string — so callers ask.
 */
export function techpackBlocks(
  product: { needs_techpack?: boolean | null },
  pack: { agency_signed_at?: string | null; client_signed_at?: string | null } | null,
  targetStage: string,
): string | null {
  if (!product.needs_techpack) return null;
  const downstream = ["pattern", "sampling", "review", "revision", "production", "shipped"];
  if (!downstream.includes(targetStage)) return null;
  if (!pack) return "This product needs a tech pack, and none has been uploaded yet.";
  if (!pack.agency_signed_at) return "The current tech pack hasn't been signed off on our side yet.";
  if (!pack.client_signed_at) return "The client hasn't signed off the current tech pack yet.";
  return null;
}
