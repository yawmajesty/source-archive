export const dynamic = 'force-dynamic';

import { getTasks, getProjects, getClients, getProducts } from "@/lib/data";
import { TasksClient } from "./TasksClient";

export default async function TasksPage() {
  const [tasks, projects, clients, products] = await Promise.all([
    getTasks(),
    getProjects(),
    getClients(),
    getProducts(),
  ]);

  return (
    <TasksClient
      tasks={tasks}
      projects={projects}
      clients={clients}
      products={products}
    />
  );
}
