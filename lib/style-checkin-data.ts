// ─────────────────────────────────────────────────────────────
// Reading the styles that are being made, out of the database.
//
// Kept out of the cron route so it can be run and inspected on its own:
// a route module may only export HTTP methods, which makes anything
// defined inside one impossible to test without sending the email it
// exists to send.
//
// Server-side only — it takes a service-role client — but deliberately
// not a "use server" file, since those may export nothing but async
// functions and this exports types and a constant too.
// ─────────────────────────────────────────────────────────────

import type { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { buildPublicUrl } from "@/lib/url";
import type { CheckinGroup } from "@/lib/email/templates";
import {
  CHECKIN_STAGES, groupByClient, isCheckinStage, styleDetail, daysBetween,
  type StyleInFlight, type CheckinStage,
} from "@/lib/style-checkin";

/** Styles named per client before the email says "and N more". */
const PER_CLIENT = 8;

/**
 * Every style currently being made, for one agency.
 *
 * The stage itself lives on the product; when it entered that stage lives
 * in product_stage_events, which is only written when somebody moves it
 * from the product page. Most existing products predate that, so the date
 * is genuinely unknown for them and the email says so rather than
 * inventing one from created_at — which would read as "in sampling 8
 * months" for a style set to sampling yesterday.
 */
export async function stylesInFlight(
  supabase: ReturnType<typeof getAgencyServiceSupabase>,
  agencyId: string,
): Promise<StyleInFlight[]> {
  const { data: productRows } = await supabase
    .from("products")
    .select("id, name, stage, project_id, expected_sample_date, sample_round, production_status_note, production_excluded_at")
    .eq("agency_id", agencyId)
    .in("stage", [...CHECKIN_STAGES]);

  const products = ((productRows ?? []) as Array<{
    id: string; name: string | null; stage: string | null; project_id: string | null;
    expected_sample_date: string | null; sample_round: number | null;
    production_status_note: string | null; production_excluded_at: string | null;
  }>).filter((p) => !p.production_excluded_at && isCheckinStage(p.stage));

  if (products.length === 0) return [];

  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("agency_id", agencyId);
  const projects = new Map(
    ((projectRows ?? []) as Array<{ id: string; name: string | null; client_id: string }>)
      .map((pr) => [pr.id, pr]),
  );

  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, name, status")
    .eq("agency_id", agencyId);
  const clients = new Map(
    ((clientRows ?? []) as Array<{ id: string; name: string | null; status: string | null }>)
      .map((c) => [c.id, c]),
  );

  // The most recent move into the stage the style is in now. Ordered
  // newest first, so the first one seen for a product is the one that put
  // it where it is.
  const { data: eventRows } = await supabase
    .from("product_stage_events")
    .select("product_id, to_stage, created_at")
    .in("product_id", products.map((p) => p.id))
    .order("created_at", { ascending: false });
  const enteredAt = new Map<string, string>();
  for (const e of (eventRows ?? []) as Array<{ product_id: string; to_stage: string; created_at: string }>) {
    const key = `${e.product_id}|${e.to_stage}`;
    if (!enteredAt.has(key)) enteredAt.set(key, e.created_at);
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const out: StyleInFlight[] = [];
  for (const p of products) {
    const project = p.project_id ? projects.get(p.project_id) : undefined;
    const client = project ? clients.get(project.client_id) : undefined;
    // Same rule the invoice chase uses: a list that includes dead work is
    // a list people stop reading.
    if (!client || client.status === "inactive") continue;

    const stage = p.stage as CheckinStage;
    const entered = enteredAt.get(`${p.id}|${stage}`) ?? null;
    const expected = p.expected_sample_date ? p.expected_sample_date.slice(0, 10) : null;

    out.push({
      id: p.id,
      name: p.name ?? "Untitled style",
      clientName: client.name ?? "A client",
      collectionName: project?.name ?? "",
      stage,
      enteredAt: entered,
      daysInStage: entered ? daysBetween(entered, now) : null,
      expectedDate: expected,
      daysLate: expected && stage === "sampling" ? daysBetween(`${expected}T12:00:00Z`, new Date(`${today}T12:00:00Z`)) : null,
      round: p.sample_round ?? null,
      statusNote: p.production_status_note?.trim() || null,
      url: buildPublicUrl(`/products/${p.id}`),
    });
  }
  return out;
}

export function toGroups(styles: StyleInFlight[]): CheckinGroup[] {
  return groupByClient(styles).map((g) => ({
    clientName: g.clientName,
    styles: g.styles.slice(0, PER_CLIENT).map((s) => ({
      name: s.name,
      detail: [s.collectionName, styleDetail(s)].filter(Boolean).join(" · "),
      url: s.url,
      late: s.daysLate != null && s.daysLate > 0,
    })),
    hidden: Math.max(0, g.styles.length - PER_CLIENT),
  }));
}

