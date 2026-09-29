/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────
// Moving Clerk from development to production.
//
// Clerk does not carry users across: a production instance starts empty,
// everyone signs up again, and everyone gets a new user id. Twenty rows in
// this database point at the old ones, and access is decided entirely by
// two of those tables — agency_members and workspace_members — so those
// rows are the whole job.
//
// Both tables take more than one row per person, which is what makes this
// safe: the new ids go in ALONGSIDE the old ones, both work at once, and
// the old ones are only removed once the new keys are proven. At no point
// is there a moment where nobody can get in, and switching the keys back
// undoes it until the last step.
//
// Run in order. Each phase prints what it did and nothing is destructive
// before "cleanup".
//
//   npx tsx scripts/clerk-cutover.ts plan      ← read-only, run this first
//   npx tsx scripts/clerk-cutover.ts seed      ← creates the users in production
//   npx tsx scripts/clerk-cutover.ts link      ← adds new rows, keeps the old
//   npx tsx scripts/clerk-cutover.ts verify    ← proves the new ids have the access
//   npx tsx scripts/clerk-cutover.ts cleanup   ← removes the old rows. Last.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const MAP_FILE = ".clerk-cutover-map.json";

function env(name: string, hint: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`\n  Missing ${name}.\n  ${hint}\n`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(
  env("NEXT_PUBLIC_SUPABASE_URL", "It is in .env.local already."),
  env("SUPABASE_SERVICE_ROLE_KEY", "It is in .env.local already."),
  { auth: { persistSession: false } },
);

interface ClerkUser {
  id: string;
  email_addresses?: Array<{ email_address: string }>;
  first_name?: string | null;
  last_name?: string | null;
}

async function clerkUsers(secret: string): Promise<ClerkUser[]> {
  const res = await fetch("https://api.clerk.com/v1/users?limit=100", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`Clerk ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as ClerkUser[];
}

const emailOf = (u: ClerkUser) => (u.email_addresses ?? [])[0]?.email_address?.toLowerCase() ?? "";

/** Every row whose user_id decides what someone can reach. */
async function accessRows() {
  const [am, wm, ag] = await Promise.all([
    supabase.from("agency_members").select("agency_id, user_id, role"),
    supabase.from("workspace_members").select("workspace_id, user_id, role"),
    supabase.from("agencies").select("id, name, owner_user_id"),
  ]);
  return {
    agencyMembers: (am.data ?? []) as Array<{ agency_id: string; user_id: string; role: string }>,
    workspaceMembers: (wm.data ?? []) as Array<{ workspace_id: string; user_id: string; role: string }>,
    agencies: (ag.data ?? []) as Array<{ id: string; name: string; owner_user_id: string | null }>,
  };
}

async function plan() {
  const dev = await clerkUsers(env("CLERK_SECRET_KEY", "The sk_test_ key, from .env.local."));
  const { agencyMembers, workspaceMembers, agencies } = await accessRows();
  const byId = new Map(dev.map((u) => [u.id, emailOf(u)]));

  console.log(`\n  Development instance: ${dev.length} users`);
  console.log(`  Rows that decide access: ${agencyMembers.length} agency + ${workspaceMembers.length} workspace`);
  console.log(`  Rows that are attribution only: ${agencies.filter((a) => a.owner_user_id).length} agency owner fields\n`);

  const held = new Map<string, string[]>();
  for (const m of agencyMembers) {
    const name = agencies.find((a) => a.id === m.agency_id)?.name ?? m.agency_id;
    held.set(m.user_id, [...(held.get(m.user_id) ?? []), `${m.role} of "${name}"`]);
  }
  for (const m of workspaceMembers) {
    held.set(m.user_id, [...(held.get(m.user_id) ?? []), `${m.role} of a brand workspace`]);
  }

  for (const [uid, roles] of held) {
    const email = byId.get(uid);
    console.log(`  ${email ?? `${uid}  ← NO CLERK USER`}`);
    for (const r of roles) console.log(`      ${r}`);
  }

  const idle = dev.filter((u) => !held.has(u.id));
  if (idle.length) {
    console.log(`\n  ${idle.length} user(s) hold no access and need nothing doing:`);
    for (const u of idle) console.log(`      ${emailOf(u)}`);
  }
  console.log("\n  Nothing was changed.\n");
}

async function seed() {
  const devSecret = env("CLERK_SECRET_KEY", "The sk_test_ key, from .env.local.");
  const prodSecret = env(
    "CLERK_PROD_SECRET_KEY",
    "The sk_live_ key. Put it in .env.production.local — never in a chat window.",
  );
  if (!prodSecret.startsWith("sk_live_")) {
    console.error("\n  That is not a production key. It must start with sk_live_.\n");
    process.exit(1);
  }

  const dev = await clerkUsers(devSecret);
  const { agencyMembers, workspaceMembers } = await accessRows();
  const needed = new Set([...agencyMembers, ...workspaceMembers].map((m) => m.user_id));
  const toCreate = dev.filter((u) => needed.has(u.id));

  const existing = await clerkUsers(prodSecret);
  const already = new Map(existing.map((u) => [emailOf(u), u.id]));

  const map: Record<string, { email: string; newId: string }> = existsSync(MAP_FILE)
    ? JSON.parse(readFileSync(MAP_FILE, "utf8"))
    : {};

  for (const u of toCreate) {
    const email = emailOf(u);
    if (!email) { console.log(`  skipped ${u.id}: no email address`); continue; }

    if (already.has(email)) {
      map[u.id] = { email, newId: already.get(email)! };
      console.log(`  already there  ${email}  → ${already.get(email)}`);
      continue;
    }

    const res = await fetch("https://api.clerk.com/v1/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${prodSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email_address: [email],
        first_name: u.first_name ?? undefined,
        last_name: u.last_name ?? undefined,
        // No password is carried over — Clerk hashes them and they are not
        // portable between instances. Everyone signs in by email code the
        // first time and sets their own.
        skip_password_requirement: true,
      }),
    });

    if (!res.ok) {
      console.error(`  FAILED ${email}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const created = (await res.json()) as ClerkUser;
    map[u.id] = { email, newId: created.id };
    console.log(`  created        ${email}  → ${created.id}`);
  }

  writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
  console.log(`\n  Map written to ${MAP_FILE} (${Object.keys(map).length} users). Nothing in the database has changed.\n`);
}

function loadMap(): Record<string, { email: string; newId: string }> {
  if (!existsSync(MAP_FILE)) {
    console.error(`\n  ${MAP_FILE} is missing. Run "seed" first.\n`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(MAP_FILE, "utf8"));
}

async function link() {
  const map = loadMap();
  const { agencyMembers, workspaceMembers } = await accessRows();
  let added = 0, skipped = 0;

  for (const m of agencyMembers) {
    const next = map[m.user_id];
    if (!next) continue;
    if (agencyMembers.some((x) => x.agency_id === m.agency_id && x.user_id === next.newId)) { skipped++; continue; }
    const { error } = await supabase
      .from("agency_members")
      .insert({ agency_id: m.agency_id, user_id: next.newId, role: m.role });
    if (error) console.error(`  FAILED ${next.email} on ${m.agency_id}: ${error.message}`);
    else { console.log(`  + agency_members    ${next.email}  ${m.role}`); added++; }
  }

  for (const m of workspaceMembers) {
    const next = map[m.user_id];
    if (!next) continue;
    if (workspaceMembers.some((x) => x.workspace_id === m.workspace_id && x.user_id === next.newId)) { skipped++; continue; }
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: m.workspace_id, user_id: next.newId, role: m.role });
    if (error) console.error(`  FAILED ${next.email} on ${m.workspace_id}: ${error.message}`);
    else { console.log(`  + workspace_members ${next.email}  ${m.role}`); added++; }
  }

  console.log(`\n  ${added} row(s) added, ${skipped} already present.`);
  console.log("  The old rows are untouched — both sets of ids work right now.\n");
}

async function verify() {
  const map = loadMap();
  const { agencyMembers, workspaceMembers, agencies } = await accessRows();
  let problems = 0;

  for (const [oldId, { email, newId }] of Object.entries(map)) {
    const oldAg = agencyMembers.filter((m) => m.user_id === oldId).map((m) => `${m.agency_id}:${m.role}`).sort();
    const newAg = agencyMembers.filter((m) => m.user_id === newId).map((m) => `${m.agency_id}:${m.role}`).sort();
    const oldWs = workspaceMembers.filter((m) => m.user_id === oldId).map((m) => `${m.workspace_id}:${m.role}`).sort();
    const newWs = workspaceMembers.filter((m) => m.user_id === newId).map((m) => `${m.workspace_id}:${m.role}`).sort();

    const ok = oldAg.join("|") === newAg.join("|") && oldWs.join("|") === newWs.join("|");
    console.log(`  ${ok ? "ok  " : "MISMATCH"}  ${email}  ${newAg.length + newWs.length} row(s)`);
    if (!ok) {
      problems++;
      console.log(`        was: ${[...oldAg, ...oldWs].join(", ") || "none"}`);
      console.log(`        now: ${[...newAg, ...newWs].join(", ") || "none"}`);
    }
  }

  const ownerFix = agencies.filter((a) => a.owner_user_id && map[a.owner_user_id]).length;
  console.log(`\n  ${ownerFix} agency owner field(s) still point at an old id.`);
  console.log("  That field is never read for access — it is a record of who founded the agency —");
  console.log("  so cleanup repoints it for tidiness, not for correctness.");
  console.log(problems === 0 ? "\n  Everything matches. Safe to switch the keys.\n" : `\n  ${problems} problem(s). Do not switch the keys yet.\n`);
}

async function cleanup() {
  const map = loadMap();
  const oldIds = Object.keys(map);
  let removed = 0;

  for (const [oldId, { email, newId }] of Object.entries(map)) {
    const { error: e1 } = await supabase.from("agency_members").delete().eq("user_id", oldId);
    const { error: e2 } = await supabase.from("workspace_members").delete().eq("user_id", oldId);
    if (e1 || e2) console.error(`  FAILED ${email}: ${e1?.message ?? ""} ${e2?.message ?? ""}`);
    else { console.log(`  - removed old rows for ${email}`); removed++; }

    // Tidy the founder record too, so nothing in the database still names an
    // instance that no longer exists.
    await supabase.from("agencies").update({ owner_user_id: newId }).eq("owner_user_id", oldId);
  }

  console.log(`\n  Cleaned up ${removed} of ${oldIds.length}. Only the production ids remain.\n`);
}

const PHASES: Record<string, () => Promise<void>> = { plan, seed, link, verify, cleanup };
const run = PHASES[process.argv[2] ?? ""];
if (!run) {
  console.error("\n  Usage: npx tsx scripts/clerk-cutover.ts <plan|seed|link|verify|cleanup>\n");
  process.exit(1);
}
run().catch((err: unknown) => {
  console.error("\n ", err instanceof Error ? err.message : String(err), "\n");
  process.exit(1);
});
