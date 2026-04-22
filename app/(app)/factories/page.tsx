export const dynamic = 'force-dynamic';

import { getFactories, getProducts } from "@/lib/data";
import { FactoriesPageClient } from "./FactoriesPageClient";

export default async function FactoriesPage() {
  const [factories, products] = await Promise.all([
    getFactories(),
    getProducts(),
  ]);

  return <FactoriesPageClient factories={factories} products={products} />;
}
