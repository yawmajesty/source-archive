"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Clock, AlertCircle, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
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

function AddTaskModal({ projects, products, onClose, defaultProjectId, defaultProductId }: {
  projects: Project[];
  products: Product[];
  onClose: () => void;
  defaultProjectId?: string;
  defaultProductId?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const assignedRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [productId, setProductId] = useState(defaultProductId ?? "");

  const projectProducts = products.filter((p) => p.project_id === projectId);

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

  async function handleSave() {
    const title = titleRef.current?.value.trim();
    if (!title) { setError("Title is required"); return; }
    if (!projectId) { setError("Collection is required"); return; }
    setSaving(true);
    setError("");
    const assigned = assignedRef.current?.value.trim() || "Unassigned";
    const initials = assigned.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const { error: err } = await supabase.from("tasks").insert({
      id: "task-" + Date.now(),
      project_id: projectId,
      product_id: productId || null,
      title,
      status,
      assigned_to: assigned,
      assigned_initials: initials,
      due_date: dueDateRef.current?.value || null,
      notes: notesRef.current?.value.trim() || "",
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sa-border)]">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Add Task</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={16} className="text-[var(--sa-text-tertiary)]" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className={labelCls}>Title *</label>
            <input ref={titleRef} autoFocus className={inputCls} placeholder="e.g. Send sample to client" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Collection *</label>
              <select className={inputCls} value={projectId} onChange={(e) => { setProjectId(e.target.value); setProductId(""); }}>
                <option value="">— Select —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Product (optional)</label>
              <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— None —</option>
                {projectProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as Task["status"])}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_client">Waiting: Client</option>
                <option value="waiting_factory">Waiting: Factory</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input ref={dueDateRef} type="date" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Assigned to</label>
            <input ref={assignedRef} className={inputCls} placeholder="Your name" />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea ref={notesRef} className={inputCls + " resize-none"} rows={2} placeholder="Optional notes…" />
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-[var(--sa-border)]">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            {saving ? "Saving…" : "Add Task"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function TasksClient({ tasks, projects, clients, products }: Props) {
  const [view, setView] = useState<View>("all");
  const [showAdd, setShowAdd] = useState(false);

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
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={13} strokeWidth={2.5} /> Add Task
        </button>
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

      <AnimatePresence>
        {showAdd && (
          <AddTaskModal
            projects={projects}
            products={products}
            onClose={() => setShowAdd(false)}
          />
        )}
      </AnimatePresence>

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
