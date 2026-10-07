export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { getClient, getProjects, getProducts, getCosts, getPortalActivity } from "@/lib/data";
import { ClientsPageClient } from "./ClientsPageClient";
import { listClientMembers, type ClientMember } from "../member-actions";
import { getClientOrigin } from "./origin-actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: Props) {
  const { id } = await params;
  const [client, projects] = await Promise.all([
    getClient(id),
    getProjects(id),
  ]);

  if (!client) notFound();

  let members: ClientMember[] = [];
  try { members = await listClientMembers(id); } catch { members = []; }

  // Preload products + costs for each project, plus portal activity
  const [projectData, portalActivity] = await Promise.all([
    Promise.all(
      projects.map(async (project) => {
        const [products, costs] = await Promise.all([
          getProducts(project.id),
          getCosts({ projectId: project.id }),
        ]);
        const totalCostGbp = costs.reduce((s, c) => s + c.amount_gbp, 0);
        return { project, products, totalCostGbp };
      })
    ),
    getPortalActivity(id),
  ]);

  // Where they came from, and every photograph taken since — both read here
  // so the client page is one request rather than a page that fills in.
  const origin = await getClientOrigin(id).catch(() => null);
  const photos = projectData.flatMap(({ products }) =>
    products.flatMap((product) =>
      (product.images ?? []).map((url) => ({
        url,
        productName: product.name,
        productId: product.id,
      })),
    ),
  );

  return (
    <ClientsPageClient
      clientMembers={members}
      client={client}
      projectData={projectData}
      portalActivity={portalActivity}
      origin={origin}
      photos={photos}
    />
  );
}
