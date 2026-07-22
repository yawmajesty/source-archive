"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ExternalLink, Trash2, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient as createClientAction, createProjectForClient, deleteClientCascade } from "./actions";
import type { Client, Project, Product } from "@/lib/data";

interface Props { clients: Client[]; projects: Project[]; products: Product[] }

const STATUS_COLORS: Record<Client["status"], string> = {
  active:     "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  onboarding: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  paused:     "bg-gray-100 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400",
};

function AddClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const industryRef = useRef<HTMLInputElement>(null);
  const contactNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSelectElement>(null);

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

  async function handleSave() {
    const name = nameRef.current?.value.trim();
    if (!name) { setError("Company name is required"); return; }
    setSaving(true);
    setError("");
    const id = "client-" + Date.now();
    const res = await createClientAction({
      id,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      industry: industryRef.current?.value.trim() || null,
      contact_name: contactNameRef.current?.value.trim() || null,
      contact_email: emailRef.current?.value.trim() || null,
      country: countryRef.current?.value.trim() || null,
      status: statusRef.current?.value || "onboarding",
      logo_initial: name[0].toUpperCase(),
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-xl p-6"
      >
        <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-4">Add new client</h2>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Company name *</label><input ref={nameRef} className={inputCls} placeholder="Acme Studio" /></div>
            <div><label className={labelCls}>Industry</label><input ref={industryRef} className={inputCls} placeholder="Fashion, Homeware…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Contact name</label><input ref={contactNameRef} className={inputCls} placeholder="Jane Smith" /></div>
            <div><label className={labelCls}>Contact email</label><input ref={emailRef} type="email" className={inputCls} placeholder="jane@company.com" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Country</label><input ref={countryRef} className={inputCls} placeholder="United Kingdom" /></div>
            <div>
              <label className={labelCls}>Status</label>
              <select ref={statusRef} className={inputCls}>
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Saving…" : "Add Client"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AddProjectModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const seasonRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const inputCls = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";
  const labelCls = "block text-[10px] uppercase tracking-wide font-semibold text-[var(--sa-text-tertiary)] mb-1";

  async function handleSave() {
    const name = nameRef.current?.value.trim();
    if (!name) { setError("Collection name is required"); return; }
    setSaving(true);
    setError("");
    const res = await createProjectForClient({
      client_id: clientId,
      name,
      season: seasonRef.current?.value.trim() || null,
      start_date: startRef.current?.value || new Date().toISOString().slice(0, 10),
      target_completion: targetRef.current?.value || null,
      notes: notesRef.current?.value.trim() || "",
    });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-xl p-6"
      >
        <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)] mb-4">Add new collection</h2>
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Collection name *</label><input ref={nameRef} className={inputCls} placeholder="SS26 Collection" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Season</label><input ref={seasonRef} className={inputCls} placeholder="SS26" /></div>
            <div><label className={labelCls}>Start date</label><input ref={startRef} type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          </div>
          <div><label className={labelCls}>Target completion</label><input ref={targetRef} type="date" className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><textarea ref={notesRef} className={inputCls + " resize-none"} rows={2} placeholder="Optional notes…" /></div>
          {error && <p className="text-[12px] text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--sa-accent)] py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60">
              {saving ? "Saving…" : "Add Collection"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteClientModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    const res = await deleteClientCascade(client.id);
    setDeleting(false);
    if (!res.success) { setError(res.error); return; }
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
        className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--sa-window)] border border-[var(--sa-border)] shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Delete client?</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--sa-hover)]"><X size={16} className="text-[var(--sa-text-tertiary)]" /></button>
        </div>
        <p className="text-[13px] text-[var(--sa-text-secondary)] mb-2">
          This will permanently delete <span className="font-semibold text-[var(--sa-text-primary)]">{client.name}</span> and all their collections and products.
        </p>
        <p className="text-[12px] text-[var(--sa-danger)] mb-4">This cannot be undone.</p>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--sa-border)] py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-[var(--sa-danger)] py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function ClientsListClient({ clients, projects, products }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [addProjectFor, setAddProjectFor] = useState<string | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  function getStats(clientId: string) {
    const clientProjects = projects.filter((p) => p.client_id === clientId);
    const projectIds = clientProjects.map((p) => p.id);
    const clientProducts = products.filter((p) => projectIds.includes(p.project_id));
    return {
      projects: clientProjects.filter((p) => p.status === "active").length,
      products: clientProducts.length,
    };
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Clients</h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{clients.length} clients</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={13} strokeWidth={2.5} /> Add Client
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 bg-[var(--sa-bg)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => {
            const stats = getStats(client.id);
            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 hover:border-[var(--sa-border-strong)] transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sa-accent)] text-white text-[16px] font-bold">
                      {client.logo_initial}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--sa-text-primary)]">{client.name}</p>
                      <p className="text-[11px] text-[var(--sa-text-tertiary)]">{client.industry} · {client.country}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize", STATUS_COLORS[client.status])}>
                    {client.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-lg bg-[var(--sa-bg)] p-2.5 text-center">
                    <p className="font-mono text-[16px] font-semibold text-[var(--sa-text-primary)]">{stats.projects}</p>
                    <p className="text-[10px] text-[var(--sa-text-tertiary)]">Active collections</p>
                  </div>
                  <div className="rounded-lg bg-[var(--sa-bg)] p-2.5 text-center">
                    <p className="font-mono text-[16px] font-semibold text-[var(--sa-text-primary)]">{stats.products}</p>
                    <p className="text-[10px] text-[var(--sa-text-tertiary)]">Products</p>
                  </div>
                </div>

                <div className="mb-4 text-[12px] text-[var(--sa-text-secondary)]">
                  <p className="font-medium text-[var(--sa-text-primary)]">{client.contact_name}</p>
                  <p className="truncate">{client.contact_email}</p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[var(--sa-border)]">
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex-1 rounded-lg bg-[var(--sa-selected)] py-1.5 text-center text-[12px] font-medium text-[var(--sa-accent)] hover:opacity-80 transition-opacity"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => setAddProjectFor(client.id)}
                    className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
                  >
                    <Plus size={11} strokeWidth={2.5} /> Collection
                  </button>
                  <Link
                    href={`/portal/${client.id}`}
                    className="flex items-center gap-1 rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
                    target="_blank"
                  >
                    <ExternalLink size={11} /> Portal
                  </Link>
                  <button
                    onClick={() => setDeleteClient(client)}
                    className="flex items-center justify-center rounded-lg border border-[var(--sa-border)] p-1.5 text-[var(--sa-text-tertiary)] hover:border-[var(--sa-danger)] hover:text-[var(--sa-danger)] transition-colors"
                    title="Delete client"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} />}
      {addProjectFor && (
        <AddProjectModal clientId={addProjectFor} onClose={() => setAddProjectFor(null)} />
      )}
      <AnimatePresence>
        {deleteClient && (
          <DeleteClientModal client={deleteClient} onClose={() => setDeleteClient(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
