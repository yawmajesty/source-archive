import { NextResponse } from "next/server";
import { getAgencyServiceSupabase } from "@/lib/supabase-agency";
import { sendAll, looksLikeEmail } from "@/lib/email/send";
import { campaignItemDue, dailyDigest, type DigestQueue, type DigestInvoice } from "@/lib/email/templates";
import { buildCommandCentre } from "@/lib/command-centre-build";
import { agencyNotificationRecipients } from "@/lib/email/send";
import { sumInvoice, money } from "@/lib/invoice-total";
import { ageOf } from "@/lib/command-centre";
import { buildPublicUrl } from "@/lib/url";
import { runBackup } from "@/app/(app)/settings/backup-actions";
import { notifySlack } from "@/lib/slack";

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
  const summary: Record<string, number | string> = { chased: 0, owners: 0, shootsTomorrow: 0, backup: "skipped" };

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

  // ── Weekly backup, on Mondays ──
  // Daily would be wasteful for a dataset this size and weekly is short
  // enough that a bad migration is caught before the copy is useless.
  if (new Date().getUTCDay() === 1) {
    const { data: agencies } = await supabase.from("agencies").select("id");
    for (const a of ((agencies ?? []) as Array<{ id: string }>).slice(0, 20)) {
      const res = await runBackup("scheduled", a.id);
      if (res.success) summary.backup = `${res.rowTotal} rows`;
      else summary.backup = `failed: ${res.error}`;
    }
  }

  // ── The morning digest ──
  // The dashboard already worked out what needs doing. The problem was that
  // it only existed if somebody opened it, which is exactly when they did
  // not need telling. One email, everything on it.
  summary.digest = await sendDigest(supabase, Number(summary.shootsTomorrow) || 0);

  if (Number(summary.chased) > 0 || summary.backup !== "skipped") {
    await notifySlack({
      title: "Source Archive — daily run",
      fields: [
        ["Digest", String(summary.digest)],
        ["Chased", `${summary.chased} of ${summary.owners} people`],
        ["Shoots tomorrow", String(summary.shootsTomorrow)],
        ["Backup", String(summary.backup)],
      ],
      url: buildPublicUrl("/studio-plan"),
      urlLabel: "Open the planner",
    });
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...summary });
}

/**
 * ageOf returns words, not a duration: "today", "yesterday", "4 months".
 * Only the last kind takes "ago", and "sent today ago" is how you find out.
 */
function agoPhrase(age: string | null): string | null {
  if (!age) return null;
  return age === "today" || age === "yesterday" ? age : `${age} ago`;
}

/** How many queue items to name per section before saying "and N more". */
const PER_QUEUE = 5;

function greet(): string {
  const hour = new Date().getUTCHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/**
 * One digest per agency, to whoever hears about everything else.
 *
 * Built from the same function the dashboard uses, so the email and the
 * screen can never disagree about what is waiting.
 */
async function sendDigest(
  supabase: ReturnType<typeof getAgencyServiceSupabase>,
  shootsTomorrow: number,
): Promise<string> {
  const { data: agencies } = await supabase.from("agencies").select("id, name");
  const rows = (agencies ?? []) as Array<{ id: string; name: string | null }>;
  let sent = 0;

  for (const agency of rows.slice(0, 20)) {
    try {
      const to = await agencyNotificationRecipients(agency.id);
      if (to.length === 0) continue;

      const centre = await buildCommandCentre(supabase, { seesMoney: true, seesClients: true });

      // Nothing waiting and nothing owed still sends — a digest that only
      // arrives on bad days trains you to dread it, and its absence then
      // says nothing at all.
      const queues: DigestQueue[] = centre.queues
        .filter((q) => q.kind !== "invoice" && q.items.length > 0)
        .map((q) => ({
          label: q.label,
          tone: "",
          stake: q.stake,
          total: q.total,
          items: q.items.slice(0, PER_QUEUE).map((it) => ({
            title: it.title,
            subtitle: it.subtitle,
            age: it.age,
            urgency: it.urgency,
            href: buildPublicUrl(it.href),
            // Only where there is a project to park. The link opens the
            // choice; it does not make it — see ParkDialog for why.
            parkUrl: it.projectId
              ? buildPublicUrl(`/dashboard?park=${encodeURIComponent(it.projectId)}`)
              : null,
          })),
        }));

      const invoices = await unpaidInvoices(supabase, agency.id);
      // Totalled from the list itself rather than taken from the centre:
      // one number derived from two different filters is a number that
      // eventually contradicts the rows printed underneath it.
      const owed = invoices.reduce((sum, inv) => sum + inv.amountValue, 0);

      const built = dailyDigest({
        greeting: greet(),
        needsYou: centre.totals.needsYou,
        owed: money(owed),
        queues,
        invoices,
        shootsTomorrow,
        dashboardUrl: buildPublicUrl("/dashboard"),
      });

      const results = await sendAll(
        to.map((address) => ({
          agencyId: agency.id,
          to: address,
          subject: built.subject,
          html: built.html,
          text: built.text,
          template: "daily_digest" as const,
          relatedType: null,
          relatedId: null,
        })),
      );
      sent += results.filter((r) => r.status === "sent").length;
    } catch (err) {
      console.error("[cron] digest failed for", agency.id, err);
    }
  }

  return `${sent} sent`;
}

/** Sent, not paid — each with a link that opens a chase you can edit. */
async function unpaidInvoices(
  supabase: ReturnType<typeof getAgencyServiceSupabase>,
  agencyId: string,
): Promise<DigestInvoice[]> {
  const { data } = await supabase
    .from("sampling_invoices")
    .select("id, client_id, title, round, invoice_kind, line_items, deposit_percent, created_at")
    .eq("agency_id", agencyId)
    .eq("status", "sent")
    .order("created_at");

  const rows = (data ?? []) as Array<{
    id: string; client_id: string; title: string | null; round: number | null;
    invoice_kind: string | null; line_items: unknown; deposit_percent: number | null;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status")
    .eq("agency_id", agencyId);
  const active = (clients ?? []) as Array<{ id: string; name: string; status: string | null }>;
  const names = new Map(active.map((c) => [c.id, c.name]));
  // Exactly the rule the dashboard applies — "not inactive", which keeps
  // onboarding and paused clients in. Anything stricter made the list
  // disagree with the total above it.
  const chaseable = new Set(active.filter((c) => c.status !== "inactive").map((c) => c.id));

  return rows.filter((r) => chaseable.has(r.client_id)).map((r) => {
    const total = sumInvoice(r.line_items);
    const due = total * ((r.deposit_percent ?? 100) / 100);
    return {
      id: r.id,
      amountValue: due,
      title:
        r.title ??
        (r.invoice_kind === "production"
          ? `Production invoice${r.round ? ` — Round ${r.round}` : ""}`
          : `Round ${r.round ?? 1} sampling`),
      clientName: names.get(r.client_id) ?? "A client",
      amount: money(due),
      age: agoPhrase(ageOf(r.created_at)),
      // Opens the draft rather than sending anything: a link in an email
      // gets fetched by spam scanners and link previews, so a one-click
      // send from here would chase clients nobody meant to chase.
      chaseUrl: buildPublicUrl(`/invoices?chase=${encodeURIComponent(r.id)}`),
      // Invoices belong to a client, not a project, so parking a project
      // does nothing for them. This is their equivalent: still owed, still
      // on the record, just no longer chased.
      parkUrl: buildPublicUrl(`/invoices?park=${encodeURIComponent(r.id)}`),
    };
  });
}
