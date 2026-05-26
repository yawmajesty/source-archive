export const dynamic = 'force-dynamic';

import { getFactories, getProducts, getRfqs } from "@/lib/data";
import { FactoriesPageClient } from "./FactoriesPageClient";

export default async function FactoriesPage() {
  const [factories, products, rfqs] = await Promise.all([
    getFactories(),
    getProducts(),
    getRfqs(),
  ]);

  return <FactoriesPageClient factories={factories} products={products} rfqs={rfqs} />;
}
