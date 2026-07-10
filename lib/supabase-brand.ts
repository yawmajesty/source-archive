"use server";

// ─────────────────────────────────────────────────────────────
// Clerk → Supabase JWT bridge.
//
// Every request into brand-dashboard data goes through this client. It
// asks Clerk for a JWT signed against the Supabase secret (via a "supabase"
// JWT template configured in the Clerk dashboard) and attaches it as a
// Bearer token on the Supabase client. Supabase then verifies the JWT
// and RLS policies read the Clerk user id from auth.jwt() ->> 'sub'.
//
// One-time Clerk setup (see docs comment in this file):
//   1. Clerk Dashboard → JWT Templates → New template → name "supabase"
//   2. Signing algorithm: HS256
//   3. Signing key: your Supabase JWT secret (Settings → API → JWT Secret)
//   4. Claims: { "role": "authenticated" }
//   5. Save
// ─────────────────────────────────────────────────────────────

import { auth } from "@clerk/nextjs/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client authorized as the current Clerk user.
 * All queries through this client are subject to RLS as that user.
 *
 * If there's no active session, the client falls through to the anon
 * key with no bearer token — the calling code should redirect first.
 */
export async function getBrandSupabase(): Promise<SupabaseClient> {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * Escape hatch — returns a Supabase client backed by the service_role key.
 * This bypasses RLS entirely and MUST NOT be used from any handler that
 * runs code driven by user input. It exists solely for webhooks (Stripe
 * subscription reconciliation) and admin-only maintenance scripts.
 *
 * If the env var is missing, throws — because falling back to the anon
 * key here would silently break the webhook.
 */
export async function getServiceSupabase(): Promise<SupabaseClient> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel → Environment Variables (Production only, mark Sensitive).",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
