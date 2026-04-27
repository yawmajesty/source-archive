import { getReferenceSamples, getFactories, getClients } from "@/lib/data";
import { ReferencesClient } from "./ReferencesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "References — Source[Archive]" };

export default async function ReferencesPage() {
  const [samples, factories, clients] = await Promise.all([
    getReferenceSamples(),
    getFactories(),
    getClients(),
  ]);
  return <ReferencesClient samples={samples} factories={factories} clients={clients} />;
}
