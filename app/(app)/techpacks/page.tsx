import { getTechpackSubmissions } from "@/lib/data";
import { getProductionBoard } from "./production-actions";
import { TechpacksShell } from "./TechpacksShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tech Packs — Source[Archive]" };

export default async function TechpacksPage() {
  const [submissions, board] = await Promise.all([
    getTechpackSubmissions(),
    getProductionBoard(),
  ]);
  return <TechpacksShell submissions={submissions} board={board} />;
}
