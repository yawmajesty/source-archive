import { listShoots, listCampaigns, listTemplates } from "./actions";
import { getClients, getProjects, getProducts } from "@/lib/data";
import { PlannerClient } from "./PlannerClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shoots & Marketing — Source[Archive]" };

export default async function PlannerPage() {
  const [shoots, campaigns, templates, clients, projects, products] = await Promise.all([
    listShoots(), listCampaigns(), listTemplates(),
    getClients(), getProjects(), getProducts(),
  ]);

  return (
    <PlannerClient
      shoots={shoots}
      campaigns={campaigns}
      templates={templates}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, client_id: p.client_id }))}
      products={products.map((p) => ({ id: p.id, name: p.name, project_id: p.project_id }))}
    />
  );
}
