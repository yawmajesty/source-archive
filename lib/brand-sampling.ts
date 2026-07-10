import { getBrandSupabase } from "./supabase-brand";

export type SampleStatus =
  | "requested"
  | "in_progress"
  | "shipped"
  | "received"
  | "under_review"
  | "approved"
  | "rejected_revise";

export const SAMPLE_STATUSES: Array<{ key: SampleStatus; label: string }> = [
  { key: "requested",       label: "Requested" },
  { key: "in_progress",     label: "In Progress" },
  { key: "shipped",         label: "Shipped" },
  { key: "received",        label: "Received" },
  { key: "under_review",    label: "Under Review" },
  { key: "approved",        label: "Approved" },
  { key: "rejected_revise", label: "Rejected – Revise" },
];

// Common labels — free-text so brands can override, but these speed up
// picking a new round.
export const SAMPLE_LABEL_SUGGESTIONS = [
  "Proto",
  "Sample 1",
  "Sample 2",
  "Sample 3",
  "PP Sample",
  "TOP",
] as const;

export function sampleStatusLabel(status: SampleStatus | string): string {
  return SAMPLE_STATUSES.find((s) => s.key === status)?.label ?? status;
}

export interface SampleRound {
  id: string;
  workspace_id: string;
  product_id: string;
  supplier_id: string | null;
  label: string;
  sort_order: number;
  status: SampleStatus;
  requested_at: string | null;
  eta_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  photo_urls: string[];
  revision_summary: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SampleComment {
  id: string;
  workspace_id: string;
  sample_round_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export async function listSampleRounds(productId: string): Promise<SampleRound[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("sample_rounds")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(normalize);
}

export async function listSampleComments(roundId: string): Promise<SampleComment[]> {
  const supabase = await getBrandSupabase();
  const { data } = await supabase
    .from("sample_round_comments")
    .select("*")
    .eq("sample_round_id", roundId)
    .order("created_at", { ascending: true });
  return (data ?? []) as SampleComment[];
}

function normalize(row: any): SampleRound {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    product_id: row.product_id,
    supplier_id: row.supplier_id,
    label: row.label,
    sort_order: row.sort_order,
    status: row.status,
    requested_at: row.requested_at,
    eta_at: row.eta_at,
    shipped_at: row.shipped_at,
    received_at: row.received_at,
    tracking_number: row.tracking_number,
    carrier: row.carrier,
    photo_urls: (row.photo_urls ?? []) as string[],
    revision_summary: row.revision_summary,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  };
}
