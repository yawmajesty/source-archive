import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/brand-data";
import { listPriceSheets } from "./actions";
import { PricingClient } from "./PricingClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pricing — Source[Archive]" };

/**
 * The standalone pricing calculator.
 *
 * Deliberately reachable straight from the workspace nav rather than
 * buried under a collection: a brand owner signs up to find out what to
 * charge, and should be able to before they have created anything.
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  if (!ctx) notFound();

  const sheets = await listPriceSheets(ctx.workspace.id);

  return (
    <PricingClient
      workspaceId={ctx.workspace.id}
      workspaceSlug={slug}
      mode={ctx.workspace.mode}
      role={ctx.role}
      baseCurrency={ctx.workspace.base_currency ?? "USD"}
      initialSheets={sheets}
    />
  );
}
