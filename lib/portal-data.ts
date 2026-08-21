// Public portal readers.
//
// The client portal at /portal/[clientId] is reachable by anyone with the
// URL — no Clerk auth. That means the standard agency-scoped data helpers
// in lib/data.ts (which need a Clerk JWT for RLS) can't be used here.
//
// These helpers use the service-role client to bypass RLS. Every function
// is scoped to a client_id resolved from the URL — nothing global — so
// even without RLS we can't leak across tenants as long as we always
// filter by client_id (or by ids that transitively belong to the client).

import { getAgencyServiceSupabase } from "./supabase-agency";
import type { ProductMediaItem } from "./product-media";
import type { ProductionLogEntry } from "./production-log";
import type {
  Client, Project, Product, Milestone, Update,
  Contract, PortalFile,
  AgencySettings, InvoiceLineItem, SavedInvoice,
} from "./data";

const AGENCY_SETTINGS_DEFAULTS: AgencySettings = {
  account_name: "", account_number: "", sort_code: "", swift_code: "",
  account_location: "", iban: "", bank_name: "", bank_address: "",
  account_created_on: "", invoice_terms: "",
  site_title: "Source[Archive]", site_tagline: "",
  site_description: "", icon_url: "", wordmark_url: "",
  favicon_url: "", og_image_url: "", google_verification: "",
};

export async function getPortalClient(clientId: string): Promise<Client | null> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  return (data as Client | null) ?? null;
}

export async function getPortalProjects(clientId: string): Promise<Project[]> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("projects").select("*").eq("client_id", clientId).order("created_at");
  return (data ?? []) as Project[];
}

export async function getPortalProducts(projectId: string): Promise<Product[]> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("products").select("*").eq("project_id", projectId).order("created_at");
  return (data ?? []) as Product[];
}

export async function getPortalMilestones(productId: string): Promise<Milestone[]> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("milestones").select("*").eq("product_id", productId).order("due_date");
  return (data ?? []) as Milestone[];
}

export async function getPortalUpdates(productId: string): Promise<Update[]> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("updates").select("*").eq("product_id", productId).order("created_at", { ascending: false });
  return (data ?? []) as Update[];
}

export async function getPortalContracts(clientId: string): Promise<Contract[]> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("contracts").select("*").eq("client_id", clientId).order("date", { ascending: false });
  return (data ?? []) as Contract[];
}

export async function getPortalFilesForClient(clientId: string): Promise<PortalFile[]> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase.from("portal_files").select("*").eq("client_id", clientId).order("uploaded_at", { ascending: false });
  return (data ?? []) as PortalFile[];
}

/**
 * Resolve the agency settings the portal should render — bank details,
 * branding, invoice terms. Looks up the client's owning agency and pulls
 * that agency's settings row. Falls back to defaults so the page always
 * renders even if a row is missing.
 */
export async function getPortalAgencySettings(clientId: string): Promise<AgencySettings> {
  const supabase = getAgencyServiceSupabase();
  const { data: clientRow } = await supabase.from("clients").select("agency_id").eq("id", clientId).maybeSingle();
  const agencyId = (clientRow as any)?.agency_id;
  if (!agencyId) return AGENCY_SETTINGS_DEFAULTS;
  const { data } = await supabase.from("agency_settings").select("*").eq("agency_id", agencyId).maybeSingle();
  const d = data as any;
  if (!d) return AGENCY_SETTINGS_DEFAULTS;
  return {
    account_name: d.account_name ?? "",
    account_number: d.account_number ?? "",
    sort_code: d.sort_code ?? "",
    swift_code: d.swift_code ?? "",
    account_location: d.account_location ?? "",
    iban: d.iban ?? "",
    bank_name: d.bank_name ?? "",
    bank_address: d.bank_address ?? "",
    account_created_on: d.account_created_on ?? "",
    invoice_terms: d.invoice_terms ?? "",
    site_title: d.site_title ?? AGENCY_SETTINGS_DEFAULTS.site_title,
    site_tagline: d.site_tagline ?? "",
    site_description: d.site_description ?? AGENCY_SETTINGS_DEFAULTS.site_description,
    icon_url: d.icon_url ?? "",
    wordmark_url: d.wordmark_url ?? "",
    favicon_url: d.favicon_url ?? "",
    og_image_url: d.og_image_url ?? "",
    google_verification: d.google_verification ?? "",
  };
}

export async function getPortalSamplingInvoices(clientId: string, drafts = false): Promise<SavedInvoice[]> {
  const supabase = getAgencyServiceSupabase();
  let q = supabase.from("sampling_invoices").select("*").eq("client_id", clientId).order("round", { ascending: true });
  if (!drafts) q = q.neq("status", "draft");
  const { data } = await q;
  return (data ?? []).map((r: any) => ({
    id: r.id, client_id: r.client_id, round: r.round, title: r.title,
    line_items: (r.line_items ?? []) as InvoiceLineItem[],
    notes: r.notes, status: r.status, created_at: r.created_at,
    invoice_kind: r.invoice_kind ?? "sampling",
    deposit_percent: r.deposit_percent ?? 100,
    stripe_session_id: r.stripe_session_id ?? null,
    stripe_payment_intent_id: r.stripe_payment_intent_id ?? null,
    paid_at: r.paid_at ?? null,
    parent_invoice_id: r.parent_invoice_id ?? null,
  }));
}

// ── Product media ────────────────────────────────────────────────
// One row per photo/video with attribution. Scoped by product_id, which
// belongs to a project, which belongs to the client in the URL.
export async function getPortalProductMedia(productId: string): Promise<ProductMediaItem[]> {
  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (!error) {
    // visible_to_client arrives with migration 012; filtering in JS rather
    // than in the query means this works before and after it is applied.
    return ((data ?? []) as ProductMediaItem[]).filter(
      (m) => (m as unknown as { visible_to_client?: boolean }).visible_to_client !== false,
    );
  }

  // product_media may not exist yet (migration 011 not applied). Fall back to
  // the legacy products.images array so the portal keeps showing photos
  // instead of going blank — attribution simply defaults to ours until the
  // migration runs.
  const { data: product } = await supabase
    .from("products")
    .select("id, images, created_at")
    .eq("id", productId)
    .maybeSingle();

  const urls: string[] = Array.isArray((product as any)?.images) ? (product as any).images : [];
  return urls.filter(Boolean).map((url, i) => ({
    id: `legacy-${productId}-${i}`,
    product_id: productId,
    url,
    kind: /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url) ? "video" : "image",
    uploaded_by_role: url.includes("/client-") ? "client" : "agency",
    uploaded_by_name: null,
    caption: null,
    created_at: (product as any)?.created_at ?? new Date(0).toISOString(),
  })) as ProductMediaItem[];
}

// ── Production log (released entries only) ───────────────────────
// The workshop diary. Clients only ever see entries the agency has
// explicitly released; unreleased work never leaves the backend.
export async function getPortalProductionLog(productId: string): Promise<ProductionLogEntry[]> {
  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("production_log_entries")
    .select("*")
    .eq("product_id", productId)
    .eq("visible_to_client", true)
    .order("work_date", { ascending: false });

  // Table absent until migration 012 is applied — the portal simply has no
  // diary to show yet.
  if (error) return [];
  return (data ?? []) as ProductionLogEntry[];
}

// ── Stage history ────────────────────────────────────────────────
// Every stage move is recorded with who moved it and why. These are factual
// progress rather than internal notes, so they reach the client by default —
// but the visible_to_client flag still governs, in case one needs pulling.
export interface PortalStageEvent {
  id: string;
  product_id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  changed_by_name: string | null;
  created_at: string;
}

export async function getPortalStageEvents(productId: string): Promise<PortalStageEvent[]> {
  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("product_stage_events")
    .select("id, product_id, from_stage, to_stage, note, changed_by_name, created_at")
    .eq("product_id", productId)
    .eq("visible_to_client", true)
    .order("created_at", { ascending: false });

  // Table absent until migration 014 is applied.
  if (error) return [];
  return (data ?? []) as PortalStageEvent[];
}
