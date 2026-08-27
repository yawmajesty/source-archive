import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { OnboardingForm } from "./OnboardingForm";
import { acceptPendingInvites } from "@/app/(app)/settings/invite-actions";

export const metadata = { title: "Create your agency" };

export default async function OnboardingAgencyPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  // If they somehow have an agency already, bounce to dashboard.
  const ctx = await getAgencyContext();
  if (ctx) redirect("/dashboard");

  // If they were invited, join them and get out of the way — this is the
  // normal path now, and it must run before anything offers to create an
  // agency of their own.
  const claimed = await acceptPendingInvites();
  if (claimed.joined) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[var(--sa-bg)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-2">
            Welcome
          </p>
          <h1 className="text-[28px] font-serif tracking-tight text-[var(--sa-text-primary)]">
            You&apos;re signed in
          </h1>
          <p className="mt-2 text-[13px] text-[var(--sa-text-secondary)]">
            Your account is ready, but it isn&apos;t attached to a team yet. Ask whoever invited
            you to add you — you&apos;ll appear on their Team page straight away, and everything
            opens up the moment they do.
          </p>
        </div>

        {/*
          Creating an agency used to be the default action here, so anyone who
          signed up got one of their own. Work they then did was stamped with
          that agency and invisible to the real team — which is exactly how
          three Fiche Technique products went missing. Joining is now the
          expected path; creating is a deliberate choice behind a disclosure.
        */}
        <OnboardingForm />

        <p className="mt-8 text-center text-[11px] text-[var(--sa-text-tertiary)]">
          Signed in as the wrong account?{" "}
          <a href="/sign-in" className="text-[var(--sa-accent)]">Switch account</a>
        </p>
      </div>
    </div>
  );
}
