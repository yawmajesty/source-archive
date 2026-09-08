import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { canUseShootPlanner, lowestPlanWithShootPlanner } from "@/lib/plan-limits";
import { listWorkspaceShoots, listWorkspaceCampaigns } from "./actions";
import { WorkspacePlanner } from "./WorkspacePlanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shoots & Marketing" };

export default async function WorkspaceShootsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const allowed = canUseShootPlanner(ctx.subscription?.plan);
  if (!allowed) {
    const { limits } = lowestPlanWithShootPlanner();
    return (
      <div className="p-8">
        <div className="mx-auto max-w-lg rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6">
          <h1 className="text-[18px] font-semibold text-[var(--sa-text-primary)]">
            Shoot planning is on {limits.displayName}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--sa-text-secondary)]">
            Brief a photographer properly: the shot list already written, references filed by what
            they&apos;re an example of — lighting, hair, casting, styling — and a marketing plan that
            lays your drop out across teaser, launch week and remarketing.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {[
              "Standard e-commerce shot list, ready to edit",
              "Reference images filed by lighting, hair, make-up, casting",
              "Usage rights, retouching and deliverables in writing",
              "Save any brief as a template for the next one",
              "Launch plans dated from your drop day",
            ].map((f) => (
              <li key={f} className="flex gap-2 text-[12.5px] text-[var(--sa-text-secondary)]">
                <span aria-hidden="true" className="text-[var(--sa-text-tertiary)]">—</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            href={`/app/${slug}/settings/billing?upgrade=1`}
            className="mt-5 inline-block rounded-md bg-[var(--sa-accent)] px-4 py-2.5 text-[13px] font-medium text-white"
          >
            Upgrade to {limits.displayName} — ${limits.monthlyPriceUsd}/mo
          </Link>
          <p className="mt-2 text-[11.5px] text-[var(--sa-text-tertiary)]">
            It&apos;s included in your free trial, so you can try it before deciding.
          </p>
        </div>
      </div>
    );
  }

  const [shoots, campaigns] = await Promise.all([
    listWorkspaceShoots(slug),
    listWorkspaceCampaigns(slug),
  ]);

  return (
    <WorkspacePlanner
      slug={slug}
      shoots={shoots}
      campaigns={campaigns as Array<{ id: string; name: string; kind: string; launch_date: string | null }>}
    />
  );
}
