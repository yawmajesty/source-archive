"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

export async function updateReferenceSample(id: string, patch: Record<string, unknown>): Promise<void> {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  const supabase = await getAgencySupabase();
  await supabase.from("reference_samples").update(patch).eq("id", id);
  revalidatePath("/references");
}

export async function listProductsForClient(clientId: string): Promise<Array<{ id: string; name: string }>> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("products")
    .select("id, name, projects!inner(client_id)")
    .eq("projects.client_id", clientId);
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name }));
}

export async function createReferenceSample(data: {
  client_id: string;
  product_id: string | null;
  item_description: string;
  brand: string | null;
  size: string | null;
  reference_for: string[];
  reference_for_other: string | null;
  courier: string | null;
  tracking_number: string | null;
  expected_arrival_date: string | null;
  client_notes: string | null;
  status: string;
}) {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  const supabase = await getAgencySupabase();
  await supabase.from("reference_samples").insert({
    agency_id: ctx.agency.id,
    ...data,
    client_images: [],
    agency_images: [],
    location: "agency",
  });
  revalidatePath("/references");
}
