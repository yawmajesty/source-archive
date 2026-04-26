import { getReferenceSamples, getFactories } from "@/lib/data";
import { ReferencesClient } from "./ReferencesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "References — Source[Archive]" };

export default async function ReferencesPage() {
  const [samples, factories] = await Promise.all([
    getReferenceSamples(),
    getFactories(),
  ]);
  return <ReferencesClient samples={samples} factories={factories} />;
}
