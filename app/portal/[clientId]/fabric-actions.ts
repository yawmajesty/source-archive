"use server";

import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { resolvePortalAccess } from "@/app/(app)/clients/member-actions";

/**
 * The fabric library, as a client sees it.
 *
 * Two gates, both required: the client has to be switched on for library
 * access, and the fabric has to be published. Internal cost and mill
 * notes are never selected — not hidden in the UI, but never fetched, so
 * a change to the page cannot leak them.
 */
export interface PortalFabric {
  id: string;
  name: string;
  code: string | null;
  tier: string;
  category: string;
  composition: string | null;
  gsm: number | null;
  price_per_unit_usd: number | null;
  price_unit: string;
  moq: number | null;
  moq_unit: string;
  lead_time_days: number | null;
  stock_status: string;
  sustainability: string[];
  swatch_url: string | null;
  hand_feel: string | null;
}

export async function listPortalFabrics(clientId: string): Promise<{
  enabled: boolean;
  fabrics: PortalFabric[];
}> {
  try {
    const access = await resolvePortalAccess(clientId);
    if (!access.allowed) return { enabled: false, fabrics: [] };
  } catch {
    return { enabled: false, fabrics: [] };
  }

  const supabase = getAgencyServiceSupabase();
  const { data: client } = await supabase
    .from("clients").select("agency_id, fabric_library_enabled").eq("id", clientId).maybeSingle();
  const c = client as { agency_id: string; fabric_library_enabled: boolean | null } | null;
  if (!c?.fabric_library_enabled) return { enabled: false, fabrics: [] };

  const { data } = await supabase
    .from("fabrics")
    .select(
      "id, name, code, tier, category, composition, gsm, price_per_unit_usd, price_unit, " +
      "moq, moq_unit, lead_time_days, stock_status, sustainability, swatch_url, hand_feel",
    )
    .eq("agency_id", c.agency_id)
    .eq("is_published", true)
    .order("name");

  return { enabled: true, fabrics: (data ?? []) as unknown as PortalFabric[] };
}
