"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

// Legacy agency-role gate — kept as a helper so both saveAgencySettings
// and saveBrandSettings share it. Only agency `admin` members can edit
// their agency's settings.
async function requireAgencyAdmin() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  if (ctx.role !== "admin") throw new Error("Only admins can update settings");
  return ctx;
}

export async function updateUserRole(userId: string, role: "admin" | "team" | "maker" | "client") {
  // "client" is a legacy Clerk publicMetadata role from before agency
  // membership existed; there's no equivalent in the multi-tenant model.
  // Refuse it explicitly so callers get a clear error instead of a
  // CHECK-constraint violation from Postgres.
  if (role === "client") {
    throw new Error("The 'client' role is no longer supported for agency members");
  }
  const ctx = await requireAgencyAdmin();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_members")
    .update({ role })
    .eq("agency_id", ctx.agency.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
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
  const ctx = await requireAgencyAdmin();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_settings")
    .upsert({
      agency_id: ctx.agency.id,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "agency_id" });
  if (error) throw new Error(error.message);
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
  const ctx = await requireAgencyAdmin();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("agency_settings")
    .upsert({
      agency_id: ctx.agency.id,
      ...brand,
      updated_at: new Date().toISOString(),
    }, { onConflict: "agency_id" });
  if (error) throw new Error(error.message);
  // Revalidate the whole site so metadata / favicon changes propagate.
  revalidatePath("/", "layout");
}
