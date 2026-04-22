import { getClients, getProjects, getProducts } from "@/lib/data";
import { ClientsListClient } from "./ClientsListClient";

export default async function ClientsPage() {
  const [clients, projects, products] = await Promise.all([
    getClients(),
    getProjects(),
    getProducts(),
  ]);
  return <ClientsListClient clients={clients} projects={projects} products={products} />;
}
