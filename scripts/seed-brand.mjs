#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Seed script — brand dashboard demo data.
//
// Creates:
//   - one MANAGED workspace: "Meiyo Studios"
//   - one INDEPENDENT workspace: "Aurelia Atelier"
//   - a fake external user (to test isolation) in a THIRD workspace
//     that YOUR user should NEVER be able to see
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (this script bypasses
// RLS so it can insert workspace + members atomically without a real
// Clerk JWT). Also requires SEED_USER_ID — your own Clerk user id, so
// you can log in and see the two managed/independent workspaces.
//
// Usage:
//   npm run seed:brand
//   SEED_USER_ID=user_abc123... node scripts/seed-brand.mjs
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUR_USER_ID = process.env.SEED_USER_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!YOUR_USER_ID) {
  console.error("[seed] Missing SEED_USER_ID env var.");
  console.error("       Your Clerk user id — copy it from Clerk Dashboard → Users → click your account → the id at the top (starts user_).");
  console.error("       Then re-run: SEED_USER_ID=user_abc... npm run seed:brand");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const OTHER_USER_ID = "user_isolation_probe_never_yours";

async function upsertWorkspace(input) {
  // Idempotent by slug.
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();

  if (existing) {
    console.log(`  · workspace "${input.name}" already exists (${existing.id}) — reusing`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      mode: input.mode,
      name: input.name,
      slug: input.slug,
      base_currency: input.base_currency ?? "USD",
      created_by: input.created_by,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`  ✗ failed to create ${input.name}: ${error.message}`);
    throw error;
  }

  console.log(`  ✓ created workspace "${input.name}" (${data.id})`);
  return data.id;
}

async function upsertMember(workspaceId, userId, role) {
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role });

  if (error) {
    console.error(`  ✗ failed to add member ${userId} as ${role}: ${error.message}`);
    throw error;
  }
  console.log(`  ✓ added ${userId} as ${role}`);
}

async function upsertSubscription(workspaceId, status, trialEndsAt = null) {
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("subscriptions").insert({
    workspace_id: workspaceId,
    status,
    trial_ends_at: trialEndsAt,
  });
  console.log(`  ✓ subscription: ${status}`);
}

async function main() {
  console.log("\nSeeding brand-dashboard demo data…\n");

  console.log("[1] Managed workspace — Meiyo Studios");
  const managedId = await upsertWorkspace({
    mode: "managed",
    name: "Meiyo Studios",
    slug: "meiyo-studios",
    base_currency: "USD",
    created_by: YOUR_USER_ID,
  });
  await upsertMember(managedId, YOUR_USER_ID, "brand_owner");
  // (Managed workspaces don't get a subscription record — SA billing is out of band)

  console.log("\n[2] Independent workspace — Aurelia Atelier");
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  const independentId = await upsertWorkspace({
    mode: "independent",
    name: "Aurelia Atelier",
    slug: "aurelia-atelier",
    base_currency: "GBP",
    created_by: YOUR_USER_ID,
  });
  await upsertMember(independentId, YOUR_USER_ID, "brand_owner");
  await upsertSubscription(independentId, "trialing", trialEnd.toISOString());

  console.log("\n[3] Isolation probe — should NEVER appear to your user");
  const isolationId = await upsertWorkspace({
    mode: "independent",
    name: "Isolation Probe (not yours)",
    slug: "isolation-probe",
    base_currency: "USD",
    created_by: OTHER_USER_ID,
  });
  await upsertMember(isolationId, OTHER_USER_ID, "brand_owner");
  await upsertSubscription(isolationId, "trialing", trialEnd.toISOString());

  console.log("\n✓ Seed complete.");
  console.log("  Log in as SEED_USER_ID and go to /");
  console.log(`  → you should be redirected to /app/meiyo-studios`);
  console.log("  Both meiyo-studios and aurelia-atelier will appear in your workspaces.");
  console.log("  Trying /app/isolation-probe should render the 'workspace not found' page — that confirms RLS is working.\n");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
