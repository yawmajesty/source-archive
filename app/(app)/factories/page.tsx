export const dynamic = 'force-dynamic';

import { getFactories, getProducts, getRfqs, getProjects } from "@/lib/data";
import { FactoriesPageClient } from "./FactoriesPageClient";

export default async function FactoriesPage() {
  const [factories, products, rfqs, projects] = await Promise.all([
    getFactories(),
    getProducts(),
    getRfqs(),
    getProjects(),
  ]);

  return <FactoriesPageClient factories={factories} products={products} rfqs={rfqs} projects={projects} />;
}
