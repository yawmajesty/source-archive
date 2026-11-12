import { getCosts, getClients, getProjects, getProducts } from "@/lib/data";
import { costsWithReceipts } from "./receipt-actions";
import { CostsPageClient } from "./CostsPageClient";

export default async function CostsPage() {
  const [costs, clients, projects, products, receiptCostIds] = await Promise.all([
    getCosts(),
    getClients(),
    getProjects(),
    getProducts(),
    // Which rows have a receipt, in one storage listing. Never fatal: a
    // storage hiccup should cost the paperclips, not the page.
    costsWithReceipts().catch(() => [] as string[]),
  ]);

  return (
    <CostsPageClient
      costs={costs}
      clients={clients}
      projects={projects}
      products={products}
      receiptCostIds={receiptCostIds}
    />
  );
}
