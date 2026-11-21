"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import type { Update } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────
// Updates on a product.
//
// The composer in the product's right-hand column pushed the new update
// into React state and stopped there — no insert, no action, nothing.
// It looked like it had saved, because the update appeared in the list,
// and it was gone the moment the page was left. The same was true of the
// eye toggle beside each update: UpdateItem takes an onToggleVisibility
// prop and the product page never passed one, so releasing an update to
// a client changed an icon and nothing else.
//
// Both now go through here.
// ─────────────────────────────────────────────────────────────

/** "Sam Okafor" → "SO". Falls back to the first letter of anything. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.slice(0, 2).map((p) => p[0]).join("");
  return letters.toUpperCase();
}

/** Who to credit. Clerk holds the name; the database holds no copy. */
async function authorName(): Promise<string> {
  try {
    const user = await currentUser();
    if (!user) return "Team";
    const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
    const email = user.emailAddresses[0]?.emailAddress;
    if (email) return email.split("@")[0];
  } catch {
    // A Clerk outage should not stop an update being recorded.
  }
  return "Team";
}

/**
 * Releasing something to a client is an agency decision, not the
 * workshop's — but it is a capability, not a role. Sam is a maker with
 * log.release granted to him individually, and checking the role alone
 * would have refused the very person it was granted to.
 */
function canRelease(ctx: { role: string; permissions: string[] }): boolean {
  return can(ctx.role as never, ctx.permissions, "log.release");
}

export async function addProductUpdate(input: {
  product_id: string;
  text: string;
  visible_to_client?: boolean;
}): Promise<{ success: true; update: Update } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const text = input.text.trim();
  if (!text) return { success: false, error: "Write something first" };

  const visible = Boolean(input.visible_to_client) && canRelease(ctx);

  const supabase = await getAgencySupabase();

  // The product has to belong to this agency, and RLS is not the only
  // thing asked: a clear message beats a silent no-op, which is the bug
  // this whole file exists to fix.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.product_id)
    .maybeSingle();
  if (!product) return { success: false, error: "That product no longer exists." };

  const name = await authorName();
  const row = {
    id: `upd-${Date.now()}`,
    agency_id: ctx.agency.id,
    product_id: input.product_id,
    author: name,
    author_initials: initialsOf(name),
    author_role: "agency",
    text,
    visible_to_client: visible,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("updates").insert(row);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/products/${input.product_id}`);
  revalidatePath("/dashboard");

  return {
    success: true,
    update: {
      id: row.id,
      product_id: row.product_id,
      author: row.author,
      author_initials: row.author_initials,
      text: row.text,
      visible_to_client: row.visible_to_client,
      created_at: row.created_at,
    },
  };
}

export async function setUpdateVisibility(input: {
  id: string;
  product_id: string;
  visible: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!canRelease(ctx)) {
    return { success: false, error: "You don't have permission to show updates to a client" };
  }

  const supabase = await getAgencySupabase();
  const { error } = await supabase
    .from("updates")
    .update({ visible_to_client: input.visible })
    .eq("id", input.id);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/products/${input.product_id}`);
  revalidatePath(`/portal`);
  return { success: true };
}

export async function deleteProductUpdate(input: {
  id: string;
  product_id: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const supabase = await getAgencySupabase();
  const { error } = await supabase.from("updates").delete().eq("id", input.id);
  if (error) return { success: false, error: error.message };

  revalidatePath(`/products/${input.product_id}`);
  return { success: true };
}
