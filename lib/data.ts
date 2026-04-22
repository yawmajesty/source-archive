import { supabase } from "./supabase";
import type {
  Client, Project, Factory, Product, Sample, Milestone,
  Cost, Update, Task, Contract, PortalFile, Lead,
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
