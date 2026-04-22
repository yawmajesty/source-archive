import { getProducts, getFactories, getClients, getProjects } from "@/lib/data";
import { AllProductsClient } from "./AllProductsClient";

export default async function AllProductsPage() {
  const [products, factories, clients, projects] = await Promise.all([
    getProducts(),
    getFactories(),
    getClients(),
    getProjects(),
  ]);

  return (
    <AllProductsClient
      products={products}
      factories={factories}
      clients={clients}
      projects={projects}
    />
  );
}
