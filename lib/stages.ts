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
