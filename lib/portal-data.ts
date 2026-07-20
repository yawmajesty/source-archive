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
