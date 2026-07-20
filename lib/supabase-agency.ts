import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

// Agency-side Supabase client, bridged to Clerk via the "supabase" JWT
// template. Every SELECT/INSERT/UPDATE/DELETE is filtered by the
// agency_id RLS policies added in migration 008.
//
// Cached per request via React `cache()` so a single page render only
// mints one token and one client, no matter how many helpers call in.

export const getAgencySupabase = cache(async (): Promise<SupabaseClient> => {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
});

// Service-role escape hatch. Bypasses RLS entirely. Use ONLY for:
//   - The public client portal (no Clerk auth)
//   - Stripe / other webhooks (no Clerk auth)
//   - One-off admin scripts
// Never expose to the browser and never accept unvalidated input.
export function getAgencyServiceSupabase(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
