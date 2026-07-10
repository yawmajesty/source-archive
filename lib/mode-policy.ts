// ─────────────────────────────────────────────────────────────
// Mode-aware permission map.
//
// The single source of truth for "who can do what" across managed and
// independent workspaces. Every permission check in the brand dashboard
// goes through can(). NEVER add ad-hoc `if (workspace.mode === 'managed')`
// checks in components — extend the matrix instead. This is what makes
// flipping to SaaS-only, or opening new roles, a small change instead of
// a hunt across the codebase.
// ─────────────────────────────────────────────────────────────

export type WorkspaceMode = "managed" | "independent";

export type Role =
  | "sa_admin"      // Source Archive team lead — full access to all managed workspaces
  | "sa_team"       // Source Archive team member — collaborates in managed workspaces
  | "brand_owner"   // The brand's account owner — full workspace control
  | "brand_member"; // Brand teammate — most actions, no billing / member management

export type Action =
  // Workspace
  | "workspace.update"
  | "workspace.delete"
  | "workspace.settings.view"
  // Members
  | "member.invite"
  | "member.remove"
  | "member.role.change"
  // Collections
  | "collection.create"
  | "collection.update"
  | "collection.delete"
  // Products
  | "product.create"
  | "product.update"
  | "product.delete"
  | "product.stage.change"
  | "product.duplicate"
  // Sample rounds
  | "sample.create"
  | "sample.status.change"
  | "sample.comment"
  | "sample.upload_photo"
  // Costing
  | "cost.view"
  | "cost.edit"
  | "cost.quote_add"        // SA team quotes a cost in managed mode
  // Suppliers
  | "supplier.manage"
  // Files
  | "file.upload"
  | "file.delete"
  // Comments / activity
  | "comment.create"
  | "activity.view"
  // Billing (independent only)
  | "billing.manage"
  | "billing.view";

// Matrix keyed by (action, mode) → list of roles that may perform it.
// A role not present means "denied" for that (action, mode) combination.
// In independent mode, sa_* roles are structurally not members, so they
// still can't perform anything even if listed — kept blank for clarity.
type Matrix = Record<Action, Record<WorkspaceMode, Role[]>>;

const MATRIX: Matrix = {
  // ─ Workspace ─
  "workspace.update":         { managed: ["sa_admin", "brand_owner"],                          independent: ["brand_owner"] },
  "workspace.delete":         { managed: ["sa_admin"],                                         independent: ["brand_owner"] },
  "workspace.settings.view":  { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },

  // ─ Members ─
  "member.invite":            { managed: ["sa_admin", "brand_owner"],                          independent: ["brand_owner"] },
  "member.remove":            { managed: ["sa_admin", "brand_owner"],                          independent: ["brand_owner"] },
  "member.role.change":       { managed: ["sa_admin"],                                         independent: ["brand_owner"] },

  // ─ Collections ─
  "collection.create":        { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "collection.update":        { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "collection.delete":        { managed: ["sa_admin", "brand_owner"],                          independent: ["brand_owner"] },

  // ─ Products ─
  "product.create":           { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "product.update":           { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "product.delete":           { managed: ["sa_admin", "brand_owner", "brand_member"],           independent: ["brand_owner", "brand_member"] },
  "product.stage.change":     { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "product.duplicate":        { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },

  // ─ Sample rounds ─
  "sample.create":            { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "sample.status.change":     { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "sample.comment":           { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "sample.upload_photo":      { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },

  // ─ Costing ─
  "cost.view":                { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "cost.edit":                { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "cost.quote_add":           { managed: ["sa_admin", "sa_team"],                                independent: [] },

  // ─ Suppliers ─
  // In managed mode the workspace's production partner is Source Archive,
  // so supplier management is unavailable to brand members by default; SA
  // team maintains any factory records that need to show up.
  "supplier.manage":          { managed: ["sa_admin", "sa_team"],                                independent: ["brand_owner", "brand_member"] },

  // ─ Files ─
  "file.upload":              { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "file.delete":              { managed: ["sa_admin", "brand_owner"],                            independent: ["brand_owner", "brand_member"] },

  // ─ Comments / activity ─
  "comment.create":           { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },
  "activity.view":            { managed: ["sa_admin", "sa_team", "brand_owner", "brand_member"], independent: ["brand_owner", "brand_member"] },

  // ─ Billing ─ (independent mode only; managed brands don't pay through the app)
  "billing.manage":           { managed: [],                                                     independent: ["brand_owner"] },
  "billing.view":             { managed: [],                                                     independent: ["brand_owner"] },
};

/**
 * Returns true if the given role can perform the action in the given workspace mode.
 * A null role always returns false — call sites should treat "no membership" as denied.
 */
export function can(role: Role | null | undefined, action: Action, mode: WorkspaceMode): boolean {
  if (!role) return false;
  return MATRIX[action][mode].includes(role);
}

/**
 * True if the role is a Source Archive team role. SA roles must never appear in
 * independent workspaces — enforce this both here and in the membership insert path.
 */
export function isSARole(role: Role | null | undefined): boolean {
  return role === "sa_admin" || role === "sa_team";
}

/**
 * True if the role is a brand-side role.
 */
export function isBrandRole(role: Role | null | undefined): boolean {
  return role === "brand_owner" || role === "brand_member";
}

/**
 * The set of roles that are legal for a given workspace mode.
 * Used at member-invite time to reject impossible role assignments.
 */
export function rolesFor(mode: WorkspaceMode): Role[] {
  if (mode === "managed") return ["sa_admin", "sa_team", "brand_owner", "brand_member"];
  return ["brand_owner", "brand_member"];
}
