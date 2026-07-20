"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getBrandSupabase } from "@/lib/supabase-brand";
import { can, type Role, type WorkspaceMode } from "@/lib/mode-policy";
import { logActivity } from "@/lib/brand-activity";

interface Base {
  workspace_slug: string;
  mode: WorkspaceMode;
  role: Role;
}

export async function createSupplier(input: Base & {
  workspace_id: string;
  name: string;
  country?: string;
  city?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  specialties?: string[];
  quote_currency?: string;
  lead_time_notes?: string;
  notes?: string;
}): Promise<{ success: true; supplier_id: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "supplier.manage", input.mode)) {
    return { success: false, error: "You don't have permission to manage suppliers" };
  }
  if (!input.name.trim()) return { success: false, error: "Supplier name is required" };

  const supabase = await getBrandSupabase();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      workspace_id: input.workspace_id,
      name: input.name.trim(),
      country: input.country?.trim() || null,
      city: input.city?.trim() || null,
      contact_name: input.contact_name?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      specialties: input.specialties ?? [],
      quote_currency: input.quote_currency ?? "USD",
      lead_time_notes: input.lead_time_notes?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Failed to create supplier" };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "supplier.created",
    summary: `added supplier "${input.name.trim()}"`,
    targetType: "supplier",
    targetId: data.id,
  });

  revalidatePath(`/app/${input.workspace_slug}/suppliers`);
  return { success: true, supplier_id: data.id };
}

export async function updateSupplier(input: Base & {
  workspace_id: string;
  supplier_id: string;
  patch: Partial<{
    name: string;
    country: string | null;
    city: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    specialties: string[];
    quote_currency: string | null;
    lead_time_notes: string | null;
    notes: string | null;
  }>;
}): Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "supplier.manage", input.mode)) return { success: false, error: "You don't have permission" };

  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("suppliers").update(input.patch).eq("id", input.supplier_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "supplier.updated",
    summary: `updated supplier (${Object.keys(input.patch).join(", ")})`,
    targetType: "supplier",
    targetId: input.supplier_id,
    meta: { fields: Object.keys(input.patch) },
  });

  revalidatePath(`/app/${input.workspace_slug}/suppliers`);
  return { success: true };
}

export async function deleteSupplier(input: Base & { workspace_id: string; supplier_id: string })
  : Promise<{ success: true } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  if (!can(input.role, "supplier.manage", input.mode)) return { success: false, error: "You don't have permission" };

  const supabase = await getBrandSupabase();
  const { error } = await supabase.from("suppliers").delete().eq("id", input.supplier_id);
  if (error) return { success: false, error: error.message };

  await logActivity({
    workspaceId: input.workspace_id,
    actorId: userId,
    verb: "supplier.updated",
    summary: "removed a supplier",
    targetType: "supplier",
    targetId: null,
  });

  revalidatePath(`/app/${input.workspace_slug}/suppliers`);
  return { success: true };
}
