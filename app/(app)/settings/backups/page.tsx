import { listBackups } from "../backup-actions";
import { BackupsClient } from "./BackupsClient";
import { AGENCY_TABLES } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backups — Source[Archive]" };

export default async function BackupsPage() {
  const runs = await listBackups();
  return <BackupsClient runs={runs} tableCount={AGENCY_TABLES.length} />;
}
