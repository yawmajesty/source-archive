export const dynamic = "force-dynamic";

import { getStorageReport } from "./actions";
import { StorageClient } from "./StorageClient";

export const metadata = { title: "Storage — Source[Archive]" };

export default async function StoragePage() {
  const report = await getStorageReport();
  return <StorageClient report={report} />;
}
