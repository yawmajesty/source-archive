import { getLeads } from "@/lib/data";
import { LeadsClient } from "./LeadsClient";

export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsClient leads={leads} />;
}
