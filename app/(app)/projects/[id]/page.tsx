import { notFound } from "next/navigation";
import { getProject, getProducts, getClient, getFactories } from "@/lib/data";
import { db } from "@/lib/mock-data";
import { ProjectsPageClient } from "./ProjectsPageClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const [project, products, factories] = await Promise.all([
    getProject(id),
    getProducts(id),
    getFactories(),
  ]);

  if (!project) notFound();

  const client = db.clients.find((c) => c.id === project.client_id) ?? null;

  // Attach factory info to products
  const productsWithFactory = products.map((p) => ({
    product: p,
    factory: p.factory_id ? factories.find((f) => f.id === p.factory_id) ?? null : null,
  }));

  return (
    <ProjectsPageClient
      project={project}
      client={client}
      productsWithFactory={productsWithFactory}
    />
  );
}
