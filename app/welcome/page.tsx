import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { getUserWorkspaces } from "@/lib/brand-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome — Source[Archive]" };

/**
 * The fork for a signed-in user who belongs to nothing yet.
 *
 * Before this existed the root dispatcher sent every new account to
 * /onboarding-agency, which is why the database collected a run of empty
 * one-person agencies: brand owners were handed the agency setup form and
 * filled it in because it was the only thing in front of them.
 *
 * Anyone who already belongs somewhere is bounced straight back out — this
 * page is only ever a junction, never a destination.
 */
export default async function WelcomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const agencyCtx = await getAgencyContext();
  if (agencyCtx) redirect("/dashboard");

  const workspaces = await getUserWorkspaces();
  if (workspaces.length > 0) redirect(`/app/${workspaces[0].slug}`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--sa-bg)] px-6 py-12">
      <div className="w-full max-w-3xl">
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--sa-text-primary)]">
          What brings you here?
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--sa-text-secondary)]">
          You can change this later, and you can have both.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Choice
            href="/onboarding"
            title="I have a brand"
            lead="Work out what your garments cost and what to charge for them."
            points={[
              "Price a style in a couple of minutes",
              "See the margin after discounts, returns and fees",
              "Plan collections, samples and suppliers",
            ]}
            cta="Set up my brand"
            primary
          />
          <Choice
            href="/onboarding-agency"
            title="I run a sourcing agency"
            lead="Manage clients, factories and production on their behalf."
            points={[
              "A portal for each client",
              "Factories, quotes and cost sheets",
              "A workshop log for the people making samples",
            ]}
            cta="Set up my agency"
          />
        </div>

        <p className="mt-6 text-[12.5px] text-[var(--sa-text-tertiary)]">
          Brand accounts start on a 14-day trial. No card needed.
        </p>
      </div>
    </div>
  );
}

function Choice({
  href, title, lead, points, cta, primary,
}: {
  href: string;
  title: string;
  lead: string;
  points: string[];
  cta: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 transition-colors hover:border-[var(--sa-accent)]"
    >
      <h2 className="text-[16px] font-semibold text-[var(--sa-text-primary)]">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">{lead}</p>

      <ul className="mt-3.5 flex flex-1 flex-col gap-1.5">
        {points.map((p) => (
          <li key={p} className="flex gap-2 text-[12.5px] text-[var(--sa-text-secondary)]">
            <span aria-hidden="true" className="text-[var(--sa-text-tertiary)]">—</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <span
        className={`mt-5 inline-flex items-center justify-center rounded-md px-3 py-2 text-[13px] font-medium ${
          primary
            ? "bg-[var(--sa-accent)] text-white"
            : "border border-[var(--sa-border)] text-[var(--sa-text-primary)] group-hover:border-[var(--sa-accent)]"
        }`}
      >
        {cta}
      </span>
    </Link>
  );
}
