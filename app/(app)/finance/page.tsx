export const dynamic = "force-dynamic";

import { getFinanceReport } from "./actions";
import { FinanceClient } from "./FinanceClient";

export const metadata = { title: "Finance — Source[Archive]" };

export default async function FinancePage() {
  const report = await getFinanceReport();
  return <FinanceClient report={report} />;
}
