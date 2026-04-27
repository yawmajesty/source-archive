"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";

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
  await supabase.from("reference_samples").insert({
    ...data,
    client_images: [],
    agency_images: [],
    location: "agency",
  });
  revalidatePath("/references");
}
