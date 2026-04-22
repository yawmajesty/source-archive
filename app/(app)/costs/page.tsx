import { getCosts, getClients, getProjects, getProducts } from "@/lib/data";
import { CostsPageClient } from "./CostsPageClient";

export default async function CostsPage() {
  const [costs, clients, projects, products] = await Promise.all([
    getCosts(),
    getClients(),
    getProjects(),
    getProducts(),
  ]);

  return (
    <CostsPageClient
      costs={costs}
      clients={clients}
      projects={projects}
      products={products}
    />
  );
}
