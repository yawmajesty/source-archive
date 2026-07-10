// ─────────────────────────────────────────────────────────────
// Plan → limits map.
//
// Keeping this a config module (not a DB table) means changing a limit
// or adding a tier is a code change with a review, not a mystery admin
// action. Stripe products can be added in the dashboard; the plan slug
// here just has to match the `metadata.plan` key set on the Stripe product.
//
// Managed workspaces bypass all of this — they aren't gated by any limit
// because they don't subscribe through the app.
// ─────────────────────────────────────────────────────────────

export type Plan =
  | "trial"    // 14-day free trial, no card
  | "solo"    // Single-brand indie designer
  | "studio"  // Small brand with a team
  | "atelier"; // Larger brand / multiple lines

export interface PlanLimits {
  displayName: string;
  members: number;              // -1 = unlimited
  collections: number;          // -1 = unlimited
  storageBytes: number;         // Total per workspace
  seatsIncluded: string;        // Human copy for pricing page
  // Feature toggles reserved for later phases
  activityRetentionDays: number;
  csvExport: boolean;
  pdfLineSheet: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: {
    displayName: "Free trial",
    members: 5,
    collections: 3,
    storageBytes: 500 * 1024 * 1024,          // 500 MB
    seatsIncluded: "5 seats",
    activityRetentionDays: 30,
    csvExport: true,
    pdfLineSheet: false,
  },
  solo: {
    displayName: "Solo",
    members: 3,
    collections: 10,
    storageBytes: 2 * 1024 * 1024 * 1024,     // 2 GB
    seatsIncluded: "Up to 3 seats",
    activityRetentionDays: 90,
    csvExport: true,
    pdfLineSheet: true,
  },
  studio: {
    displayName: "Studio",
    members: 10,
    collections: 50,
    storageBytes: 10 * 1024 * 1024 * 1024,    // 10 GB
    seatsIncluded: "Up to 10 seats",
    activityRetentionDays: 365,
    csvExport: true,
    pdfLineSheet: true,
  },
  atelier: {
    displayName: "Atelier",
    members: 25,
    collections: -1,
    storageBytes: 50 * 1024 * 1024 * 1024,    // 50 GB
    seatsIncluded: "Up to 25 seats",
    activityRetentionDays: -1,
    csvExport: true,
    pdfLineSheet: true,
  },
};

export function limitsFor(plan: Plan | null | undefined): PlanLimits {
  return PLAN_LIMITS[plan ?? "trial"];
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}
