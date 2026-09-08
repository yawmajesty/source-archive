export const dynamic = "force-dynamic";

import { getCommandCentre, recentHappenings } from "./command-actions";
import { CommandCentreClient } from "./CommandCentreClient";

export const metadata = { title: "Command Centre — Source[Archive]" };

export default async function DashboardPage() {
  const [centre, happenings] = await Promise.all([getCommandCentre(), recentHappenings()]);
  return <CommandCentreClient centre={centre} happenings={happenings} />;
}
