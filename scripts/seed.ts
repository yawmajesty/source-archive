// Run: npx tsx scripts/seed.ts
import { createClient } from "@supabase/supabase-js";
import { db } from "../lib/mock-data";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function seed() {
  console.log("Seeding Supabase...");

  const tables = [
    { name: "clients",      data: db.clients },
    { name: "factories",    data: db.factories },
    { name: "projects",     data: db.projects },
    { name: "products",     data: db.products.map(({ bom, ...p }) => p) },
    { name: "milestones",   data: db.milestones },
    { name: "samples",      data: db.samples },
    { name: "costs",        data: db.costs },
    { name: "updates",      data: db.updates },
    { name: "tasks",        data: db.tasks },
    { name: "contracts",    data: db.contracts },
    { name: "portal_files", data: db.portal_files },
    { name: "leads",        data: db.leads },
  ];

  for (const { name, data } of tables) {
    const { error } = await supabase.from(name).upsert(data as any[]);
    if (error) {
      console.error(`✗ ${name}:`, error.message);
    } else {
      console.log(`✓ ${name} (${data.length} rows)`);
    }
  }

  console.log("Done.");
}

seed();
