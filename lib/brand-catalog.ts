// Types + data helpers for collections and products in the brand
// dashboard. All queries go through the RLS-aware Supabase client so
// tenancy is enforced at the Postgres layer as defence-in-depth.

import { getBrandSupabase } from "./supabase-brand";

// ── Category taxonomy ─────────────────────────────────────────────
// The eight archive categories. Prefix codes are used in auto-style
// codes ("DNM-004") and colour tags across the UI.

export const CATEGORIES = [
  { key: "active_wear",     label: "Active Wear",     prefix: "ACT" },
  { key: "leather_jackets", label: "Leather Jackets", prefix: "LJK" },
  { key: "denim",           label: "Denim",           prefix: "DNM" },
  { key: "outerwear",       label: "Outerwear",       prefix: "OTR" },
  { key: "luxury_basics",   label: "Luxury Basics",   prefix: "LBX" },
  { key: "headwear",        label: "Headwear",        prefix: "HWR" },
  { key: "accessories",     label: "Accessories",     prefix: "ACC" },
  { key: "leather_bags",    label: "Leather Bags",    prefix: "LBG" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function categoryLabel(key: CategoryKey | string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function categoryPrefix(key: CategoryKey | string): string {
  return CATEGORIES.find((c) => c.key === key)?.prefix ?? "SKU";
}

// ── Lifecycle stages ──────────────────────────────────────────────

export const STAGES = [
  { key: "concept",                label: "Concept" },
  { key: "design",                 label: "Design" },
  { key: "tech_pack",              label: "Tech Pack" },
  { key: "sampling",               label: "Sampling" },
  { key: "approved_for_production",label: "Approved for Production" },
  { key: "in_production",          label: "In Production" },
  { key: "quality_check",          label: "Quality Check" },
  { key: "shipped",                label: "Shipped" },
  { key: "delivered",              label: "Delivered" },
] as const;

export type Stage = (typeof STAGES)[number]["key"];

export function stageLabel(key: Stage | string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

export function stageIndex(key: Stage | string): number {
  return STAGES.findIndex((s) => s.key === key);
}

// ── Types ─────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  workspace_id: string;
  name: string;
  season: string | null;
  description: string | null;
  cover_image_url: string | null;
  status: "planning" | "in_development" | "in_production" | "delivered" | "archived";
  base_currency: string;
  fx_rates: Record<string, number>; // { CNY: 0.14, EUR: 1.09, ... } — "1 unit of X in base currency"
  target_margin_pct: number;
  kickoff_date: string | null;
  sample_deadline: string | null;
  production_start: string | null;
  ex_factory_target: string | null;
  launch_date: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Colorway {
  name: string;
  hex: string | null;
  swatch_image_url: string | null;
}

export interface CostBreakdown {
  fabric?: number;
  trims?: number;
  labor?: number;
  wash_finish?: number;
  packaging?: number;
  freight_duty?: number;
  other?: number;
}

export interface Product {
  id: string;
  workspace_id: string;
  collection_id: string;
  name: string;
  style_code: string;
  category: CategoryKey;
  description: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  colorways: Colorway[];
  size_range: string[];
  target_quantity: number | null;
  stage: Stage;
  stage_entered_at: string;
  target_sample_date: string | null;
  target_delivery: string | null;
  // Spec notes (rich text, HTML string blobs for v1; can be structured later)
  spec_fabric: string | null;
  spec_trims: string | null;
  spec_wash: string | null;
  spec_customization: string | null;
  spec_packaging: string | null;
  // Costing — Phase 4
  estimated_cost: number | null;              // per-unit cost in cost_currency
  cost_currency: string | null;               // e.g. "CNY"
  cost_breakdown: CostBreakdown | null;       // optional itemised split
  sale_price_retail: number | null;           // per-unit retail (in collection base currency)
  sale_price_wholesale: number | null;        // per-unit wholesale (in collection base currency)
  created_at: string;
  updated_at: string;
}

export const COLLECTION_STATUSES: Array<{ key: Collection["status"]; label: string }> = [
  { key: "planning",       label: "Planning" },
  { key: "in_development", label: "In Development" },
  { key: "in_production",  label: "In Production" },
  { key: "delivered",      label: "Delivered" },
  { key: "archived",       label: "Archived" },
];

// ── Data helpers ──────────────────────────────────────────────────

export async function listCollections(workspaceId: string): Promise<Collection[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("collections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Collection[];
}

export async function getCollection(workspaceId: string, collectionId: string): Promise<Collection | null> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("collections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", collectionId)
    .maybeSingle();
  return (data as Collection | null) ?? null;
}

export async function listProducts(collectionId: string): Promise<Product[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("brand_products")
    .select("*")
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(normalizeProduct);
}

export async function getProduct(productId: string): Promise<Product | null> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("brand_products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  return data ? normalizeProduct(data) : null;
}

function normalizeProduct(row: any): Product {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    collection_id: row.collection_id,
    name: row.name,
    style_code: row.style_code,
    category: row.category,
    description: row.description,
    cover_image_url: row.cover_image_url,
    gallery_urls: (row.gallery_urls ?? []) as string[],
    colorways: (row.colorways ?? []) as Colorway[],
    size_range: (row.size_range ?? []) as string[],
    target_quantity: row.target_quantity,
    stage: row.stage,
    stage_entered_at: row.stage_entered_at,
    target_sample_date: row.target_sample_date,
    target_delivery: row.target_delivery,
    spec_fabric: row.spec_fabric,
    spec_trims: row.spec_trims,
    spec_wash: row.spec_wash,
    spec_customization: row.spec_customization,
    spec_packaging: row.spec_packaging,
    estimated_cost: row.estimated_cost != null ? Number(row.estimated_cost) : null,
    cost_currency: row.cost_currency,
    cost_breakdown: (row.cost_breakdown ?? null) as CostBreakdown | null,
    sale_price_retail: row.sale_price_retail != null ? Number(row.sale_price_retail) : null,
    sale_price_wholesale: row.sale_price_wholesale != null ? Number(row.sale_price_wholesale) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
