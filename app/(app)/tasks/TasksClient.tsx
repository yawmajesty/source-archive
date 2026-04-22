"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, Project, Client, Product } from "@/lib/data";

interface Props {
  tasks: Task[];
  projects: Project[];
  clients: Client[];
  products: Product[];
}

type View = "all" | "mine" | "week" | "overdue";

const STATUS_CONFIG: Record<
  Task["status"],
  { label: string; icon: React.ElementType; color: string }
> = {
  todo:             { label: "To Do",           icon: Circle,       color: "text-[var(--sa-text-tertiary)]" },
  in_progress:      { label: "In Progress",     icon: Loader2,      color: "text-[var(--sa-accent)]" },
  waiting_client:   { label: "Waiting: Client", icon: Clock,        color: "text-amber-500" },
  waiting_factory:  { label: "Waiting: Factory",icon: Clock,        color: "text-orange-500" },
  done:             { label: "Done",            icon: CheckCircle2, color: "text-emerald-500" },
};

function formatDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((date.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: "Today", overdue: false };
  if (diff === 1) return { label: "Tomorrow", overdue: false };
  return {
    label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    overdue: false,
  };
}

function TaskRow({
  task,
  projectName,
  clientName,
  productName,
}: {
  task: Task;
  projectName: string;
  clientName: string;
  productName: string | null;
}) {
  const cfg = STATUS_CONFIG[task.status];
  const Icon = cfg.icon;
  const date = formatDate(task.due_date);
  const isDone = task.status === "done";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b border-[var(--sa-border)] hover:bg-[var(--sa-hover)] transition-colors group",
        isDone && "opacity-50"
      )}
    >
      <Icon
        size={14}
        strokeWidth={1.8}
        className={cn("shrink-0", cfg.color, task.status === "in_progress" && "animate-spin [animation-duration:3s]")}
      />

      <span className={cn("flex-1 text-[13px] text-[var(--sa-text-primary)] truncate", isDone && "line-through")}>
        {task.title}
      </span>

      {task.notes && (
        <span className="hidden xl:block text-[11px] text-[var(--sa-text-tertiary)] truncate max-w-[180px]">
          {task.notes}
        </span>
      )}

      {productName && (
        <span className="hidden lg:block text-[11px] text-[var(--sa-text-tertiary)] truncate max-w-[120px]">
          {productName}
        </span>
      )}

      <span className="hidden md:flex text-[11px] text-[var(--sa-text-tertiary)] shrink-0 items-center gap-1">
        <span className="h-4 w-4 rounded-full bg-[var(--sa-selected)] flex items-center justify-center text-[9px] font-semibold text-[var(--sa-accent)]">
          {task.assigned_initials}
        </span>
        {task.assigned_to.split(" ")[0]}
      </span>

      {date ? (
        <span
          className={cn(
            "shrink-0 text-[11px] font-medium",
            date.overdue ? "text-[var(--sa-danger)]" : "text-[var(--sa-text-tertiary)]"
          )}
        >
          {date.overdue && <AlertCircle size={10} className="inline mr-0.5 mb-px" />}
          {date.label}
        </span>
      ) : (
        <span className="shrink-0 w-16" />
      )}
    </motion.div>
  );
}

export function TasksClient({ tasks, projects, clients, products }: Props) {
  const [view, setView] = useState<View>("all");

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86400000);

  const filtered = useMemo(() => {
    switch (view) {
      case "mine":
        return tasks.filter((t) => t.assigned_to === "James Cole");
      case "week":
        return tasks.filter((t) => {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          return d >= now && d <= weekEnd;
        });
      case "overdue":
        return tasks.filter((t) => {
          if (!t.due_date || t.status === "done") return false;
          return new Date(t.due_date) < now;
        });
      default:
        return tasks;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, view]);

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const existing = map.get(t.project_id) ?? [];
      existing.push(t);
      map.set(t.project_id, existing);
    }
    return map;
  }, [filtered]);

  function getProject(id: string) {
    return projects.find((p) => p.id === id);
  }
  function getClient(clientId: string) {
    return clients.find((c) => c.id === clientId);
  }
  function getProduct(id: string | null) {
    if (!id) return null;
    return products.find((p) => p.id === id) ?? null;
  }

  const totalOpen = tasks.filter((t) => t.status !== "done").length;
  const totalOverdue = tasks.filter(
    (t) => t.due_date && t.status !== "done" && new Date(t.due_date) < now
  ).length;

  const VIEWS: { id: View; label: string; count?: number }[] = [
    { id: "all",     label: "All Tasks",      count: tasks.length },
    { id: "mine",    label: "My Tasks",       count: tasks.filter((t) => t.assigned_to === "James Cole").length },
    { id: "week",    label: "Due This Week",  count: tasks.filter((t) => { if (!t.due_date) return false; const d = new Date(t.due_date); return d >= now && d <= weekEnd; }).length },
    { id: "overdue", label: "Overdue",        count: totalOverdue },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Tasks</h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">
            {totalOpen} open · {totalOverdue > 0 && <span className="text-[var(--sa-danger)]">{totalOverdue} overdue</span>}
          </p>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 px-4 py-2 panel-border-b bg-[var(--sa-window)]">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition-colors",
              view === v.id
                ? "bg-[var(--sa-selected)] text-[var(--sa-accent)] font-medium"
                : "text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]"
            )}
          >
            {v.label}
            {v.count != null && v.count > 0 && (
              <span
                className={cn(
                  "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-medium leading-none",
                  v.id === "overdue" && v.count > 0
                    ? "bg-[var(--sa-danger)] text-white"
                    : "bg-[var(--sa-border-strong)] text-[var(--sa-text-secondary)]"
                )}
              >
                {v.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[var(--sa-window)] border-b border-[var(--sa-border)]">
        <div className="w-3.5 shrink-0" />
        <span className="flex-1 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Task</span>
        <span className="hidden xl:block w-44 shrink-0 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Notes</span>
        <span className="hidden lg:block w-28 shrink-0 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Product</span>
        <span className="hidden md:block w-24 shrink-0 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Assigned</span>
        <span className="w-16 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Due</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-[var(--sa-window)]">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CheckCircle2 size={32} strokeWidth={1.2} className="text-[var(--sa-text-tertiary)]" />
            <p className="text-[14px] text-[var(--sa-text-tertiary)]">No tasks in this view.</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([projectId, projectTasks]) => {
            const project = getProject(projectId);
            const client = project ? getClient(project.client_id) : null;
            return (
              <div key={projectId}>
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-1.5 bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
                  <span className="text-[11px] font-semibold text-[var(--sa-text-secondary)]">
                    {project?.name ?? projectId}
                  </span>
                  {client && (
                    <span className="text-[11px] text-[var(--sa-text-tertiary)]">· {client.name}</span>
                  )}
                  <span className="ml-auto text-[10px] text-[var(--sa-text-tertiary)]">
                    {projectTasks.filter((t) => t.status !== "done").length} open
                  </span>
                </div>
                {projectTasks.map((task) => {
                  const product = getProduct(task.product_id);
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      projectName={project?.name ?? ""}
                      clientName={client?.name ?? ""}
                      productName={product?.name ?? null}
                    />
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
