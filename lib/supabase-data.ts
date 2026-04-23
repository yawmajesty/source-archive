import { createClient } from "@supabase/supabase-js";

// Plain anon client for data queries — safe to use server-side
export const supabaseData = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
