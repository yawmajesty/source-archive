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
  // Marketing / pricing copy
  monthlyPriceUsd: number;      // 0 for trial, listed price for others
  yearlyPriceUsd: number;       // annual/12 in USD, 0 for trial
  tagline: string;              // one-liner for pricing cards
  audience: string;             // "Solo designer", "Small studio", etc.
  highlights: string[];         // 3-5 short feature bullets
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
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    tagline: "Kick the tyres for two weeks. No card required.",
    audience: "New signups",
    highlights: [
      "14-day access to every Studio feature",
      "Up to 3 collections",
      "5 teammates",
      "Real work saved — upgrade to keep going",
    ],
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
    monthlyPriceUsd: 39,
    yearlyPriceUsd: 32,
    tagline: "The one-person label with a factory contact list.",
    audience: "Solo designer",
    highlights: [
      "10 active collections",
      "3 seats — bring in your assistant + factory",
      "PDF line sheets, CSV export",
      "90-day activity history",
    ],
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
    monthlyPriceUsd: 129,
    yearlyPriceUsd: 108,
    tagline: "For growing brands running multiple drops in parallel.",
    audience: "Small studio",
    highlights: [
      "50 active collections",
      "10 seats across design, production, ops",
      "Timeline & full costing rollups",
      "1-year activity history",
    ],
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
    monthlyPriceUsd: 349,
    yearlyPriceUsd: 289,
    tagline: "Larger houses juggling seasonal calendars year-round.",
    audience: "Established brand",
    highlights: [
      "Unlimited collections",
      "25 seats + supplier guest access",
      "Priority support",
      "Unlimited activity retention",
    ],
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
