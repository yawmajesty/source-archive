import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/brand-data";
import { can, isSARole } from "@/lib/mode-policy";
import { WorkspaceContextProvider } from "./workspace-context";

// Every route under /[workspace] resolves the workspace, verifies
// membership, and gates on subscription state (independent mode only).
// The context is provided to the tree so client components don't have
// to refetch it themselves.
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  // Read-only enforcement (canceled subscription): allow settings/billing
  // pages so the user can pay to reactivate, but redirect other paths to
  // an upgrade prompt.
  if (ctx.isReadOnly) {
    // Deliberately don't fully hide their data — the spec says never
    // delete or hide. They land on billing with an upgrade CTA and can
    // still view (but not edit) everything else. We wire the read-only
    // state into forms in later phases; for now the layout renders.
  }

  return (
    <WorkspaceContextProvider value={ctx}>
      <div className="h-screen bg-[var(--sa-bg)] flex">
        <aside className="w-56 shrink-0 border-r border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-4 flex flex-col gap-1">
          <Link href={`/app/${slug}`} className="px-2 py-1.5 text-[13px] font-semibold text-[var(--sa-text-primary)] hover:bg-[var(--sa-hover)] rounded">
            {ctx.workspace.name}
          </Link>
          <span className="px-2 text-[10px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            {ctx.workspace.mode === "managed" ? "Managed" : "Independent"} · {ctx.role.replace("_", " ")}
          </span>
          <nav className="mt-3 flex flex-col gap-0.5">
            <Link href={`/app/${slug}`} className="px-2 py-1.5 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)] rounded">
              Overview
            </Link>
            <Link href={`/app/${slug}/collections`} className="px-2 py-1.5 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)] rounded">
              Collections
            </Link>
            <Link href={`/app/${slug}/activity`} className="px-2 py-1.5 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)] rounded">
              Activity
            </Link>
            {/* Suppliers is primary in independent, hidden in managed unless SA views it */}
            {(ctx.workspace.mode === "independent" || isSARole(ctx.role)) && (
              <Link href={`/app/${slug}/suppliers`} className="px-2 py-1.5 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)] rounded">
                Suppliers
              </Link>
            )}
            <Link href={`/app/${slug}/settings`} className="px-2 py-1.5 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)] rounded">
              Settings
            </Link>
            {can(ctx.role, "billing.view", ctx.workspace.mode) && (
              <Link href={`/app/${slug}/settings/billing`} className="px-2 py-1.5 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)] rounded">
                Billing
              </Link>
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {ctx.isGracePeriod && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 px-6 py-2 text-[12px] text-amber-800 dark:text-amber-300">
              Your last payment failed — update your card in Billing to avoid interruption.
            </div>
          )}
          {ctx.isReadOnly && (
            <div className="bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/30 px-6 py-2 text-[12px] text-red-800 dark:text-red-300 flex items-center justify-between">
              <span>This workspace is read-only. Your data is safe — reactivate your subscription to make changes.</span>
              <Link href={`/app/${slug}/settings/billing?upgrade=1`} className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90">
                Reactivate
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </WorkspaceContextProvider>
  );
}
