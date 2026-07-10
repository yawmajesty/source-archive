import { getWorkspaceContext } from "@/lib/brand-data";
import { notFound } from "next/navigation";

// Overview dashboard — populated for real in Phase 5 (planning/timeline)
// and Phase 6 (activity feed). Phase 1 ships a scaffolded placeholder so
// the route + membership + subscription gates can be verified end-to-end.
export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-[var(--sa-text-primary)] leading-tight">
          {ctx.workspace.name}
        </h1>
        <p className="text-[13px] text-[var(--sa-text-tertiary)] mt-1">
          {ctx.workspace.mode === "managed"
            ? "Managed workspace — you're collaborating with your production partner here."
            : "Your workspace — collections, samples, and production, end to end."}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-8 text-center">
        <p className="text-[14px] text-[var(--sa-text-secondary)] mb-2">
          You&apos;re in! The overview populates over the next phases.
        </p>
        <p className="text-[12px] text-[var(--sa-text-tertiary)]">
          Base currency: {ctx.workspace.base_currency} · Role: {ctx.role.replace("_", " ")}
        </p>
      </div>
    </div>
  );
}
