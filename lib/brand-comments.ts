import { getBrandSupabase } from "./supabase-brand";

export interface Comment {
  id: string;
  workspace_id: string;
  collection_id: string | null;
  product_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export async function listCommentsForCollection(collectionId: string): Promise<Comment[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("collection_id", collectionId)
    .is("product_id", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as Comment[];
}

export async function listCommentsForProduct(productId: string): Promise<Comment[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("comments")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Comment[];
}

/**
 * Resolve a set of Clerk user ids to display names. Falls back to id
 * fragments on failure so threads still render. Import lazily so the
 * data helpers don't drag Clerk into every server component.
 */
export async function resolveUserNames(userIds: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return {};
  const out: Record<string, string> = {};
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const users = await client.users.getUserList({ userId: unique, limit: 100 });
    users.data.forEach((u) => {
      const email = u.emailAddresses?.[0]?.emailAddress ?? "";
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
      out[u.id] = name || email || u.id.slice(0, 8);
    });
  } catch {
    // Best-effort: leave the map partial; renderers show id fragments.
  }
  for (const id of unique) if (!out[id]) out[id] = id.slice(0, 8);
  return out;
}
