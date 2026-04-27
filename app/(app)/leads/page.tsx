import { getLeads } from "@/lib/data";
import { LeadsClient } from "./LeadsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads — Source[Archive]" };

export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsClient leads={leads} />;
}
