"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { supabaseData } from "@/lib/supabase-data";

export async function updateUserRole(userId: string, role: "admin" | "team" | "client") {
  const { userId: callerId } = await auth();
  if (!callerId) throw new Error("Unauthenticated");

  const client = await clerkClient();
  const caller = await client.users.getUser(callerId);
  if (caller.publicMetadata?.role !== "admin") throw new Error("Only admins can change roles");

  await client.users.updateUserMetadata(userId, { publicMetadata: { role } });
  revalidatePath("/settings");
}

export async function saveAgencySettings(settings: {
  account_name: string;
  account_number: string;
  sort_code: string;
  swift_code: string;
  account_location: string;
  iban: string;
  bank_name: string;
  bank_address: string;
  account_created_on: string;
  invoice_terms: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const client = await clerkClient();
  const caller = await client.users.getUser(userId);
  if (caller.publicMetadata?.role !== "admin") throw new Error("Only admins can update agency settings");

  await supabaseData
    .from("agency_settings")
    .upsert({ id: "default", ...settings, updated_at: new Date().toISOString() });
  revalidatePath("/settings");
}

export async function saveBrandSettings(brand: {
  site_title: string;
  site_tagline: string;
  site_description: string;
  icon_url: string;
  wordmark_url: string;
  favicon_url: string;
  og_image_url: string;
  google_verification: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const client = await clerkClient();
  const caller = await client.users.getUser(userId);
  if (caller.publicMetadata?.role !== "admin") throw new Error("Only admins can update brand settings");

  await supabaseData
    .from("agency_settings")
    .upsert({ id: "default", ...brand, updated_at: new Date().toISOString() });
  // Revalidate the whole site so the new metadata/favicon takes effect everywhere.
  revalidatePath("/", "layout");
}
