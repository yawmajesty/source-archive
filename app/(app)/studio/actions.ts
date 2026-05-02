"use server";

import Anthropic from "@anthropic-ai/sdk";
import { supabaseData as supabase } from "@/lib/supabase-data";
import { revalidatePath } from "next/cache";

// ── AI receipt analysis ───────────────────────────────────────
export async function analyzeReceipt(base64: string, mediaType: string): Promise<{
  amount: number | null;
  currency: string | null;
  vendor: string | null;
  date: string | null;
  description: string;
  suggested_category: string;
  clarifying_question: string;
} | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const client = new Anthropic({ apiKey: key });
  const res = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: base64 },
        },
        {
          type: "text",
          text: `You are analyzing a receipt, payment screenshot, or expense document (may be in Chinese, English, or any language). Extract details and return ONLY valid JSON with no markdown or explanation:
{
  "amount": number or null,
  "currency": "CNY" or "USD" or "EUR" or "GBP" or "HKD" or "JPY" or null,
  "vendor": string or null,
  "date": "YYYY-MM-DD" or null,
  "description": "brief description of what was purchased/paid for",
  "suggested_category": one of: "meals" "transport" "accommodation" "samples" "materials" "shipping" "photography" "studio" "duties" "software" "other",
  "clarifying_question": "one short specific question to clarify this transaction for bookkeeping, e.g. Was this a business meal or personal?"
}`,
        },
      ],
    }],
  });

  try {
    const text = (res.content[0] as any).text.trim();
    const json = text.startsWith("{") ? text : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Expenses ──────────────────────────────────────────────────
export async function createExpense(data: {
  date: string;
  description: string;
  vendor: string | null;
  amount: number;
  currency: string;
  category: string;
  project_tag: string | null;
  image_url: string | null;
  notes: string | null;
}) {
  await supabase.from("brand_expenses").insert(data);
  revalidatePath("/studio");
}

export async function updateExpense(id: string, data: Partial<{
  date: string; description: string; vendor: string | null; amount: number;
  currency: string; category: string; project_tag: string | null; notes: string | null;
}>) {
  await supabase.from("brand_expenses").update(data).eq("id", id);
  revalidatePath("/studio");
}

export async function deleteExpense(id: string) {
  await supabase.from("brand_expenses").delete().eq("id", id);
  revalidatePath("/studio");
}

// ── Costing products ──────────────────────────────────────────
export async function createCostingProduct(data: {
  name: string;
  product_type: string | null;
  project_tag: string | null;
  base_currency: string;
  target_price: number | null;
  notes: string | null;
}): Promise<string> {
  const { data: row } = await supabase.from("brand_costing_products").insert(data).select("id").single();
  revalidatePath("/studio");
  return (row as any)?.id ?? "";
}

export async function updateCostingProduct(id: string, data: Partial<{
  name: string; product_type: string | null; project_tag: string | null;
  base_currency: string; target_price: number | null; notes: string | null;
}>) {
  await supabase.from("brand_costing_products").update(data).eq("id", id);
  revalidatePath("/studio");
}

export async function deleteCostingProduct(id: string) {
  await supabase.from("brand_costing_products").delete().eq("id", id);
  revalidatePath("/studio");
}

// ── Costing line items ────────────────────────────────────────
export async function createCostingItem(data: {
  product_id: string;
  description: string;
  category: string;
  quantity: number;
  unit_amount: number;
  currency: string;
}): Promise<string> {
  const { data: row } = await supabase.from("brand_costing_items").insert(data).select("id").single();
  revalidatePath("/studio");
  return (row as any)?.id ?? "";
}

export async function updateCostingItem(id: string, data: Partial<{
  description: string; category: string; quantity: number; unit_amount: number; currency: string;
}>) {
  await supabase.from("brand_costing_items").update(data).eq("id", id);
  revalidatePath("/studio");
}

export async function deleteCostingItem(id: string) {
  await supabase.from("brand_costing_items").delete().eq("id", id);
  revalidatePath("/studio");
}
