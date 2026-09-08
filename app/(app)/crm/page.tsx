import { listCrmClients } from "./actions";
import { CrmClient } from "./CrmClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "CRM — Source[Archive]" };

export default async function CrmPage() {
  const clients = await listCrmClients();
  return <CrmClient clients={clients} />;
}
