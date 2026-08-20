export const dynamic = "force-dynamic";

import { listFabrics } from "./actions";
import { getAgencyContext } from "@/lib/agency-data";
import { FabricsClient } from "./FabricsClient";
import type { Fabric } from "@/lib/fabrics";

export default async function FabricsPage() {
  const ctx = await getAgencyContext();
  let fabrics: Fabric[] = [];
  try { fabrics = await listFabrics(); } catch { fabrics = []; }

  return (
    <FabricsClient
      fabrics={fabrics}
      canPublish={ctx?.role === "admin" || ctx?.role === "team"}
    />
  );
}
