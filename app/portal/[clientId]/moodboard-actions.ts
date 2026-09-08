"use server";

import { revalidatePath } from "next/cache";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { resolvePortalAccess } from "@/app/(app)/clients/member-actions";
import type { Moodboard, MoodboardItem, MoodboardLink, LinkType, BlockKind, BlockContent } from "@/lib/moodboard";
import { LINK_TYPES, BLOCK_KINDS, DEFAULT_SIZE, defaultContent } from "@/lib/moodboard";
import { unfurl } from "@/lib/unfurl";

// ─────────────────────────────────────────────────────────────
// The portal has no Clerk session, so everything here runs through the
// service-role client and every call re-checks portal access for the
// client id it was given. These are Server Functions: reachable by
// direct POST, not only from our own UI, so the board id is never
// trusted on its own — it is always resolved back to a client and that
// client is what gets authorised.
// ─────────────────────────────────────────────────────────────

async function assertPortalAccess(clientId: string): Promise<boolean> {
  try {
    const access = await resolvePortalAccess(clientId);
    return access.allowed;
  } catch {
    return false;
  }
}

/** Resolve a board to its client, then authorise against that. */
async function boardClient(boardId: string): Promise<{ clientId: string; agencyId: string } | null> {
  const supabase = getAgencyServiceSupabase();
  const { data } = await supabase
    .from("moodboards")
    .select("client_id, agency_id")
    .eq("id", boardId)
    .maybeSingle();
  const row = data as { client_id: string; agency_id: string } | null;
  return row ? { clientId: row.client_id, agencyId: row.agency_id } : null;
}

export async function getOrCreateBoard(
  clientId: string,
): Promise<{ board: Moodboard; items: MoodboardItem[]; links: MoodboardLink[] } | null> {
  if (!(await assertPortalAccess(clientId))) return null;

  const supabase = getAgencyServiceSupabase();
  const { data: existing } = await supabase
    .from("moodboards")
    .select("id, client_id, title")
    .eq("client_id", clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  let board = existing as Moodboard | null;

  if (!board) {
    const { data: client } = await supabase
      .from("clients").select("agency_id").eq("id", clientId).maybeSingle();
    const agencyId = (client as { agency_id: string } | null)?.agency_id;
    if (!agencyId) return null;

    const { data: created } = await supabase
      .from("moodboards")
      .insert({ agency_id: agencyId, client_id: clientId, title: "Moodboard" })
      .select("id, client_id, title")
      .single();
    board = created as Moodboard;
  }
  if (!board) return null;

  const { data: items } = await supabase
    .from("moodboard_items").select("*").eq("board_id", board.id).order("z");

  const itemIds = ((items ?? []) as MoodboardItem[]).map((i) => i.id);
  const { data: links } = itemIds.length
    ? await supabase.from("moodboard_links").select("*").in("item_id", itemIds)
    : { data: [] };

  return {
    board,
    items: ((items ?? []) as MoodboardItem[]).map(numeric),
    links: (links ?? []) as MoodboardLink[],
  };
}

// Postgres NUMERIC arrives as a string; the canvas does arithmetic on
// these, and "12" + 5 is "125".
function numeric(item: MoodboardItem): MoodboardItem {
  return {
    ...item,
    kind: (item.kind ?? "image") as BlockKind,
    content: (item.content ?? {}) as BlockContent,
    x: Number(item.x),
    y: Number(item.y),
    width: Number(item.width),
    height: item.height == null ? null : Number(item.height),
    z: Number(item.z),
  };
}

export async function addItems(input: {
  boardId: string;
  items: Array<{ image_url: string; storage_path?: string | null; x: number; y: number; width: number; z: number }>;
  addedByName?: string | null;
}): Promise<{ success: true; items: MoodboardItem[] } | { success: false; error: string }> {
  const owner = await boardClient(input.boardId);
  if (!owner) return { success: false, error: "Board not found" };
  if (!(await assertPortalAccess(owner.clientId))) return { success: false, error: "Not allowed" };
  if (input.items.length === 0 || input.items.length > 60) {
    return { success: false, error: "Add between 1 and 60 images at a time" };
  }

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("moodboard_items")
    .insert(
      input.items.map((i) => ({
        agency_id: owner.agencyId,
        board_id: input.boardId,
        kind: "image",
        content: {},
        image_url: String(i.image_url).slice(0, 2000),
        storage_path: i.storage_path ?? null,
        x: i.x, y: i.y, width: i.width, z: i.z,
        added_by_name: input.addedByName?.slice(0, 120) ?? null,
      })),
    )
    .select();

  if (error) return { success: false, error: error.message };
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true, items: ((data ?? []) as MoodboardItem[]).map(numeric) };
}

export async function moveItem(input: {
  itemId: string;
  x: number;
  y: number;
  width?: number;
  z?: number;
}): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data: item } = await supabase
    .from("moodboard_items").select("board_id").eq("id", input.itemId).maybeSingle();
  const boardId = (item as { board_id: string } | null)?.board_id;
  if (!boardId) return { success: false };

  const owner = await boardClient(boardId);
  if (!owner || !(await assertPortalAccess(owner.clientId))) return { success: false };

  await supabase
    .from("moodboard_items")
    .update({
      x: input.x,
      y: input.y,
      ...(input.width != null ? { width: input.width } : {}),
      ...(input.z != null ? { z: input.z } : {}),
    })
    .eq("id", input.itemId);
  return { success: true };
}

export async function updateItem(input: {
  itemId: string;
  caption?: string | null;
  source_url?: string | null;
}): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data: item } = await supabase
    .from("moodboard_items").select("board_id").eq("id", input.itemId).maybeSingle();
  const boardId = (item as { board_id: string } | null)?.board_id;
  if (!boardId) return { success: false };
  const owner = await boardClient(boardId);
  if (!owner || !(await assertPortalAccess(owner.clientId))) return { success: false };

  await supabase
    .from("moodboard_items")
    .update({
      ...(input.caption !== undefined ? { caption: input.caption?.slice(0, 500) || null } : {}),
      ...(input.source_url !== undefined ? { source_url: input.source_url?.slice(0, 2000) || null } : {}),
    })
    .eq("id", input.itemId);
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true };
}

export async function removeItem(itemId: string): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data: item } = await supabase
    .from("moodboard_items").select("board_id, storage_path").eq("id", itemId).maybeSingle();
  const row = item as { board_id: string; storage_path: string | null } | null;
  if (!row) return { success: false };
  const owner = await boardClient(row.board_id);
  if (!owner || !(await assertPortalAccess(owner.clientId))) return { success: false };

  await supabase.from("moodboard_items").delete().eq("id", itemId);
  // Best effort: an orphaned object costs storage, a failed delete here
  // shouldn't leave the item on the board.
  if (row.storage_path) {
    try { await supabase.storage.from("moodboard-media").remove([row.storage_path]); } catch { /* ignore */ }
  }
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true };
}

/** Products the client can attach an image to. */
export async function listLinkableProducts(
  clientId: string,
): Promise<Array<{ id: string; name: string; project: string | null }>> {
  if (!(await assertPortalAccess(clientId))) return [];

  const supabase = getAgencyServiceSupabase();
  const { data: projects } = await supabase
    .from("projects").select("id, name").eq("client_id", clientId);
  const rows = (projects ?? []) as Array<{ id: string; name: string | null }>;
  if (rows.length === 0) return [];

  const names = new Map(rows.map((p) => [p.id, p.name]));
  const { data: products } = await supabase
    .from("products")
    .select("id, name, project_id")
    .in("project_id", rows.map((p) => p.id))
    .order("name");

  return ((products ?? []) as Array<{ id: string; name: string | null; project_id: string | null }>).map((p) => ({
    id: p.id,
    name: p.name ?? "Unnamed",
    project: p.project_id ? names.get(p.project_id) ?? null : null,
  }));
}

export async function linkItemToProduct(input: {
  itemId: string;
  productId: string;
  linkType: LinkType;
  note?: string | null;
}): Promise<{ success: true; link: MoodboardLink } | { success: false; error: string }> {
  if (!LINK_TYPES.some((t) => t.id === input.linkType)) {
    return { success: false, error: "Unknown link type" };
  }

  const supabase = getAgencyServiceSupabase();
  const { data: item } = await supabase
    .from("moodboard_items").select("board_id").eq("id", input.itemId).maybeSingle();
  const boardId = (item as { board_id: string } | null)?.board_id;
  if (!boardId) return { success: false, error: "Image not found" };

  const owner = await boardClient(boardId);
  if (!owner || !(await assertPortalAccess(owner.clientId))) {
    return { success: false, error: "Not allowed" };
  }

  // The product has to belong to this client — otherwise a crafted call
  // could pin a reference onto another brand's garment.
  const { data: product } = await supabase
    .from("products").select("project_id").eq("id", input.productId).maybeSingle();
  const projectId = (product as { project_id: string | null } | null)?.project_id;
  if (!projectId) return { success: false, error: "Product not found" };

  const { data: project } = await supabase
    .from("projects").select("client_id").eq("id", projectId).maybeSingle();
  if ((project as { client_id: string } | null)?.client_id !== owner.clientId) {
    return { success: false, error: "That product isn't yours" };
  }

  const { data, error } = await supabase
    .from("moodboard_links")
    .upsert(
      {
        agency_id: owner.agencyId,
        item_id: input.itemId,
        product_id: input.productId,
        link_type: input.linkType,
        note: input.note?.slice(0, 500) || null,
      },
      { onConflict: "item_id,product_id,link_type" },
    )
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not link" };
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true, link: data as MoodboardLink };
}

export async function unlinkItem(linkId: string): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data: link } = await supabase
    .from("moodboard_links").select("item_id").eq("id", linkId).maybeSingle();
  const itemId = (link as { item_id: string } | null)?.item_id;
  if (!itemId) return { success: false };

  const { data: item } = await supabase
    .from("moodboard_items").select("board_id").eq("id", itemId).maybeSingle();
  const boardId = (item as { board_id: string } | null)?.board_id;
  if (!boardId) return { success: false };
  const owner = await boardClient(boardId);
  if (!owner || !(await assertPortalAccess(owner.clientId))) return { success: false };

  await supabase.from("moodboard_links").delete().eq("id", linkId);
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true };
}


/**
 * Add a sticky note, heading, list or colour swatch.
 *
 * Content is not trusted as it arrives — kind decides the shape, and the
 * defaults are filled server-side, so a crafted payload can't store a
 * swatch that renders as something else.
 */
export async function addBlock(input: {
  boardId: string;
  kind: BlockKind;
  x: number;
  y: number;
  z: number;
  content?: BlockContent;
}): Promise<{ success: true; item: MoodboardItem } | { success: false; error: string }> {
  if (!BLOCK_KINDS.some((b) => b.id === input.kind)) {
    return { success: false, error: "Unknown block type" };
  }
  const owner = await boardClient(input.boardId);
  if (!owner) return { success: false, error: "Board not found" };
  if (!(await assertPortalAccess(owner.clientId))) return { success: false, error: "Not allowed" };

  const size = DEFAULT_SIZE[input.kind];
  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("moodboard_items")
    .insert({
      agency_id: owner.agencyId,
      board_id: input.boardId,
      kind: input.kind,
      content: { ...defaultContent(input.kind), ...(input.content ?? {}) },
      image_url: null,
      x: input.x, y: input.y,
      width: size.width, height: size.height,
      z: input.z,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not add" };
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true, item: numeric(data as MoodboardItem) };
}

/** Save the text, list or colour inside a block. */
export async function updateBlockContent(input: {
  itemId: string;
  content: BlockContent;
  height?: number | null;
}): Promise<{ success: boolean }> {
  const supabase = getAgencyServiceSupabase();
  const { data: item } = await supabase
    .from("moodboard_items").select("board_id").eq("id", input.itemId).maybeSingle();
  const boardId = (item as { board_id: string } | null)?.board_id;
  if (!boardId) return { success: false };
  const owner = await boardClient(boardId);
  if (!owner || !(await assertPortalAccess(owner.clientId))) return { success: false };

  await supabase
    .from("moodboard_items")
    .update({
      content: input.content,
      ...(input.height !== undefined ? { height: input.height } : {}),
    })
    .eq("id", input.itemId);
  return { success: true };
}


/**
 * Paste a link, get a card.
 *
 * The fetch happens here rather than in the browser: the board runs on a
 * page with no session, and letting a client's browser fetch arbitrary
 * URLs on our behalf is a different problem from letting our server do
 * it under the guards in lib/unfurl. A link that can't be read still
 * gets a card with its domain — an honest "we couldn't preview this"
 * beats a broken image that looks like a bug.
 */
export async function addLinkBlock(input: {
  boardId: string;
  url: string;
  x: number;
  y: number;
  z: number;
}): Promise<{ success: true; item: MoodboardItem } | { success: false; error: string }> {
  const owner = await boardClient(input.boardId);
  if (!owner) return { success: false, error: "Board not found" };
  if (!(await assertPortalAccess(owner.clientId))) return { success: false, error: "Not allowed" };

  const result = await unfurl(input.url);
  if ("error" in result) return { success: false, error: result.error };

  const supabase = getAgencyServiceSupabase();
  const { data, error } = await supabase
    .from("moodboard_items")
    .insert({
      agency_id: owner.agencyId,
      board_id: input.boardId,
      kind: "link",
      content: {
        url: result.url,
        provider: result.provider,
        title: result.title?.slice(0, 300) ?? null,
        description: result.description?.slice(0, 500) ?? null,
        thumbnail: result.thumbnail,
        authorName: result.authorName?.slice(0, 200) ?? null,
        // The player HTML is never rendered as markup — only the fact
        // that it exists is used, to show a play badge.
        embedHtml: null,
      },
      image_url: null,
      x: input.x, y: input.y,
      width: DEFAULT_SIZE.link.width, height: null,
      z: input.z,
    })
    .select()
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Could not add the link" };
  revalidatePath(`/portal/${owner.clientId}`);
  return { success: true, item: numeric(data as MoodboardItem) };
}
