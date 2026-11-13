"use server";

import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { sortTechpacks, type ClientTechpack } from "@/lib/client-overview";

/**
 * Every tech pack belonging to a client, newest version first.
 *
 * product_techpacks carries its own client_id, so this is one query
 * rather than a walk through the client's collections and their
 * products — which would also miss a pack whose product has since moved.
 */
export async function listClientTechpacks(clientId: string): Promise<ClientTechpack[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];

  const supabase = await getAgencySupabase();
  const { data, error } = await supabase
    .from("product_techpacks")
    .select("id, product_id, version, title, file_name, file_url, agency_signed_at, client_signed_at, superseded_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as Array<{
    id: string; product_id: string; version: number; title: string | null;
    file_name: string | null; file_url: string | null;
    agency_signed_at: string | null; client_signed_at: string | null;
    superseded_at: string | null; created_at: string;
  }>;
  if (rows.length === 0) return [];

  // One lookup for the products named, rather than one per pack.
  const ids = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean)));
  const { data: products } = await supabase.from("products").select("id, name").in("id", ids);
  const nameOf = new Map(
    ((products ?? []) as Array<{ id: string; name: string | null }>).map((p) => [p.id, p.name]),
  );

  return sortTechpacks(
    rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: nameOf.get(r.product_id) ?? null,
      version: r.version,
      title: r.title,
      fileName: r.file_name,
      fileUrl: r.file_url,
      agencySignedAt: r.agency_signed_at,
      clientSignedAt: r.client_signed_at,
      supersededAt: r.superseded_at,
      createdAt: r.created_at,
    })),
  );
}
