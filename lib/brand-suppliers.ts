import { getBrandSupabase } from "./supabase-brand";

export interface Supplier {
  id: string;
  workspace_id: string;
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
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export async function listSuppliers(workspaceId: string): Promise<Supplier[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  return (data ?? []).map(normalize);
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  return data ? normalize(data) : null;
}

function normalize(row: any): Supplier {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    country: row.country,
    city: row.city,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    specialties: (row.specialties ?? []) as string[],
    quote_currency: row.quote_currency,
    lead_time_notes: row.lead_time_notes,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}
