"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";

async function ctxOrThrow() {
  const ctx = await getAgencyContext();
  if (!ctx) throw new Error("Not a member of any agency");
  return ctx;
}

export interface AutoTags {
  auto_type: string;
  auto_category: string;
  auto_color: string;
  auto_fabric: string;
}

const TAG_SCHEMA = {
  type: "object" as const,
  properties: {
    product_type: {
      type: "string",
      description:
        "The specific product type as it would be named in a sourcing brief. " +
        "Examples: 't-shirt', 'oversized hoodie', 'cargo pants', 'denim jacket', 'tote bag', 'cap', 'sneakers'. " +
        "Lowercase. Keep it short.",
    },
    category: {
      type: "string",
      description:
        "Broad category. One of: 'apparel', 'outerwear', 'knitwear', 'denim', 'accessories', " +
        "'footwear', 'headwear', 'bags', 'jewelry', 'homeware', 'other'. Lowercase.",
    },
    color: {
      type: "string",
      description:
        "Primary visible colour or colour combination. " +
        "Examples: 'black', 'cream', 'washed indigo', 'sage green', 'multicolour print'. Lowercase.",
    },
    fabric: {
      type: "string",
      description:
        "Likely fabric or material based on the visual. " +
        "Examples: 'cotton jersey', 'heavyweight fleece', 'denim', 'wool blend', 'nylon', 'leather'. " +
        "Lowercase. If genuinely uncertain, say 'unknown'.",
    },
  },
  required: ["product_type", "category", "color", "fabric"],
};

export async function autoTagProduct(productId: string): Promise<
  { success: true; tags: AutoTags } | { success: false; error: string }
> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "ANTHROPIC_API_KEY is not set in the server environment." };
  }
  await ctxOrThrow();
  const supabase = await getAgencySupabase();

  const { data: product, error: fetchErr } = await supabase
    .from("products")
    .select("id, name, category, notes, images, documents, project_id")
    .eq("id", productId)
    .single();

  if (fetchErr || !product) {
    return { success: false, error: fetchErr?.message ?? "Product not found" };
  }

  const images = (product.images ?? []) as string[];
  const documents = (product.documents ?? []) as Array<{ filename?: string; url?: string }>;
  const hasText = !!(product.name || product.category || product.notes);
  if (images.length === 0 && documents.length === 0 && !hasText) {
    return { success: false, error: "Need a product name, image, or tech pack before auto-tagging." };
  }

  // Cap inputs to keep token usage predictable.
  const imageUrls = images.slice(0, 3);
  const pdfDocs = documents
    .filter((d) => !!d.url && /\.pdf($|\?)/i.test(d.filename ?? d.url ?? ""))
    .slice(0, 2);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent: Anthropic.MessageParam["content"] = [
    // PDFs first (tech packs tend to carry the richest construction detail)
    ...pdfDocs.map((d) => ({
      type: "document" as const,
      source: { type: "url" as const, url: d.url! },
    })),
    ...imageUrls.map((url) => ({
      type: "image" as const,
      source: { type: "url" as const, url },
    })),
    {
      type: "text" as const,
      text:
        `Tag this sourcing product. Weigh the product name, category, notes, attached tech packs, and images all equally — ` +
        `text and tech packs often carry fabric/weight/finish detail that a photo can't show (e.g. "heavyweight French terry hoodie · stone wash"). ` +
        `Use the images for what they show most clearly (silhouette, colour). ` +
        `When sources genuinely conflict, trust whichever is most specific (a tech pack BOM beats a guess from a photo).\n\n` +
        `Name: ${product.name || "(none)"}\n` +
        `Category: ${product.category || "(none)"}\n` +
        `Notes: ${product.notes || "(none)"}\n` +
        (pdfDocs.length > 0 ? `Tech packs attached: ${pdfDocs.map((d) => d.filename ?? "untitled.pdf").join(", ")}\n` : "") +
        `\nSubmit your tags via the submit_tags tool.`,
    },
  ];

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      tools: [
        {
          name: "submit_tags",
          description: "Submit the four product tags for this item.",
          input_schema: TAG_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: "submit_tags" },
      messages: [{ role: "user", content: userContent }],
    });
  } catch (e: any) {
    return { success: false, error: `Tagging request failed: ${e?.message ?? String(e)}` };
  }

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { success: false, error: "Model did not return structured tags." };
  }

  const input = toolUse.input as {
    product_type?: string;
    category?: string;
    color?: string;
    fabric?: string;
  };

  const tags: AutoTags = {
    auto_type: (input.product_type ?? "").trim().toLowerCase(),
    auto_category: (input.category ?? "").trim().toLowerCase(),
    auto_color: (input.color ?? "").trim().toLowerCase(),
    auto_fabric: (input.fabric ?? "").trim().toLowerCase(),
  };

  const { error: saveErr } = await supabase
    .from("products")
    .update({ ...tags, auto_tagged_at: new Date().toISOString() })
    .eq("id", productId);

  if (saveErr) {
    return { success: false, error: `Saved tags but DB update failed: ${saveErr.message}` };
  }

  revalidatePath(`/products/${productId}`);
  if (product.project_id) revalidatePath(`/projects/${product.project_id}`);
  return { success: true, tags };
}

export async function updateProductFields(
  productId: string,
  patch: Record<string, unknown>,
): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("products").update(patch).eq("id", productId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function deleteProductRow(productId: string): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/products");
  return { success: true };
}

export async function createSampleForProduct(input: {
  id: string;
  product_id: string;
  round: number;
  factory_notes?: string | null;
  courier: string;
  tracking_number: string;
  sent_date: string | null;
  received_date: string | null;
  feedback: string;
  approved_at: string | null;
  images: string[];
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("samples").insert({ agency_id: ctx.agency.id, ...input });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${input.product_id}`);
  return { success: true };
}

export async function updateProductImages(productId: string, images: string[]): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.rpc("update_product_images", { p_id: productId, p_images: images });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function updateProductDocuments(productId: string, documents: unknown[]): Promise<{ success: true } | { success: false; error: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.rpc("update_product_documents", { p_id: productId, p_documents: documents });
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function updateAutoTags(productId: string, tags: AutoTags): Promise<{ success: boolean; error?: string }> {
  await ctxOrThrow();
  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("products").update(tags).eq("id", productId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/products/${productId}`);
  return { success: true };
}
