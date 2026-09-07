import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserWorkspaces } from "@/lib/brand-data";
import { OnboardingForm } from "./OnboardingForm";

// Post-signup landing for brand-side users. Takes brand name + optional
// base currency, creates an independent workspace + 14-day trial, and
// redirects into the dashboard. Agency team members bypass this — they
// never see /onboarding because /page.tsx dispatches them to /dashboard.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Someone arriving from the public calculator has a style waiting in
  // their browser, so send them to the page that knows how to claim it.
  const fromPrice = (await searchParams).from === "price";

  // Already have a workspace? Skip onboarding.
  const existing = await getUserWorkspaces();
  if (existing.length > 0) {
    redirect(fromPrice ? `/app/${existing[0].slug}/pricing` : `/app/${existing[0].slug}`);
  }

  return (
    <div className="min-h-screen bg-[var(--sa-bg)] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] mb-1">
          Set up your workspace
        </h1>
        <p className="text-[13px] text-[var(--sa-text-tertiary)] mb-6">
          {fromPrice
            ? "Name your brand and your style will be waiting inside, exactly as you left it."
            : "Everything else — collections, samples, costing — lives inside it. You'll be able to change these later."}
        </p>
        <OnboardingForm landOnPricing={fromPrice} />
      </div>
    </div>
  );
}
