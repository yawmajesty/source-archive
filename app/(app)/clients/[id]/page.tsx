import { notFound } from "next/navigation";
import { getClient, getProjects, getProducts, getCosts } from "@/lib/data";
import { ClientsPageClient } from "./ClientsPageClient";

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

  // Preload products + costs for each project
  const projectData = await Promise.all(
    projects.map(async (project) => {
      const [products, costs] = await Promise.all([
        getProducts(project.id),
        getCosts({ projectId: project.id }),
      ]);
      const totalCostGbp = costs.reduce((s, c) => s + c.amount_gbp, 0);
      return { project, products, totalCostGbp };
    })
  );

  return (
    <ClientsPageClient
      client={client}
      projectData={projectData}
    />
  );
}
