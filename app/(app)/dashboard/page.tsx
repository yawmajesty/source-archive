export const dynamic = "force-dynamic";

import { getCommandCentre } from "./command-actions";
import { CommandCentreClient } from "./CommandCentreClient";

export const metadata = { title: "Command Centre — Source[Archive]" };

export default async function DashboardPage() {
  const centre = await getCommandCentre();
  return <CommandCentreClient centre={centre} />;
}
