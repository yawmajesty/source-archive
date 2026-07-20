"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function updateTechpackStatus(id: string, status: string): Promise<void> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("techpack_submissions").update({ status }).eq("id", id);
  revalidatePath("/techpacks");
}

export async function updateTechpackField(id: string, key: string, value: unknown): Promise<void> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  await supabase.from("techpack_submissions").update({ [key]: value }).eq("id", id);
  revalidatePath("/techpacks");
}
