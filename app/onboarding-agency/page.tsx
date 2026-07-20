import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = { title: "Create your agency" };

export default async function OnboardingAgencyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  // If they somehow have an agency already, bounce to dashboard.
  const ctx = await getAgencyContext();
  if (ctx) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[var(--sa-bg)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-2">
            Welcome
          </p>
          <h1 className="text-[28px] font-serif tracking-tight text-[var(--sa-text-primary)]">
            Set up your agency
          </h1>
          <p className="mt-2 text-[13px] text-[var(--sa-text-secondary)]">
            One row per agency. Your clients, projects, factories, and settings all live
            underneath. No one outside your team can see them.
          </p>
        </div>

        <OnboardingForm />

        <p className="mt-8 text-center text-[11px] text-[var(--sa-text-tertiary)]">
          Been invited to someone else's agency? Ask them to resend the invite link.
        </p>
      </div>
    </div>
  );
}
