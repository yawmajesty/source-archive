"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

export interface WorkshopTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  product_id: string | null;
  project_id: string | null;
  notes: string | null;
}

/**
 * Tasks for the products this person can actually see. RLS already scopes
 * tasks by project, so a maker limited to one brand gets that brand's tasks
 * and nothing else — this just orders them usefully.
 */
export async function listWorkshopTasks(): Promise<WorkshopTask[]> {
  const ctx = await getAgencyContext();
  if (!ctx) return [];
  const supabase = await getAgencySupabase();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, due_date, product_id, project_id, notes")
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(50);
  return (data ?? []) as WorkshopTask[];
}

export async function completeTask(id: string): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not signed in" };
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/workshop");
  return { success: true };
}
