import { supabaseData as supabase } from "./supabase-data";
import type {
  Client, Project, Factory, Product, Sample, Milestone,
  Cost, Update, Task, Contract, PortalFile, Lead, Stage,
} from "./mock-data";

export type {
  Client, Project, Factory, Product, Sample, Milestone,
  Cost, Update, Task, Contract, PortalFile, Lead,
};

// ── Clients ────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const { data } = await supabase.from("clients").select("*").order("created_at");
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data } = await supabase.from("clients").select("*").eq("id", id).single();
  return (data ?? null) as Client | null;
}

// ── Projects ────────────────────────────────────────

export async function getProjects(clientId?: string): Promise<Project[]> {
  let q = supabase.from("projects").select("*").order("created_at");
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  return (data ?? null) as Project | null;
}

// ── Factories ────────────────────────────────────────

export async function getFactories(): Promise<Factory[]> {
  const { data } = await supabase.from("factories").select("*").order("name");
  return (data ?? []) as Factory[];
}

export async function getFactory(id: string): Promise<Factory | null> {
  const { data } = await supabase.from("factories").select("*").eq("id", id).single();
  return (data ?? null) as Factory | null;
}

// ── Products ────────────────────────────────────────

export async function getProducts(projectId?: string): Promise<Product[]> {
  let q = supabase.from("products").select("*").order("created_at");
  if (projectId) q = q.eq("project_id", projectId);
  const { data } = await q;
  return (data ?? []) as Product[];
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data } = await supabase.from("products").select("*").eq("id", id).single();
  return (data ?? null) as Product | null;
}

// ── Samples ────────────────────────────────────────

export async function getSamples(productId: string): Promise<Sample[]> {
  const { data } = await supabase.from("samples").select("*").eq("product_id", productId).order("round");
  return (data ?? []) as Sample[];
}

// ── Milestones ────────────────────────────────────────

export async function getMilestones(productId: string): Promise<Milestone[]> {
  const { data } = await supabase.from("milestones").select("*").eq("product_id", productId).order("due_date");
  return (data ?? []) as Milestone[];
}

// ── Costs ────────────────────────────────────────

export async function getCosts(options?: { projectId?: string; productId?: string }): Promise<Cost[]> {
  let q = supabase.from("costs").select("*").order("date_paid", { ascending: false });
  if (options?.projectId) q = q.eq("project_id", options.projectId);
  if (options?.productId) q = q.eq("product_id", options.productId);
  const { data } = await q;
  return (data ?? []) as Cost[];
}

// ── Updates ────────────────────────────────────────

export async function getUpdates(productId: string): Promise<Update[]> {
  const { data } = await supabase.from("updates").select("*").eq("product_id", productId).order("created_at", { ascending: false });
  return (data ?? []) as Update[];
}

// ── Contracts ────────────────────────────────────────

export async function getContracts(clientId: string): Promise<Contract[]> {
  const { data } = await supabase.from("contracts").select("*").eq("client_id", clientId).order("date", { ascending: false });
  return (data ?? []) as Contract[];
}

// ── Portal Files ────────────────────────────────────────

export async function getPortalFiles(clientId: string): Promise<PortalFile[]> {
  const { data } = await supabase.from("portal_files").select("*").eq("client_id", clientId).order("uploaded_at", { ascending: false });
  return (data ?? []) as PortalFile[];
}

// ── Leads ────────────────────────────────────────

export async function getLeads(): Promise<Lead[]> {
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Lead[];
}

// ── Tasks ────────────────────────────────────────

export async function getTasks(options?: { projectId?: string; productId?: string }): Promise<Task[]> {
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
}

export async function getAgencySettings(): Promise<AgencySettings> {
  const { data } = await supabase.from("agency_settings").select("*").eq("id", "default").single();
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
  };
}

// ── Sampling Invoices ────────────────────────────────────────

export interface InvoiceLineItem {
  name: string;
  category: string | null;
  project_name: string | null;
  amount_usd: number;
  expected_date: string | null;
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
}

export async function getSamplingInvoices(clientId: string): Promise<SavedInvoice[]> {
  const { data } = await supabase
    .from("sampling_invoices")
    .select("*")
    .eq("client_id", clientId)
    .order("round", { ascending: true });
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

// ── Helpers ────────────────────────────────────────

export async function getFactoryById(id: string | null): Promise<Factory | null> {
  if (!id) return null;
  return getFactory(id);
}

export async function getProjectById(id: string): Promise<Project | null> {
  return getProject(id);
}

export async function getClientByProjectId(projectId: string): Promise<Client | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  return getClient(project.client_id);
}
