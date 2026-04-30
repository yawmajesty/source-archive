"use server";

import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";
import type { InvoiceLineItem } from "@/lib/data";

export async function createSamplingInvoice(data: {
  client_id: string;
  round: number;
  title: string | null;
  line_items: InvoiceLineItem[];
  notes: string | null;
}): Promise<void> {
  await supabase.from("sampling_invoices").insert({ ...data, status: "draft" });
  revalidatePath(`/portal/${data.client_id}`);
}

export async function updateInvoiceStatus(id: string, clientId: string, status: string): Promise<void> {
  await supabase.from("sampling_invoices").update({ status }).eq("id", id);
  revalidatePath(`/portal/${clientId}`);
}

export async function deleteInvoice(id: string, clientId: string): Promise<void> {
  await supabase.from("sampling_invoices").delete().eq("id", id);
  revalidatePath(`/portal/${clientId}`);
}
