import { NextResponse } from "next/server";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { sendAll, looksLikeEmail } from "@/lib/email/send";
import { campaignItemDue } from "@/lib/email/templates";
import { buildPublicUrl } from "@/lib/url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily run.
 *
 * Everything the planner can do on demand was useless in practice,
 * because chasing overdue work only happened if someone opened the page
 * and pressed a button — which is exactly when they didn't need
 * reminding. This is the part that runs without anybody.
 *
 * Uses the service-role client: there is no user here, and the whole
 * point is that it works while everyone is asleep.
 *
 * Vercel sends CRON_SECRET as a bearer token. Without the check this is
 * a public URL that emails your clients on request.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means the endpoint stays shut rather than open.
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const supabase = getAgencyServiceSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const summary: Record<string, number> = { chased: 0, owners: 0, shootsTomorrow: 0 };

  // ── Overdue campaign items, grouped by owner ──
  const { data: items } = await supabase
    .from("campaign_items")
    .select("id, title, owner, due_date, status, campaign_id, agency_id")
    .lt("due_date", today)
    .not("owner", "is", null)
    .in("status", ["idea", "briefed", "in_progress", "ready"]);

  const rows = (items ?? []) as Array<{
    title: string; owner: string | null; due_date: string | null;
    campaign_id: string; agency_id: string;
  }>;

  if (rows.length > 0) {
    const { data: campaigns } = await supabase.from("campaigns").select("id, name");
    const names = new Map(
      ((campaigns ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
    );

    // One email per person, however many things they're behind on. Four
    // separate emails about being late is how someone starts filtering
    // the sender.
    const byOwner = new Map<
      string,
      { agencyId: string; items: Array<{ title: string; campaign: string; due: string | null }> }
    >();
    for (const r of rows) {
      if (!looksLikeEmail(r.owner)) continue;
      const key = r.owner.trim().toLowerCase();
      const entry = byOwner.get(key) ?? { agencyId: r.agency_id, items: [] };
      entry.items.push({
        title: r.title,
        campaign: names.get(r.campaign_id) ?? "A campaign",
        due: r.due_date,
      });
      byOwner.set(key, entry);
    }

    if (byOwner.size > 0) {
      const messages = Array.from(byOwner.entries()).map(([email, entry]) => {
        const built = campaignItemDue({
          ownerName: email,
          items: entry.items,
          url: buildPublicUrl("/studio-plan"),
        });
        return {
          agencyId: entry.agencyId,
          to: email,
          subject: built.subject,
          html: built.html,
          text: built.text,
          template: "campaign_item_due" as const,
          relatedType: null,
          relatedId: null,
        };
      });
      const results = await sendAll(messages);
      summary.owners = byOwner.size;
      summary.chased = results.filter((r) => r.status === "sent").length;
    }
  }

  // ── Shoots happening tomorrow, for the record ──
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const { data: soon } = await supabase
    .from("shoots")
    .select("id")
    .eq("shoot_date", tomorrow.toISOString().slice(0, 10))
    .in("status", ["planning", "booked"]);
  summary.shootsTomorrow = (soon ?? []).length;

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...summary });
}
