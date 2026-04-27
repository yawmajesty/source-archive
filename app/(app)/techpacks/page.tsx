import { getTechpackSubmissions } from "@/lib/data";
import { TechpacksClient } from "./TechpacksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tech Packs — Source[Archive]" };

export default async function TechpacksPage() {
  const submissions = await getTechpackSubmissions();
  return <TechpacksClient submissions={submissions} />;
}
