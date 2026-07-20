import { getAgencySupabase } from "./supabase-agency";
import type {
  Client, Project, Factory, Product, Sample, Milestone,
  Cost, Update, Task, Contract, PortalFile, Lead, Stage,
  Rfq, RfqInvite, RfqSubmission, RfqTier, RfqQuotedProduct,
  ProductPriceHistoryEntry,
} from "./mock-data";

export type {
  Client, Project, Factory, Product, Sample, Milestone,
  Cost, Update, Task, Contract, PortalFile, Lead,
  Rfq, RfqInvite, RfqSubmission, RfqTier, RfqQuotedProduct,
  ProductPriceHistoryEntry,
};

// ── Clients ────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("clients").select("*").order("created_at");
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("clients").select("*").eq("id", id).single();
  return (data ?? null) as Client | null;
}

// ── Projects ────────────────────────────────────────

export async function getProjects(clientId?: string): Promise<Project[]> {
  const supabase = await getAgencySupabase();
  let q = supabase.from("projects").select("*").order("created_at");
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  return (data ?? null) as Project | null;
}

// ── Factories ────────────────────────────────────────

export async function getFactories(): Promise<Factory[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("factories").select("*").order("name");
  return (data ?? []) as Factory[];
}

export async function getFactory(id: string): Promise<Factory | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("factories").select("*").eq("id", id).single();
  return (data ?? null) as Factory | null;
}

// ── Products ────────────────────────────────────────

export async function getProducts(projectId?: string): Promise<Product[]> {
  const supabase = await getAgencySupabase();
  let q = supabase.from("products").select("*").order("created_at");
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  return (data ?? []) as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("products").select("*").eq("id", id).single();
  return (data ?? null) as Product | null;
}

export async function getProductPriceHistory(productId: string): Promise<ProductPriceHistoryEntry[]> {
  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("product_price_history")
    .select("*")
    .eq("product_id", productId)
    .order("changed_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []) as ProductPriceHistoryEntry[];
}

// ── Samples ────────────────────────────────────────

export async function getSamples(productId: string): Promise<Sample[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("samples").select("*").eq("product_id", productId).order("round");
  return (data ?? []) as Sample[];
}

// ── Milestones ────────────────────────────────────────

export async function getMilestones(productId: string): Promise<Milestone[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("milestones").select("*").eq("product_id", productId).order("due_date");
  return (data ?? []) as Milestone[];
}

// ── Costs ────────────────────────────────────────

export async function getCosts(options?: { projectId?: string; productId?: string; includeDeleted?: boolean }): Promise<Cost[]> {
  const supabase = await getAgencySupabase();
  let q = supabase.from("costs").select("*").order("date_paid", { ascending: false });
  if (options?.projectId) q = q.eq("project_id", options.projectId);
  if (options?.productId) q = q.eq("product_id", options.productId);
  // Default: hide soft-deleted rows. Caller opts in to see them.
  if (!options?.includeDeleted) q = q.is("deleted_at", null);
  const { data } = await q;
  return (data ?? []) as Cost[];
}

// ── Updates ────────────────────────────────────────

export async function getUpdates(productId: string): Promise<Update[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("updates").select("*").eq("product_id", productId).order("created_at", { ascending: false });
  return (data ?? []) as Update[];
}

// ── Contracts ────────────────────────────────────────

export async function getContracts(clientId: string): Promise<Contract[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("contracts").select("*").eq("client_id", clientId).order("date", { ascending: false });
  return (data ?? []) as Contract[];
}

// ── Portal Files ────────────────────────────────────────

export async function getPortalFiles(clientId: string): Promise<PortalFile[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("portal_files").select("*").eq("client_id", clientId).order("uploaded_at", { ascending: false });
  return (data ?? []) as PortalFile[];
}

// ── Leads ────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Lead[];
}

// ── Tasks ────────────────────────────────────────

export async function getTasks(options?: { projectId?: string; productId?: string }): Promise<Task[]> {
  const supabase = await getAgencySupabase();
  let q = supabase.from("tasks").select("*").order("due_date");
  if (options?.projectId) q = q.eq("project_id", options.projectId);
  if (options?.productId) q = q.eq("product_id", options.productId);
  const { data } = await q;
  return (data ?? []) as Task[];
}

// ── Dashboard Stats ────────────────────────────────────────

export interface DashboardStats {
  activeProjects: number;
  productsInSampling: number;
  totalPipelineValue: number;
  overdueMilestones: number;
  pipelineHealthScore: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await getAgencySupabase();
  const now = new Date().toISOString();

  const [{ count: activeProjects }, { count: productsInSampling }, { data: allProducts }, { count: overdueMilestones }] =
    await Promise.all([
      supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("stage", "sampling"),
      supabase.from("products").select("moq, order_qty, quoted_cost_usd, target_cost_usd"),
      supabase.from("milestones").select("*", { count: "exact", head: true }).is("completed_at", null).lt("due_date", now.slice(0, 10)),
    ]);

  const totalPipelineValue = (allProducts ?? []).reduce((sum: number, p: any) => {
    const qty = p.order_qty ?? p.moq ?? 0;
    const cost = p.quoted_cost_usd ?? p.target_cost_usd ?? 0;
    return sum + qty * cost;
  }, 0);

  const od = overdueMilestones ?? 0;
  const healthScore = Math.max(0, Math.min(100, 100 - od * 8));

  return {
    activeProjects: activeProjects ?? 0,
    productsInSampling: productsInSampling ?? 0,
    totalPipelineValue: Math.round(totalPipelineValue),
    overdueMilestones: od,
    pipelineHealthScore: Math.round(healthScore),
  };
}

// ── Recent Activity ────────────────────────────────────────

export interface ActivityItem {
  id: string;
  product_id: string;
  product_name: string;
  client_name: string;
  author: string;
  author_initials: string;
  text: string;
  created_at: string;
}

export async function getRecentActivity(limit = 10): Promise<ActivityItem[]> {
  const supabase = await getAgencySupabase();
  const { data: updates } = await supabase
    .from("updates")
    .select("*, products(name, project_id, projects(client_id, clients(name)))")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (updates ?? []).map((u: any) => ({
    id: u.id,
    product_id: u.product_id,
    product_name: u.products?.name ?? "Unknown product",
    client_name: u.products?.projects?.clients?.name ?? "Unknown client",
    author: u.author,
    author_initials: u.author_initials,
    text: u.text,
    created_at: u.created_at,
  }));
}

// ── Client Summary ────────────────────────────────────────

export interface ClientSummary {
  client: Client;
  totalProducts: number;
  completedProducts: number;
  activeProjects: number;
}

export async function getClientSummaries(): Promise<ClientSummary[]> {
  const supabase = await getAgencySupabase();
  const clients = await getClients();
  const projects = await getProjects();
  const products = await getProducts();

  return clients.map((client) => {
    const clientProjects = projects.filter((p) => p.client_id === client.id);
    const projectIds = clientProjects.map((p) => p.id);
    const clientProducts = products.filter((p) => projectIds.includes(p.project_id));
    return {
      client,
      totalProducts: clientProducts.length,
      completedProducts: clientProducts.filter((p) => p.stage === "shipped").length,
      activeProjects: clientProjects.filter((p) => p.status === "active").length,
    };
  });
}

// ── Reference Samples ────────────────────────────────────────

export interface ReferenceSample {
  id: string;
  client_id: string;
  product_id: string | null;
  item_description: string;
  brand: string | null;
  reference_for: string[];
  reference_for_other: string | null;
  size: string | null;
  courier: string | null;
  tracking_number: string | null;
  expected_arrival_date: string | null;
  client_notes: string | null;
  client_images: string[];
  submitted_at: string;
  status: string;
  location: string;
  factory_id: string | null;
  received_date: string | null;
  condition_notes: string | null;
  agency_images: string[];
  internal_notes: string | null;
  assigned_to: string | null;
  return_tracking_number: string | null;
  created_at: string;
  client_name?: string;
  product_name?: string;
  factory_name?: string;
}

export async function getReferenceSamples(clientId?: string): Promise<ReferenceSample[]> {
  const supabase = await getAgencySupabase();
  let q = supabase
    .from("reference_samples")
    .select("*, clients(name), products(name), factories(name)")
    .order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []).map((r: any) => ({
    ...r,
    client_images: r.client_images ?? [],
    agency_images: r.agency_images ?? [],
    reference_for: r.reference_for ?? [],
    client_name: r.clients?.name ?? null,
    product_name: r.products?.name ?? null,
    factory_name: r.factories?.name ?? null,
  }));
}

// ── Agency Settings ────────────────────────────────────────

export interface AgencySettings {
  account_name: string;
  account_number: string;
  sort_code: string;
  swift_code: string;
  account_location: string;
  iban: string;
  bank_name: string;
  bank_address: string;
  account_created_on: string;
  invoice_terms: string;
  // Brand + SEO
  site_title: string;
  site_tagline: string;
  site_description: string;
  icon_url: string;
  wordmark_url: string;
  favicon_url: string;
  og_image_url: string;
  google_verification: string;
}

// Sensible defaults so the site keeps rendering even when the DB is empty.
const DEFAULT_SITE_TITLE = "Source[Archive]";
const DEFAULT_SITE_DESCRIPTION = "A sourcing agency helping brands build considered products with vetted factories.";

function blankAgencySettings(): AgencySettings {
  return {
    account_name: "",
    account_number: "",
    sort_code: "",
    swift_code: "",
    account_location: "",
    iban: "",
    bank_name: "",
    bank_address: "",
    account_created_on: "",
    invoice_terms: "",
    site_title: DEFAULT_SITE_TITLE,
    site_tagline: "",
    site_description: DEFAULT_SITE_DESCRIPTION,
    icon_url: "",
    wordmark_url: "",
    favicon_url: "",
    og_image_url: "",
    google_verification: "",
  };
}

export async function getAgencySettings(): Promise<AgencySettings> {
  const supabase = await getAgencySupabase();
  const { getCurrentAgencyId } = await import("./agency-data");
  const agencyId = await getCurrentAgencyId();
  // Signed-out / no agency yet → return defaults so the root layout
  // still renders metadata for public routes (marketing, sign-in).
  if (!agencyId) {
    return blankAgencySettings();
  }
  const { data } = await supabase
    .from("agency_settings")
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle();
  const d = data as any;
  return {
    account_name: d?.account_name ?? "",
    account_number: d?.account_number ?? "",
    sort_code: d?.sort_code ?? "",
    swift_code: d?.swift_code ?? "",
    account_location: d?.account_location ?? "",
    iban: d?.iban ?? "",
    bank_name: d?.bank_name ?? "",
    bank_address: d?.bank_address ?? "",
    account_created_on: d?.account_created_on ?? "",
    invoice_terms: d?.invoice_terms ?? "",
    site_title: d?.site_title ?? DEFAULT_SITE_TITLE,
    site_tagline: d?.site_tagline ?? "",
    site_description: d?.site_description ?? DEFAULT_SITE_DESCRIPTION,
    icon_url: d?.icon_url ?? "",
    wordmark_url: d?.wordmark_url ?? "",
    favicon_url: d?.favicon_url ?? "",
    og_image_url: d?.og_image_url ?? "",
    google_verification: d?.google_verification ?? "",
  };
}

// ── Sampling Invoices ────────────────────────────────────────

export interface InvoiceLineItem {
  name: string;
  category: string | null;
  project_name: string | null;
  amount_usd: number;
  expected_date: string | null;
  kind?: "product" | "service";
  qty?: number | null;
  unit_price_usd?: number | null;
  image_url?: string | null;
}

export interface SavedInvoice {
  id: string;
  client_id: string;
  round: number;
  title: string | null;
  line_items: InvoiceLineItem[];
  notes: string | null;
  status: string; // draft | sent | paid
  created_at: string;
  invoice_kind?: "sampling" | "production" | null;
  deposit_percent?: number | null;
  paid_at?: string | null;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  parent_invoice_id?: string | null;
}

export async function getSamplingInvoices(clientId: string, includeDrafts = true): Promise<SavedInvoice[]> {
  const supabase = await getAgencySupabase();
  let q = supabase
    .from("sampling_invoices")
    .select("*")
    .eq("client_id", clientId)
    .order("round", { ascending: true });
  if (!includeDrafts) q = q.neq("status", "draft");
  const { data } = await q;
  return (data ?? []).map((r: any) => ({ ...r, line_items: r.line_items ?? [] }));
}

// ── Techpack Submissions ────────────────────────────────────────

export interface TechpackSubmission {
  id: string;
  contact_name: string;
  company_name: string;
  contact_email: string;
  phone: string | null;
  product_category: string;
  collection_name: string | null;
  launch_date: string | null;
  target_quantity: number | null;
  retail_price_point: string | null;
  product_description: string | null;
  aesthetic_feeling: string[];
  reference_urls: string[];
  competitor_urls: string[];
  fit_type: string[];
  measurements_known: boolean | null;
  measurements_notes: string | null;
  fabric_preference: string[];
  fabric_gsm: string | null;
  suggest_fabric: boolean;
  print_type: string[];
  print_placement: string[];
  artwork_urls: string[];
  wash_type: string[];
  wash_effect: string | null;
  zip_type: string | null;
  button_type: string | null;
  drawstring_type: string | null;
  hardware_finish: string | null;
  neck_label: string | null;
  additional_labels: string[];
  packaging: string | null;
  custom_pattern: boolean;
  multiple_panels: boolean;
  special_construction: boolean;
  custom_hardware: boolean;
  sampling_budget: string | null;
  target_unit_cost: string | null;
  quality_priority: string | null;
  understands_revisions: boolean;
  produced_before: boolean | null;
  ready_for_sampling: boolean | null;
  deposit_agreed: boolean;
  status: string;
  internal_notes: string | null;
  assigned_to: string | null;
  created_at: string;
}

const TECHPACK_ARRAY_FIELDS = [
  "aesthetic_feeling", "reference_urls", "competitor_urls", "fit_type",
  "fabric_preference", "print_type", "print_placement", "artwork_urls",
  "wash_type", "additional_labels",
] as const;

export async function getTechpackSubmissions(): Promise<TechpackSubmission[]> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("techpack_submissions")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => ({
    ...r,
    ...Object.fromEntries(TECHPACK_ARRAY_FIELDS.map((f) => [f, r[f] ?? []])),
  }));
}

export async function getTechpackSubmission(id: string): Promise<TechpackSubmission | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase.from("techpack_submissions").select("*").eq("id", id).single();
  if (!data) return null;
  const r = data as any;
  return {
    ...r,
    ...Object.fromEntries(TECHPACK_ARRAY_FIELDS.map((f) => [f, r[f] ?? []])),
  };
}

// ── Command Center / Dashboard V2 ────────────────────────────────────────

export interface CollectionProduct {
  product_id: string;
  product_name: string;
  product_stage: Stage;
  last_update_at: string | null;
  days_since_update: number | null;
  overdue_milestones: { id: string; title: string; due_date: string }[];
  next_milestone: { id: string; title: string; due_date: string } | null;
  urgency: number;
}

export interface CollectionActionItem {
  project_id: string;
  project_name: string;
  project_season: string;
  client_id: string;
  client_name: string;
  client_initial: string;
  products: CollectionProduct[];
  urgency: number;
  overdue_count: number;
  stalled_count: number;
}

export interface DashboardTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  project_id: string;
  project_name: string;
  client_name: string;
  assigned_initials: string;
  is_overdue: boolean;
}

export async function getDashboardCollections(): Promise<CollectionActionItem[]> {
  const supabase = await getAgencySupabase();
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const [
    { data: products },
    { data: projects },
    { data: clients },
    { data: milestones },
    { data: recentUpdates },
  ] = await Promise.all([
    supabase.from("products").select("id, name, stage, project_id").neq("stage", "shipped"),
    supabase.from("projects").select("id, name, client_id, season"),
    supabase.from("clients").select("id, name, logo_initial"),
    supabase.from("milestones").select("id, product_id, title, due_date").is("completed_at", null).order("due_date"),
    supabase.from("updates").select("product_id, created_at").order("created_at", { ascending: false }).limit(500),
  ]);

  const projectMap = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p]));
  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c]));

  const latestUpdate: Record<string, string> = {};
  for (const u of (recentUpdates ?? []) as any[]) {
    if (!latestUpdate[u.product_id]) latestUpdate[u.product_id] = u.created_at;
  }

  const milestonesByProduct: Record<string, { id: string; title: string; due_date: string }[]> = {};
  for (const m of (milestones ?? []) as any[]) {
    if (!milestonesByProduct[m.product_id]) milestonesByProduct[m.product_id] = [];
    milestonesByProduct[m.product_id].push({ id: m.id, title: m.title, due_date: m.due_date });
  }

  const byProject: Record<string, CollectionProduct[]> = {};

  for (const product of (products ?? []) as any[]) {
    const lastUpdateAt = latestUpdate[product.id] ?? null;
    const daysSinceUpdate = lastUpdateAt ? Math.floor((now - new Date(lastUpdateAt).getTime()) / 86400000) : null;
    const productMilestones = milestonesByProduct[product.id] ?? [];
    const overdue = productMilestones.filter((m) => m.due_date < today);
    const upcoming = productMilestones.filter((m) => m.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null;

    let urgency = 1;
    urgency += overdue.length * 10;
    if (daysSinceUpdate === null) urgency += 15;
    else if (daysSinceUpdate > 14) urgency += 12;
    else if (daysSinceUpdate > 7) urgency += 6;
    if (product.stage === "sampling") urgency += 4;
    else if (product.stage === "qc") urgency += 3;
    else if (product.stage === "production") urgency += 2;

    const cp: CollectionProduct = {
      product_id: product.id,
      product_name: product.name,
      product_stage: product.stage as Stage,
      last_update_at: lastUpdateAt,
      days_since_update: daysSinceUpdate,
      overdue_milestones: overdue,
      next_milestone: upcoming,
      urgency,
    };

    if (!byProject[product.project_id]) byProject[product.project_id] = [];
    byProject[product.project_id].push(cp);
  }

  return Object.entries(byProject)
    .map(([projectId, prods]) => {
      const project = projectMap[projectId];
      const client = project ? clientMap[project.client_id] : null;
      const sortedProds = [...prods].sort((a, b) => b.urgency - a.urgency);
      return {
        project_id: projectId,
        project_name: project?.name ?? "Unknown",
        project_season: project?.season ?? "",
        client_id: client?.id ?? "",
        client_name: client?.name ?? "",
        client_initial: client?.logo_initial ?? "?",
        products: sortedProds,
        urgency: Math.max(...prods.map((p) => p.urgency)),
        overdue_count: prods.reduce((s, p) => s + p.overdue_milestones.length, 0),
        stalled_count: prods.filter((p) => p.days_since_update === null || p.days_since_update > 7).length,
      } as CollectionActionItem;
    })
    .sort((a, b) => b.urgency - a.urgency);
}

export async function getDashboardTasks(): Promise<DashboardTask[]> {
  const supabase = await getAgencySupabase();
  const today = new Date().toISOString().slice(0, 10);
  const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  const [{ data: tasks }, { data: projects }, { data: clients }] = await Promise.all([
    supabase.from("tasks").select("*").neq("status", "done").order("due_date"),
    supabase.from("projects").select("id, name, client_id"),
    supabase.from("clients").select("id, name"),
  ]);

  const projectMap = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p]));
  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c]));

  return ((tasks ?? []) as any[])
    .filter((t) => !t.due_date || t.due_date <= inThreeDays)
    .map((t) => {
      const project = projectMap[t.project_id];
      const client = project ? clientMap[project.client_id] : null;
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        due_date: t.due_date ?? null,
        project_id: t.project_id,
        project_name: project?.name ?? "",
        client_name: client?.name ?? "",
        assigned_initials: t.assigned_initials,
        is_overdue: !!t.due_date && t.due_date < today,
      } as DashboardTask;
    });
}

// ── RFQs ────────────────────────────────────────

export async function getRfqs(): Promise<Rfq[]> {
  const supabase = await getAgencySupabase();
  try {
    const { data } = await supabase.from("rfqs").select("*").order("created_at", { ascending: false });
    return (data ?? []) as Rfq[];
  } catch {
    return [];
  }
}

export async function getRfqInvites(rfqId: string): Promise<Array<RfqInvite & { factory_name: string; factory_email: string }>> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("rfq_invites")
    .select("*, factories(name, contact_email)")
    .eq("rfq_id", rfqId)
    .order("created_at");
  return (data ?? []).map((row: any) => ({
    ...row,
    factory_name: row.factories?.name ?? "Unknown",
    factory_email: row.factories?.contact_email ?? "",
    factories: undefined,
  }));
}

export async function getRfqByToken(token: string): Promise<{
  rfq: Rfq;
  invite: RfqInvite;
  factoryName: string;
} | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("rfq_invites")
    .select("*, rfqs(*), factories(name)")
    .eq("token", token)
    .maybeSingle();
  if (!data || !data.rfqs) return null;
  return {
    rfq: data.rfqs as Rfq,
    invite: { id: data.id, rfq_id: data.rfq_id, factory_id: data.factory_id, token: data.token, viewed_at: data.viewed_at, submitted_at: data.submitted_at, created_at: data.created_at },
    factoryName: (data.factories as any)?.name ?? "Your factory",
  };
}

export async function getRfqSubmissions(rfqId: string): Promise<Array<{
  submission: RfqSubmission;
  tiers: RfqTier[];
  factory_name: string;
}>> {
  const supabase = await getAgencySupabase();
  const { data: invites } = await supabase
    .from("rfq_invites")
    .select("id, factories(name)")
    .eq("rfq_id", rfqId)
    .not("submitted_at", "is", null);

  if (!invites?.length) return [];

  const inviteIds = invites.map((i: any) => i.id);
  const { data: submissions } = await supabase
    .from("rfq_submissions")
    .select("*, rfq_tiers(*)")
    .in("rfq_invite_id", inviteIds);

  return (submissions ?? []).map((sub: any) => {
    const invite = (invites as any[]).find((i) => i.id === sub.rfq_invite_id);
    return {
      submission: { id: sub.id, rfq_invite_id: sub.rfq_invite_id, factory_name: sub.factory_name, notes: sub.notes, images: sub.images ?? [], submitted_at: sub.submitted_at },
      tiers: ((sub.rfq_tiers ?? []) as RfqTier[]).sort((a, b) => a.moq - b.moq),
      factory_name: (invite as any)?.factories?.name ?? sub.factory_name ?? "Unknown",
    };
  });
}

// ── Portal Activity ────────────────────────────────────────

export interface PortalVisitRow {
  id: string;
  client_id: string;
  session_id: string;
  path: string;
  visited_at: string;
  duration_ms: number | null;
}

export interface PortalActivity {
  totalVisits: number;
  uniqueSessions: number;
  totalTimeMs: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  topPaths: Array<{ path: string; visits: number; totalMs: number }>;
  recent: PortalVisitRow[];
  perDay: Array<{ date: string; visits: number }>;
}

export async function getPortalActivity(clientId: string): Promise<PortalActivity> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("portal_visits")
    .select("*")
    .eq("client_id", clientId)
    .order("visited_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as PortalVisitRow[];

  const byPath = new Map<string, { visits: number; totalMs: number }>();
  const sessions = new Set<string>();
  let totalTimeMs = 0;
  for (const r of rows) {
    sessions.add(r.session_id);
    totalTimeMs += r.duration_ms ?? 0;
    const cur = byPath.get(r.path) ?? { visits: 0, totalMs: 0 };
    cur.visits += 1;
    cur.totalMs += r.duration_ms ?? 0;
    byPath.set(r.path, cur);
  }

  const topPaths = Array.from(byPath.entries())
    .map(([path, v]) => ({ path, ...v }))
    .sort((a, b) => b.totalMs - a.totalMs || b.visits - a.visits);

  const perDayMap = new Map<string, number>();
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    perDayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const day = r.visited_at.slice(0, 10);
    if (perDayMap.has(day)) perDayMap.set(day, (perDayMap.get(day) ?? 0) + 1);
  }
  const perDay = Array.from(perDayMap.entries()).map(([date, visits]) => ({ date, visits }));

  return {
    totalVisits: rows.length,
    uniqueSessions: sessions.size,
    totalTimeMs,
    firstVisitAt: rows.length > 0 ? rows[rows.length - 1].visited_at : null,
    lastVisitAt: rows.length > 0 ? rows[0].visited_at : null,
    topPaths,
    recent: rows.slice(0, 15),
    perDay,
  };
}

export async function getExistingSubmission(inviteId: string): Promise<(RfqSubmission & { products: RfqQuotedProduct[] }) | null> {
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("rfq_submissions")
    .select("*, rfq_quoted_products(*)")
    .eq("rfq_invite_id", inviteId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id, rfq_invite_id: data.rfq_invite_id, factory_name: data.factory_name,
    notes: data.notes, images: data.images ?? [], submitted_at: data.submitted_at,
    products: ((data.rfq_quoted_products ?? []) as RfqQuotedProduct[]).sort((a, b) => a.sort_order - b.sort_order),
  };
}

// ── Helpers ────────────────────────────────────────

export async function getFactoryById(id: string | null): Promise<Factory | null> {
  const supabase = await getAgencySupabase();
  if (!id) return null;
  return getFactory(id);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = await getAgencySupabase();
  return getProject(id);
}

export async function getClientByProjectId(projectId: string): Promise<Client | null> {
  const supabase = await getAgencySupabase();
  const project = await getProject(projectId);
  if (!project) return null;
  return getClient(project.client_id);
}
