import type { ProductMediaItem } from "@/lib/product-media";
import type { ProductionLogEntry } from "@/lib/production-log";
import type { PortalStageEvent } from "@/lib/portal-data";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { resolvePortalAccess } from "@/app/(app)/clients/member-actions";
import {
  getPortalClient,
  getPortalProjects,
  getPortalProducts,
  getPortalMilestones,
  getPortalUpdates,
  getPortalProductMedia,
  getPortalProductionLog,
  getPortalStageEvents,
  getPortalContracts,
  getPortalFilesForClient,
  getPortalAgencySettings,
  getPortalSamplingInvoices,
} from "@/lib/portal-data";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PortalClient } from "./PortalClient";
import type { Contract, PortalFile, AgencySettings, SavedInvoice } from "@/lib/data";
import type { Stage } from "@/lib/mock-data";

interface Props {
  params: Promise<{ clientId: string }>;
}

// Stripped product shape — no factory, cost, BOM, or internal fields
export interface PortalProduct {
  id: string;
  name: string;
  category: string;
  stage: Stage;
  moq: number | null;
  order_qty: number | null;
  quoted_cost_usd: number | null;
  colorways: string[];
  images: string[];
  media: ProductMediaItem[];
  productionLog: ProductionLogEntry[];
  stageHistory: PortalStageEvent[];
  sample_fee_usd: number | null;
  expected_sample_date: string | null;
  sample_round: number;
  price_tiers: { moq: number; unit_price_usd: number }[];
  milestones: { id: string; title: string; due_date: string; completed_at: string | null }[];
  updates: { id: string; author: string; author_initials: string; text: string; created_at: string; author_role: "agency" | "client" }[];
}

export interface PortalProject {
  id: string;
  name: string;
  season: string;
  target_completion: string;
  products: PortalProduct[];
}

export default async function PortalPage({ params }: Props) {
  const { clientId } = await params;
  const { userId } = await auth();
  const isAgency = !!userId;

  // Agency staff — designers included — work from the client portal, so the
  // stage control lives here rather than only in the backend.
  let canChangeStage = false;
  if (isAgency) {
    const agencyCtx = await getAgencyContext();
    canChangeStage = agencyCtx ? can(agencyCtx.role, agencyCtx.permissions, "stage.change") : false;
  }

  const client = await getPortalClient(clientId);
  if (!client) notFound();

  // Open to anyone with the link until this client has members; sign-in only
  // from the moment the first person is added.
  const access = await resolvePortalAccess(clientId);
  if (!access.allowed) {
    return <PortalSignInRequired clientName={client.name} signedIn={access.signedIn} />;
  }

  const [projects, contracts, files, agencySettings, savedInvoices] = await Promise.all([
    getPortalProjects(clientId),
    getPortalContracts(clientId),
    getPortalFilesForClient(clientId),
    getPortalAgencySettings(clientId),
    getPortalSamplingInvoices(clientId, false),
  ]);

  if (!client.portal_enabled) {
    return <PortalClient client={client} locked={true} projects={[]} contracts={contracts} files={files} agencySettings={agencySettings} isAgency={isAgency} canChangeStage={false} savedInvoices={savedInvoices} />;
  }

  const portalProjects: PortalProject[] = await Promise.all(
    projects.map(async (project) => {
      const allProducts = await getPortalProducts(project.id);
      // Excluded-from-production items are never shown to the client.
      const products = allProducts.filter((p) => !p.production_excluded_at);
      const enriched: PortalProduct[] = await Promise.all(
        products.map(async (product) => {
          const [milestones, updates, media, productionLog, stageHistory] = await Promise.all([
            getPortalMilestones(product.id),
            getPortalUpdates(product.id),
            getPortalProductMedia(product.id),
            getPortalProductionLog(product.id),
            getPortalStageEvents(product.id),
          ]);
          // Strip all internal fields — only expose client-safe shape
          return {
            id: product.id,
            name: product.name,
            category: product.category,
            stage: product.stage,
            moq: product.moq,
            order_qty: product.order_qty,
            quoted_cost_usd: product.quoted_cost_usd,
            colorways: product.colorways,
            images: (product as any).images ?? [],
            media,
            productionLog,
            stageHistory,
            sample_fee_usd: (product as any).sample_fee_usd ?? null,
            expected_sample_date: (product as any).expected_sample_date ?? null,
            sample_round: (product as any).sample_round ?? 1,
            price_tiers: ((product as any).price_tiers ?? []) as { moq: number; unit_price_usd: number }[],
            milestones: milestones.map((m) => ({
              id: m.id,
              title: m.title,
              due_date: m.due_date,
              completed_at: m.completed_at,
            })),
            updates: updates
              .filter((u) => u.visible_to_client)
              .map((u) => ({
                id: u.id,
                author: u.author,
                author_initials: u.author_initials,
                author_role: ((u as any).author_role === "client" ? "client" : "agency") as "agency" | "client",
                text: u.text,
                created_at: u.created_at,
              })),
          };
        })
      );
      return {
        id: project.id,
        name: project.name,
        season: project.season,
        target_completion: project.target_completion,
        products: enriched,
      };
    })
  );

  return (
    <PortalClient
      client={client}
      locked={false}
      projects={portalProjects}
      contracts={contracts}
      files={files}
      agencySettings={agencySettings}
      isAgency={isAgency}
      canChangeStage={canChangeStage}
      savedInvoices={savedInvoices}
    />
  );
}

function PortalSignInRequired({ clientName, signedIn }: { clientName: string; signedIn: boolean }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--canvas)", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
    >
      <div className="mac-card max-w-sm p-6 text-center">
        <h1 className="text-[16px] font-semibold tight" style={{ color: "var(--label)" }}>
          {clientName}
        </h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--label-2)" }}>
          {signedIn
            ? "This portal is limited to people on the account. Ask them to add your email address, then reload."
            : "This portal is private. Sign in with the email address you were invited on."}
        </p>
        {!signedIn && (
          <a
            href="/sign-in"
            className="mac-button mac-button-primary mt-4 inline-flex items-center px-4"
          >
            Sign in
          </a>
        )}
      </div>
    </div>
  );
}
