// ─────────────────────────────────────────────────────────────
// Per-member capabilities.
//
// Role says what someone broadly is; permissions say what they may do.
// A studio machinist sampling with a manufacturer needs to move products
// between stages; a freelance pattern cutter may not. Both are makers.
//
// Admins implicitly have everything. Everyone else has exactly what an
// admin has granted, and the database enforces it too —
// has_agency_permission() in migration 014, plus a trigger on products.stage.
// ─────────────────────────────────────────────────────────────

import type { AgencyRole } from "./agency-data";

export type Capability =
  | "stage.change"
  | "log.write"
  | "log.release"
  | "fabric.edit"
  | "product.edit"
  | "cost.view";

export const CAPABILITIES: { id: Capability; label: string; hint: string }[] = [
  { id: "stage.change", label: "Move products between stages", hint: "Brief → Sourcing → Sampling, and so on. Every move is recorded and shown to the client." },
  { id: "log.write",    label: "Write production log entries", hint: "Record daily work with photos. Stays internal until released." },
  { id: "log.release",  label: "Release log entries to clients", hint: "Decide which workshop updates the client sees." },
  { id: "fabric.edit",  label: "Edit the fabric library",       hint: "Add and update fabrics, photos and specs." },
  { id: "product.edit", label: "Edit product details",          hint: "Names, specs, quantities and files." },
  { id: "cost.view",    label: "See costing",                   hint: "Unit costs, margins and supplier pricing. Grant sparingly." },
];

/** Sensible starting points when someone is added; an admin can adjust after. */
export const ROLE_DEFAULTS: Record<AgencyRole, Capability[]> = {
  admin: [],                                  // admins bypass the check entirely
  team: ["stage.change", "log.write", "log.release", "fabric.edit", "product.edit", "cost.view"],
  maker: ["log.write"],                       // deliberately minimal; stage.change is granted per person
};

export const ROLE_LABEL: Record<AgencyRole, string> = {
  admin: "Admin",
  team: "Team",
  maker: "Workshop",
};

export const ROLE_HINT: Record<AgencyRole, string> = {
  admin: "Full access, including billing and team management.",
  team: "Everything except team management and billing.",
  maker: "Workshop only — the production log, plus whatever you grant below.",
};

export function can(role: AgencyRole, permissions: string[] | null | undefined, capability: Capability): boolean {
  if (role === "admin") return true;
  return (permissions ?? []).includes(capability);
}
