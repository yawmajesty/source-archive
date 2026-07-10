import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserWorkspaces } from "@/lib/brand-data";
import { OnboardingForm } from "./OnboardingForm";

// Post-signup landing for brand-side users. Takes brand name + optional
// base currency, creates an independent workspace + 14-day trial, and
// redirects into the dashboard. Agency team members bypass this — they
// never see /onboarding because /page.tsx dispatches them to /dashboard.
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Already have a workspace? Skip onboarding.
  const existing = await getUserWorkspaces();
  if (existing.length > 0) redirect(`/app/${existing[0].slug}`);

  return (
    <div className="min-h-screen bg-[var(--sa-bg)] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] mb-1">
          Set up your workspace
        </h1>
        <p className="text-[13px] text-[var(--sa-text-tertiary)] mb-6">
          Everything else — collections, samples, costing — lives inside it. You&apos;ll be able to change these later.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
