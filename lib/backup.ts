// ─────────────────────────────────────────────────────────────
// Backups.
//
// An honest note about what this is: a JSON export of every row an
// agency owns, written to a private bucket and downloadable. It
// protects against the realistic failures — a bad migration, a
// mistaken delete, a table someone truncates — and it does NOT protect
// against losing the Supabase account itself, because it lives in the
// same account. The download button is the part that does; the
// scheduled copy is the part that happens without anyone remembering.
//
// Storage objects (images, PDFs) are not included. They are large and
// already replicated by the storage layer, and a backup nobody can
// afford to run is worse than a partial one that runs weekly.
// ─────────────────────────────────────────────────────────────

/** Tables scoped by agency_id, exported in full. */
export const AGENCY_TABLES = [
  "clients", "projects", "products", "product_media", "product_price_history",
  "product_stage_events", "production_log_entries", "costs", "tasks", "milestones",
  "updates", "leads", "factories", "fabrics", "fabric_media", "fabric_products",
  "reference_samples", "sampling_invoices", "contracts", "portal_files",
  "client_members", "client_contacts", "client_touchpoints", "agency_members",
  "agency_settings", "product_cost_sheets", "cost_sheet_lines",
  "moodboards", "moodboard_items", "moodboard_links",
  "shoots", "shoot_products", "shoot_shots", "shoot_references", "shoot_templates",
  "shoot_assets", "campaigns", "campaign_items",
  "product_briefs", "product_brief_media", "product_brief_replies",
  "email_messages", "techpack_submissions", "rfqs", "rfq_invites",
] as const;

export interface BackupResult {
  takenAt: string;
  agencyId: string;
  tables: Record<string, number>;
  rowTotal: number;
  /** Tables that couldn't be read, named rather than silently skipped. */
  failed: string[];
}

export interface BackupFile extends BackupResult {
  data: Record<string, unknown[]>;
}

export function backupFilename(agencyId: string, at = new Date()): string {
  const stamp = at.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${agencyId}/${stamp}.json`;
}

/** How big it got, in something a person can read. */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
