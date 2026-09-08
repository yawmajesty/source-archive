export const dynamic = "force-dynamic";

import { listInvoices } from "./actions";
import { InvoicesClient } from "./InvoicesClient";

export const metadata = { title: "Invoices — Source[Archive]" };

export default async function InvoicesPage() {
  const invoices = await listInvoices();
  return <InvoicesClient invoices={invoices} />;
}
