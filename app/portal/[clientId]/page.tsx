import { getClient, getProjects, getProducts, getMilestones, getUpdates, getContracts, getPortalFiles, getAgencySettings, getSamplingInvoices } from "@/lib/data";
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
  sample_fee_usd: number | null;
  expected_sample_date: string | null;
  sample_round: number;
  price_tiers: { moq: number; unit_price_usd: number }[];
  milestones: { id: string; title: string; due_date: string; completed_at: string | null }[];
  updates: { id: string; author: string; author_initials: string; text: string; created_at: string }[];
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

  const client = await getClient(clientId);
  if (!client) notFound();

  const [projects, contracts, files, agencySettings, savedInvoices] = await Promise.all([
    getProjects(clientId),
    getContracts(clientId),
    getPortalFiles(clientId),
    getAgencySettings(),
    getSamplingInvoices(clientId, false),
  ]);

  if (!client.portal_enabled) {
    return <PortalClient client={client} locked={true} projects={[]} contracts={contracts} files={files} agencySettings={agencySettings} isAgency={isAgency} savedInvoices={savedInvoices} />;
  }

  const portalProjects: PortalProject[] = await Promise.all(
    projects.map(async (project) => {
      const products = await getProducts(project.id);
      const enriched: PortalProduct[] = await Promise.all(
        products.map(async (product) => {
          const [milestones, updates] = await Promise.all([
            getMilestones(product.id),
            getUpdates(product.id),
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
      savedInvoices={savedInvoices}
    />
  );
}
