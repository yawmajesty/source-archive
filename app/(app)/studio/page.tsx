import { supabaseData as supabase } from "@/lib/supabase-data";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const [{ data: expenses }, { data: products }, { data: items }] = await Promise.all([
    supabase.from("brand_expenses").select("*").order("date", { ascending: false }),
    supabase.from("brand_costing_products").select("*").order("created_at", { ascending: false }),
    supabase.from("brand_costing_items").select("*").order("created_at", { ascending: true }),
  ]);

  return (
    <StudioClient
      initialExpenses={(expenses ?? []) as any[]}
      initialProducts={(products ?? []) as any[]}
      initialItems={(items ?? []) as any[]}
    />
  );
}
