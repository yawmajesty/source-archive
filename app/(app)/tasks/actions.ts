"use server";

import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export async function createTask(input: {
  project_id: string;
  product_id: string | null;
  title: string;
  status: string;
  assigned_to: string;
  assigned_initials: string;
  due_date: string | null;
  notes: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("tasks").insert({
    agency_id: ctx.agency.id,
    id: "task-" + Date.now(),
    ...input,
  });
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks");
  return { success: true };
}

export async function completeTask(taskId: string): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function completeMilestone(milestoneId: string): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("milestones")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", milestoneId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}
