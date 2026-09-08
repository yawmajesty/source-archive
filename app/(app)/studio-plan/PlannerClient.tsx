"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera, Megaphone, Plus, Trash2, Check, ChevronLeft, Save, Wand2, Calendar, X,
} from "lucide-react";
import {
  SHOOT_TYPES, SHOOT_STATUSES, REFERENCE_SLOTS, SLOT_LABEL, BRIEF_FIELDS,
  CREW_ROLES, PHASES, CHANNELS, CHANNEL_LABEL, EXTRA_SLOTS,
  ITEM_STATUSES, anglesFor,
  type ShootType, type Phase, type CrewMember,
} from "@/lib/shoots";
import {
  createShoot, updateShoot, deleteShoot, getShoot,
  addShot, updateShot, deleteShot,
  addReferences, deleteReference, updateReference, setShootProducts,
  importMoodboardReferences, listMoodboardImages, sendCallSheet, shareBriefWithClient,
  shootReadiness, type Readiness,
  saveAsTemplate, applyTemplate,
  createCampaign, updateCampaign, deleteCampaign, getCampaignItems,
  addCampaignItem, updateCampaignItem, deleteCampaignItem,
  type ShootRow, type ShotRow, type RefRow, type TemplateRow,
  type CampaignRow, type CampaignItemRow,
} from "./actions";
import { playsFor, EFFORT_LABEL, EFFORT_TONE, type Play } from "@/lib/campaign-plays";
import { STAGE_LABEL } from "@/lib/stages";
import { createUploadTicket } from "@/lib/storage-actions";
import { createClient as createSupabase } from "@supabase/supabase-js";

interface Named { id: string; name: string }
interface Project extends Named { client_id: string }
interface Product extends Named { project_id: string | null }

const CARD = "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]";
const INPUT =
  "w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";
const LABEL = "text-[11px] font-medium text-[var(--sa-text-secondary)]";

export function PlannerClient({
  shoots: initialShoots, campaigns: initialCampaigns, templates,
  clients, projects, products,
}: {
  shoots: ShootRow[];
  campaigns: CampaignRow[];
  templates: TemplateRow[];
  clients: Named[];
  projects: Project[];
  products: Product[];
}) {
  const [tab, setTab] = useState<"shoots" | "marketing">("shoots");
  const [shoots, setShoots] = useState(initialShoots);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [openShoot, setOpenShoot] = useState<string | null>(null);
  const [openCampaign, setOpenCampaign] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Unknown client";
  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? null : null);

  if (openShoot) {
    return (
      <ShootDetail
        shootId={openShoot}
        onBack={() => setOpenShoot(null)}
        onDeleted={(id) => { setShoots((s) => s.filter((x) => x.id !== id)); setOpenShoot(null); }}
        onRenamed={(id, title) => setShoots((s) => s.map((x) => (x.id === id ? { ...x, title } : x)))}
        templates={templates}
        products={products}
        projects={projects}
      />
    );
  }

  if (openCampaign) {
    const campaign = campaigns.find((c) => c.id === openCampaign);
    if (campaign) {
      return (
        <CampaignDetail
          campaign={campaign}
          onBack={() => setOpenCampaign(null)}
          onDeleted={(id) => { setCampaigns((c) => c.filter((x) => x.id !== id)); setOpenCampaign(null); }}
          onPatched={(id, patch) =>
            setCampaigns((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)))
          }
        />
      );
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--sa-border)] px-6 py-3">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Shoots &amp; Marketing</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            Brief a photographer, plan a drop.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["shoots", "marketing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] capitalize ${
                tab === t
                  ? "bg-[var(--sa-selected)] font-medium text-[var(--sa-accent)]"
                  : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              }`}
            >
              {t === "shoots" ? <Camera size={13} /> : <Megaphone size={13} />} {t}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="border-b border-[var(--sa-border)] px-6 py-2 text-[12.5px] text-red-500">{error}</p>}

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "shoots" ? (
          <ShootList
            shoots={shoots}
            clients={clients}
            projects={projects}
            clientName={clientName}
            projectName={projectName}
            onOpen={setOpenShoot}
            onCreated={(row) => setShoots((s) => [row, ...s])}
            onError={setError}
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            clients={clients}
            projects={projects}
            clientName={clientName}
            projectName={projectName}
            onOpen={setOpenCampaign}
            onCreated={(row) => setCampaigns((c) => [row, ...c])}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

// ── Shoots ──────────────────────────────────────────────────

function ShootList({
  shoots, clients, projects, clientName, projectName, onOpen, onCreated, onError,
}: {
  shoots: ShootRow[];
  clients: Named[];
  projects: Project[];
  clientName: (id: string) => string;
  projectName: (id: string | null) => string | null;
  onOpen: (id: string) => void;
  onCreated: (row: ShootRow) => void;
  onError: (e: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ clientId: "", projectId: "", title: "", shootType: "ecom" as ShootType });
  const forClient = projects.filter((p) => p.client_id === form.clientId);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center gap-2">
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
          {shoots.length} shoot{shoots.length === 1 ? "" : "s"}
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
        >
          <Plus size={13} /> New shoot
        </button>
      </div>

      {adding && (
        <div className={`${CARD} mb-4 p-4`}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Client</span>
              <select
                className={INPUT}
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value, projectId: "" })}
              >
                <option value="">Choose…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Collection (optional)</span>
              <select
                className={INPUT}
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                disabled={!form.clientId}
              >
                <option value="">Not tied to one</option>
                {forClient.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Name it</span>
              <input
                className={INPUT}
                placeholder="e.g. SS26 e-comm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Type</span>
              <select
                className={INPUT}
                value={form.shootType}
                onChange={(e) => setForm({ ...form, shootType: e.target.value as ShootType })}
              >
                {SHOOT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
            {SHOOT_TYPES.find((t) => t.id === form.shootType)?.hint} — the standard shot list comes with it.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={!form.clientId}
              onClick={async () => {
                const res = await createShoot({
                  clientId: form.clientId,
                  projectId: form.projectId || null,
                  title: form.title,
                  shootType: form.shootType,
                });
                if (!res.success) { onError(res.error); return; }
                onCreated({
                  id: res.id, client_id: form.clientId, project_id: form.projectId || null,
                  title: form.title || "Untitled shoot", shoot_type: form.shootType,
                  status: "planning", shoot_date: null, location: null,
                });
                setAdding(false);
                setForm({ clientId: "", projectId: "", title: "", shootType: "ecom" });
              }}
              className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
            >
              Create
            </button>
            <button onClick={() => setAdding(false)} className="text-[12.5px] text-[var(--sa-text-tertiary)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {shoots.length === 0 ? (
        <EmptyState
          icon={<Camera size={22} />}
          title="No shoots planned"
          body="A shoot here becomes the brief you hand a photographer — references, angles, model and hair, all in one place."
        />
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          {shoots.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--sa-hover)] ${
                i > 0 ? "border-t border-[var(--sa-border)]" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-[var(--sa-text-primary)]">
                  {s.title}
                </span>
                <span className="block truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                  {clientName(s.client_id)}
                  {projectName(s.project_id) ? ` · ${projectName(s.project_id)}` : ""} ·{" "}
                  {SHOOT_TYPES.find((t) => t.id === s.shoot_type)?.label ?? s.shoot_type}
                </span>
              </span>
              {s.shoot_date && (
                <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)]">
                  {new Date(s.shoot_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
              <span className="shrink-0 rounded bg-[var(--sa-hover)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--sa-text-secondary)]">
                {SHOOT_STATUSES.find((x) => x.id === s.status)?.label ?? s.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShootDetail({
  shootId, onBack, onDeleted, onRenamed, templates, products, projects,
}: {
  shootId: string;
  onBack: () => void;
  onDeleted: (id: string) => void;
  onRenamed: (id: string, title: string) => void;
  templates: TemplateRow[];
  products: Product[];
  projects: Project[];
}) {
  const [shoot, setShoot] = useState<ShootRow | null>(null);
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [refs, setRefs] = useState<RefRow[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [moodboardFor, setMoodboardFor] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    getShoot(shootId).then((d) => {
      if (!d) { setError("Shoot not found"); return; }
      setShoot(d.shoot); setShots(d.shots); setRefs(d.refs); setChosen(d.productIds);
    });
    shootReadiness(shootId).then(setReadiness);
  }, [shootId]);

  const inCollection = useMemo(() => {
    if (!shoot?.project_id) return products;
    return products.filter((p) => p.project_id === shoot.project_id);
  }, [products, shoot?.project_id]);

  function patch(p: Record<string, unknown>) {
    if (!shoot) return;
    setShoot({ ...shoot, ...p });
    void updateShoot(shoot.id, p);
    if (typeof p.title === "string") onRenamed(shoot.id, p.title);
  }

  async function uploadRefs(files: File[], slot: string) {
    if (files.length === 0 || !shoot) return;
    setUploadingSlot(slot); setError(null);
    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const done: Array<{ image_url: string; storage_path: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      const ticket = await createUploadTicket("shoot-media", `${shoot.id}/${Date.now()}-${i}-${f.name}`);
      if (ticket.error || !ticket.path || !ticket.token) { setError(ticket.error ?? "Upload refused"); continue; }
      const { error: upErr } = await supabase.storage
        .from("shoot-media").uploadToSignedUrl(ticket.path, ticket.token, f);
      if (upErr) { setError(upErr.message); continue; }
      const { data } = supabase.storage.from("shoot-media").getPublicUrl(ticket.path);
      done.push({ image_url: data.publicUrl, storage_path: ticket.path });
    }
    setUploadingSlot(null);
    if (done.length === 0) return;
    const res = await addReferences({ shootId: shoot.id, slot, items: done });
    if (!res.success) { setError(res.error); return; }
    setRefs((r) => [...r, ...res.refs]);
  }

  if (!shoot) {
    return <p className="p-6 text-[13px] text-[var(--sa-text-tertiary)]">{error ?? "Loading…"}</p>;
  }

  const bySlot = REFERENCE_SLOTS.map((s) => ({ ...s, images: refs.filter((r) => r.slot === s.id) }))
    .filter((s) => s.images.length > 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--sa-border)] px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1 text-[12.5px] text-[var(--sa-text-secondary)]">
          <ChevronLeft size={14} /> All shoots
        </button>
        <div className="flex-1" />
        <select
          className={`${INPUT} w-auto`}
          value={shoot.status}
          onChange={(e) => patch({ status: e.target.value })}
        >
          {SHOOT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button
          onClick={async () => {
            setError(null); setNotice(null);
            const res = await sendCallSheet(shoot.id);
            if (!res.success) { setError(res.error); return; }
            setNotice(
              res.sent > 0
                ? `Call sheet sent to ${res.sent} ${res.sent === 1 ? "person" : "people"}.`
                : "Recorded, but not delivered — email isn't switched on yet.",
            );
          }}
          className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
        >
          Send call sheet
        </button>
        {shoot.client_id ? (
          <button
            onClick={async () => {
              setError(null); setNotice(null);
              const res = await shareBriefWithClient(shoot.id);
              if (!res.success) { setError(res.error); return; }
              setNotice(
                res.status === "skipped"
                  ? "Shared. The email is recorded but not delivered — email isn't switched on yet."
                  : "Shared with the client.",
              );
            }}
            className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
          >
            Share with client
          </button>
        ) : null}
        <button
          onClick={async () => {
            if (!confirm("Delete this shoot and its brief?")) return;
            await deleteShoot(shoot.id);
            onDeleted(shoot.id);
          }}
          className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:border-red-300 hover:text-red-500"
        >
          Delete
        </button>
      </div>

      {(error || notice) && (
        <p
          className={`border-b border-[var(--sa-border)] px-6 py-2 text-[12.5px] ${
            error ? "text-red-500" : "text-[var(--sa-success)]"
          }`}
        >
          {error ?? notice}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {/* Header */}
          <div className={`${CARD} p-4`}>
            <input
              className="w-full border-0 bg-transparent p-0 text-[20px] font-semibold tracking-tight text-[var(--sa-text-primary)] outline-none"
              value={shoot.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <label className="block">
                <span className={LABEL}>Date</span>
                <input type="date" className={INPUT} value={shoot.shoot_date ?? ""}
                  onChange={(e) => patch({ shoot_date: e.target.value || null })} />
              </label>
              <label className="block">
                <span className={LABEL}>Call time</span>
                <input className={INPUT} placeholder="08:00" value={(shoot.call_time as string) ?? ""}
                  onChange={(e) => patch({ call_time: e.target.value })} />
              </label>
              <label className="block sm:col-span-2">
                <span className={LABEL}>Location</span>
                <input className={INPUT} placeholder="Studio, address" value={shoot.location ?? ""}
                  onChange={(e) => patch({ location: e.target.value })} />
              </label>
            </div>
          </div>

          {/* Templates */}
          <div className={`${CARD} flex flex-wrap items-center gap-2 p-3`}>
            <Wand2 size={14} className="text-[var(--sa-text-tertiary)]" />
            <span className="text-[12.5px] text-[var(--sa-text-secondary)]">Templates</span>
            {templates.length > 0 && (
              <select
                className={`${INPUT} w-auto`}
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  if (!confirm("Apply this template? It replaces the brief and the shot list.")) return;
                  const res = await applyTemplate(shoot.id, e.target.value);
                  if (!res.success) { setError(res.error); return; }
                  const d = await getShoot(shoot.id);
                  if (d) { setShoot(d.shoot); setShots(d.shots); setRefs(d.refs); }
                  e.target.value = "";
                }}
              >
                <option value="">Apply one…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.category ? ` · ${t.category}` : ""}</option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            <input
              className={`${INPUT} w-40`}
              placeholder="Save as…"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <button
              disabled={!templateName.trim() || saving}
              onClick={async () => {
                setSaving(true);
                const res = await saveAsTemplate({ shootId: shoot.id, name: templateName });
                setSaving(false);
                if (!res.success) { setError(res.error); return; }
                setTemplateName("");
              }}
              className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] disabled:opacity-40"
            >
              <Save size={12} /> Save
            </button>
          </div>

          {/* The brief — words and pictures for each section together */}
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">The brief</p>
            {BRIEF_FIELDS.map((f) => (
              <BriefSection
                key={f.key}
                field={f}
                value={(shoot[f.key] as string) ?? ""}
                refs={refs.filter((r) => r.slot === f.slot)}
                uploading={uploadingSlot === f.slot}
                onText={(v) => patch({ [f.key]: v || null })}
                onUpload={(files) => uploadRefs(files, f.slot)}
                onCaption={(id, note) => {
                  setRefs((p) => p.map((r) => (r.id === id ? { ...r, note } : r)));
                  void updateReference(id, note);
                }}
                onRemove={async (id) => { setRefs((p) => p.filter((r) => r.id !== id)); await deleteReference(id); }}
                onFromMoodboard={shoot.client_id ? () => setMoodboardFor(f.slot) : undefined}
              />
            ))}

            {EXTRA_SLOTS.map((slotId) => {
              const spec = REFERENCE_SLOTS.find((r) => r.id === slotId);
              if (!spec) return null;
              return (
                <BriefSection
                  key={slotId}
                  field={{ key: slotId, label: spec.label, hint: spec.hint, slot: slotId }}
                  value={null}
                  refs={refs.filter((r) => r.slot === slotId)}
                  uploading={uploadingSlot === slotId}
                  onText={() => {}}
                  onUpload={(files) => uploadRefs(files, slotId)}
                  onCaption={(id, note) => {
                    setRefs((p) => p.map((r) => (r.id === id ? { ...r, note } : r)));
                    void updateReference(id, note);
                  }}
                  onRemove={async (id) => { setRefs((p) => p.filter((r) => r.id !== id)); await deleteReference(id); }}
                  onFromMoodboard={shoot.client_id ? () => setMoodboardFor(slotId) : undefined}
                />
              );
            })}
          </div>

          {moodboardFor && shoot.client_id && (
            <MoodboardPicker
              clientId={shoot.client_id as string}
              slot={moodboardFor}
              onClose={() => setMoodboardFor(null)}
              onImport={async (ids) => {
                const res = await importMoodboardReferences({
                  shootId: shoot.id, clientId: shoot.client_id as string,
                  slot: moodboardFor, itemIds: ids,
                });
                if (!res.success) { setError(res.error); return; }
                setRefs((p) => [...p, ...res.refs]);
                setMoodboardFor(null);
              }}
            />
          )}

          {/* Crew */}
          <CrewPanel crew={(shoot.crew as CrewMember[]) ?? []} onChange={(crew) => patch({ crew })} />

          {/* Products */}
          <div className={`${CARD} p-4`}>
            <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">What's being shot</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
              {shoot.project_id ? "Products in this collection." : "Every product for this client."}
            </p>
            {readiness.some((r) => !r.ready) && (
              <div className="mt-2 rounded-lg p-2.5" style={{ background: "rgba(255,149,0,0.10)" }}>
                <p className="text-[12px] font-medium" style={{ color: "var(--sa-warning)" }}>
                  {readiness.filter((r) => !r.ready).length} sample
                  {readiness.filter((r) => !r.ready).length === 1 ? "" : "s"} may not be ready
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--sa-text-secondary)]">
                  {readiness.filter((r) => !r.ready).map((r) => `${r.name} (${STAGE_LABEL[r.stage ?? ""] ?? "no stage"})`).join(", ")}
                  . A sample that doesn&apos;t arrive is the commonest reason a shoot moves.
                </p>
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {inCollection.length === 0 && (
                <p className="text-[12px] text-[var(--sa-text-tertiary)]">No products to choose from yet.</p>
              )}
              {inCollection.map((p) => {
                const on = chosen.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      const next = on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id];
                      setChosen(next);
                      void setShootProducts(shoot.id, next);
                    }}
                    className={`rounded-md border px-2 py-1 text-[12px] ${
                      on
                        ? "border-transparent bg-[var(--sa-selected)] font-medium text-[var(--sa-accent)]"
                        : "border-[var(--sa-border)] text-[var(--sa-text-secondary)]"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shot list */}
          <div className={`${CARD} p-4`}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Shot list</p>
              <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                {shots.filter((s) => s.done).length} of {shots.length} done
              </span>
              <div className="flex-1" />
              <button
                onClick={async () => {
                  const res = await addShot({ shootId: shoot.id, angle: "", position: shots.length });
                  if (!res.success) { setError(res.error); return; }
                  setShots((s) => [...s, res.shot]);
                }}
                className="flex items-center gap-1 text-[12px] font-medium text-[var(--sa-accent)]"
              >
                <Plus size={11} /> Add a shot
              </button>
            </div>

            {shots.length === 0 && (
              <p className="text-[12px] text-[var(--sa-text-tertiary)]">
                Nothing listed. The standard list for a {SHOOT_TYPES.find((t) => t.id === shoot.shoot_type)?.label.toLowerCase()} shoot has{" "}
                {anglesFor(shoot.shoot_type as ShootType).length} shots in it.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              {shots.map((s) => (
                <div key={s.id} className="group flex items-start gap-2 rounded-lg border border-[var(--sa-border)] p-2">
                  <button
                    onClick={() => {
                      setShots((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)));
                      void updateShot(s.id, { done: !s.done });
                    }}
                    aria-label={s.done ? "Mark not done" : "Mark done"}
                    className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                    style={{
                      borderColor: s.done ? "var(--sa-accent)" : "var(--sa-border-strong)",
                      background: s.done ? "var(--sa-accent)" : "transparent",
                    }}
                  >
                    {s.done && <Check size={10} color="#fff" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--sa-text-primary)] outline-none"
                      placeholder="Angle or shot"
                      defaultValue={s.angle}
                      onBlur={(e) => void updateShot(s.id, { angle: e.target.value })}
                    />
                    <input
                      className="w-full border-0 bg-transparent p-0 text-[11.5px] text-[var(--sa-text-tertiary)] outline-none"
                      placeholder="What it should show"
                      defaultValue={s.description ?? ""}
                      onBlur={(e) => void updateShot(s.id, { description: e.target.value })}
                    />
                    <input
                      className="mt-0.5 w-full border-0 bg-transparent p-0 text-[11px] text-[var(--sa-accent)] outline-none"
                      placeholder="Reference image URL (optional)"
                      defaultValue={s.reference_url ?? ""}
                      onBlur={(e) => void updateShot(s.id, { reference_url: e.target.value || null })}
                    />
                  </div>

                  <select
                    className="shrink-0 rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-1.5 py-1 text-[11px] text-[var(--sa-text-secondary)]"
                    defaultValue={s.medium}
                    onChange={(e) => void updateShot(s.id, { medium: e.target.value })}
                  >
                    <option value="photo">Photo</option>
                    <option value="video">Video</option>
                  </select>

                  <button
                    onClick={async () => { setShots((p) => p.filter((x) => x.id !== s.id)); await deleteShot(s.id); }}
                    aria-label="Remove shot"
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  >
                    <Trash2 size={12} className="text-[var(--sa-text-tertiary)]" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/**
 * One part of the brief: the paragraph and the pictures for it, together.
 *
 * Every image gets a caption box underneath. An unlabelled reference is
 * ambiguous by default — a photographer can't tell whether you pinned it
 * for the hair, the light or the colour, and will pick wrong.
 */
function BriefSection({
  field, value, refs, uploading, onText, onUpload, onCaption, onRemove, onFromMoodboard,
}: {
  field: { key: string; label: string; hint: string; slot: string; long?: boolean };
  value: string | null;
  refs: RefRow[];
  uploading: boolean;
  onText: (v: string) => void;
  onUpload: (files: File[]) => void;
  onCaption: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onFromMoodboard?: () => void;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-[12.5px] font-semibold text-[var(--sa-text-primary)]">{field.label}</p>
        <p className="min-w-0 flex-1 text-[11px] text-[var(--sa-text-tertiary)]">{field.hint}</p>
        {onFromMoodboard && (
          <button
            onClick={onFromMoodboard}
            className="shrink-0 text-[11.5px] font-medium text-[var(--sa-accent)]"
          >
            From moodboard
          </button>
        )}
        <label className="shrink-0 cursor-pointer text-[11.5px] font-medium text-[var(--sa-accent)]">
          {uploading ? "Uploading…" : "Add photos"}
          <input
            type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { onUpload(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
        </label>
      </div>

      {value !== null && (
        <textarea
          className={`${INPUT} mt-2 resize-y`}
          rows={field.long ? 3 : 2}
          placeholder="Write it out"
          defaultValue={value}
          onBlur={(e) => onText(e.target.value)}
        />
      )}

      {refs.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {refs.map((r) => (
            <div key={r.id} className="group w-[124px]">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image_url}
                  alt={r.note ?? field.label}
                  className="h-[124px] w-[124px] rounded-lg object-cover"
                />
                <button
                  onClick={() => onRemove(r.id)}
                  aria-label="Remove"
                  className="absolute right-1 top-1 rounded bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 size={10} color="#fff" />
                </button>
              </div>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-[11px] leading-snug text-[var(--sa-text-secondary)] outline-none placeholder:text-[var(--sa-text-tertiary)]"
                placeholder="What's this showing?"
                defaultValue={r.note ?? ""}
                onBlur={(e) => onCaption(r.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pick images the client already put on their moodboard. */
function MoodboardPicker({
  clientId, slot, onClose, onImport,
}: {
  clientId: string;
  slot: string;
  onClose: () => void;
  onImport: (ids: string[]) => Promise<void>;
}) {
  const [images, setImages] = useState<Array<{ id: string; image_url: string; caption: string | null }>>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listMoodboardImages(clientId).then((i) => { setImages(i); setLoading(false); });
  }, [clientId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose} role="presentation">
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-[var(--sa-window)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
          <p className="flex-1 text-[14px] font-semibold text-[var(--sa-text-primary)]">
            From the moodboard → {SLOT_LABEL[slot] ?? slot}
          </p>
          <button onClick={onClose} aria-label="Close" className="text-[var(--sa-text-tertiary)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">Loading…</p>
          ) : images.length === 0 ? (
            <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">
              Nothing on their moodboard yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {images.map((i) => {
                const on = chosen.includes(i.id);
                return (
                  <button
                    key={i.id}
                    onClick={() => setChosen(on ? chosen.filter((x) => x !== i.id) : [...chosen, i.id])}
                    className={`relative h-[104px] w-[104px] overflow-hidden rounded-lg ${
                      on ? "ring-2 ring-[var(--sa-accent)] ring-offset-2" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i.image_url} alt={i.caption ?? "Moodboard image"} className="h-full w-full object-cover" />
                    {on && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sa-accent)]">
                        <Check size={10} color="#fff" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--sa-border)] px-4 py-3">
          <button
            disabled={chosen.length === 0 || busy}
            onClick={async () => { setBusy(true); await onImport(chosen); setBusy(false); }}
            className="rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {busy ? "Adding…" : `Add ${chosen.length || ""}`.trim()}
          </button>
          <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            Their captions come across with them.
          </span>
        </div>
      </div>
    </div>
  );
}

function CrewPanel({ crew, onChange }: { crew: CrewMember[]; onChange: (c: CrewMember[]) => void }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Crew</p>
        <div className="flex-1" />
        <button
          onClick={() => onChange([...crew, { role: CREW_ROLES[0], name: "" }])}
          className="flex items-center gap-1 text-[12px] font-medium text-[var(--sa-accent)]"
        >
          <Plus size={11} /> Add
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {crew.length === 0 && (
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">Nobody booked yet.</p>
        )}
        {crew.map((m, i) => (
          <div key={i} className="flex gap-1.5">
            <select
              className={`${INPUT} w-36`}
              value={m.role}
              onChange={(e) => onChange(crew.map((x, n) => (n === i ? { ...x, role: e.target.value } : x)))}
            >
              {CREW_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              className={INPUT}
              placeholder="Name"
              value={m.name}
              onChange={(e) => onChange(crew.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              className={INPUT}
              placeholder="Email or phone"
              value={m.contact ?? ""}
              onChange={(e) => onChange(crew.map((x, n) => (n === i ? { ...x, contact: e.target.value } : x)))}
            />
            <button
              onClick={() => onChange(crew.filter((_, n) => n !== i))}
              aria-label="Remove"
              className="shrink-0 px-1 text-[var(--sa-text-tertiary)] hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Marketing ───────────────────────────────────────────────

function CampaignList({
  campaigns, clients, projects, clientName, projectName, onOpen, onCreated, onError,
}: {
  campaigns: CampaignRow[];
  clients: Named[];
  projects: Project[];
  clientName: (id: string) => string;
  projectName: (id: string | null) => string | null;
  onOpen: (id: string) => void;
  onCreated: (row: CampaignRow) => void;
  onError: (e: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    clientId: "", projectId: "", name: "",
    kind: "collection" as "collection" | "always_on", launchDate: "",
  });
  const forClient = projects.filter((p) => p.client_id === form.clientId);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center gap-2">
        <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
          {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"}
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
        >
          <Plus size={13} /> New campaign
        </button>
      </div>

      {adding && (
        <div className={`${CARD} mb-4 p-4`}>
          <div className="mb-2 flex gap-2">
            {(["collection", "always_on"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setForm({ ...form, kind: k })}
                className={`flex-1 rounded-lg border p-2.5 text-left ${
                  form.kind === k ? "border-[var(--sa-accent)] bg-[var(--sa-selected)]" : "border-[var(--sa-border)]"
                }`}
              >
                <span className="block text-[12.5px] font-medium text-[var(--sa-text-primary)]">
                  {k === "collection" ? "A drop" : "Always on"}
                </span>
                <span className="block text-[11px] text-[var(--sa-text-tertiary)]">
                  {k === "collection"
                    ? "Tied to a collection, built round a launch date"
                    : "The ongoing feed that runs between launches"}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Client</span>
              <select className={INPUT} value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value, projectId: "" })}>
                <option value="">Choose…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {form.kind === "collection" && (
              <label className="block">
                <span className={LABEL}>Collection</span>
                <select className={INPUT} value={form.projectId} disabled={!form.clientId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">Choose…</option>
                  {forClient.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className={LABEL}>Name</span>
              <input className={INPUT} placeholder="e.g. SS26 launch" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            {form.kind === "collection" && (
              <label className="block">
                <span className={LABEL}>Launch date</span>
                <input type="date" className={INPUT} value={form.launchDate}
                  onChange={(e) => setForm({ ...form, launchDate: e.target.value })} />
              </label>
            )}
          </div>

          <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
            {form.kind === "collection"
              ? "Comes with a full plan already dated from your launch — teaser, pre-drop, launch week, post-launch and remarketing."
              : "Comes with a weekly rhythm you can edit."}
          </p>

          <div className="mt-3 flex gap-2">
            <button
              disabled={!form.clientId}
              onClick={async () => {
                const res = await createCampaign({
                  clientId: form.clientId,
                  projectId: form.projectId || null,
                  name: form.name,
                  kind: form.kind,
                  launchDate: form.launchDate || null,
                });
                if (!res.success) { onError(res.error); return; }
                onCreated({
                  id: res.id, client_id: form.clientId,
                  project_id: form.kind === "always_on" ? null : form.projectId || null,
                  name: form.name || "Untitled campaign", kind: form.kind,
                  launch_date: form.launchDate || null,
                  objective: null, audience: null, notes: null,
                });
                setAdding(false);
                setForm({ clientId: "", projectId: "", name: "", kind: "collection", launchDate: "" });
              }}
              className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
            >
              Create
            </button>
            <button onClick={() => setAdding(false)} className="text-[12.5px] text-[var(--sa-text-tertiary)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={22} />}
          title="Nothing planned"
          body="A campaign lays a drop out across teaser, pre-drop, launch week, post-launch and remarketing — dated from the day it lands."
        />
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          {campaigns.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--sa-hover)] ${
                i > 0 ? "border-t border-[var(--sa-border)]" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-[var(--sa-text-primary)]">
                  {c.name}
                </span>
                <span className="block truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                  {clientName(c.client_id)}
                  {projectName(c.project_id) ? ` · ${projectName(c.project_id)}` : ""}
                  {c.kind === "always_on" ? " · Always on" : ""}
                </span>
              </span>
              {c.launch_date && (
                <span className="flex shrink-0 items-center gap-1 text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)]">
                  <Calendar size={11} />
                  {new Date(c.launch_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CampaignDetail({
  campaign, onBack, onDeleted, onPatched,
}: {
  campaign: CampaignRow;
  onBack: () => void;
  onDeleted: (id: string) => void;
  onPatched: (id: string, patch: Partial<CampaignRow>) => void;
}) {
  const [items, setItems] = useState<CampaignItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<Phase | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [launchDate, setLaunchDate] = useState(campaign.launch_date ?? "");

  useEffect(() => {
    getCampaignItems(campaign.id).then((i) => { setItems(i); setLoading(false); });
  }, [campaign.id]);

  const phases = campaign.kind === "always_on"
    ? PHASES.filter((p) => p.id === "always_on")
    : PHASES.filter((p) => p.id !== "always_on");

  async function addPlay(phase: Phase, play: Play) {
    const res = await addCampaignItem({
      campaignId: campaign.id, phase, channel: play.channels[0] ?? "instagram",
      title: play.title, position: items.filter((i) => i.phase === phase).length,
    });
    if (!res.success) return;
    // The brief comes with the play, so a picked card arrives explained
    // rather than as an empty title someone has to remember the point of.
    const due = phaseDateFor(launchDate, phase);
    await updateCampaignItem(res.item.id, { brief: play.what, due_date: due });
    setItems((p) => [...p, { ...res.item, brief: play.what, due_date: due }]);
  }

  function phaseDateFor(date: string, phase: Phase): string | null {
    const spec = PHASES.find((p) => p.id === phase);
    if (!date || !spec || spec.offsetDays == null) return null;
    const d = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + spec.offsetDays);
    return d.toISOString().slice(0, 10);
  }

  const done = items.filter((i) => i.status === "done" || i.status === "live").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--sa-border)] px-6 py-3">
        <button onClick={onBack} className="flex items-center gap-1 text-[12.5px] text-[var(--sa-text-secondary)]">
          <ChevronLeft size={14} /> All campaigns
        </button>
        <div className="flex-1" />
        <span className="text-[12px] text-[var(--sa-text-tertiary)]">
          {done} of {items.length} out the door
        </span>
        <button
          onClick={async () => {
            if (!confirm("Delete this campaign and everything in it?")) return;
            await deleteCampaign(campaign.id);
            onDeleted(campaign.id);
          }}
          className="rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:border-red-300 hover:text-red-500"
        >
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="border-b border-[var(--sa-border)] px-6 py-4">
          <input
            className="w-full border-0 bg-transparent p-0 text-[22px] font-semibold tracking-tight text-[var(--sa-text-primary)] outline-none"
            defaultValue={campaign.name}
            onBlur={(e) => { onPatched(campaign.id, { name: e.target.value }); void updateCampaign(campaign.id, { name: e.target.value }); }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {campaign.kind !== "always_on" && (
              <label className="flex items-center gap-1.5">
                <Calendar size={13} className="text-[var(--sa-text-tertiary)]" />
                <span className="text-[12px] text-[var(--sa-text-tertiary)]">Drops</span>
                <input
                  type="date"
                  className="rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1 text-[12.5px] text-[var(--sa-text-primary)] outline-none"
                  value={launchDate}
                  onChange={(e) => {
                    setLaunchDate(e.target.value);
                    void updateCampaign(campaign.id, { launch_date: e.target.value || null });
                  }}
                />
              </label>
            )}
            <input
              className="min-w-[200px] flex-1 rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1 text-[12.5px] text-[var(--sa-text-primary)] outline-none"
              placeholder="Who it's for"
              defaultValue={campaign.audience ?? ""}
              onBlur={(e) => void updateCampaign(campaign.id, { audience: e.target.value })}
            />
          </div>
        </div>

        {/* The board */}
        {loading ? (
          <p className="p-6 text-[13px] text-[var(--sa-text-tertiary)]">Loading the plan…</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto p-6">
            {phases.map((phase) => {
              const rows = items.filter((i) => i.phase === phase.id);
              const date = phaseDateFor(launchDate, phase.id as Phase);
              return (
                <div key={phase.id} className="flex w-[290px] shrink-0 flex-col">
                  {/* Phase header */}
                  <div className="rounded-t-xl px-3 py-2.5" style={{ background: phase.tone }}>
                    <div className="flex items-baseline gap-2">
                      <p className="text-[13px] font-semibold text-white">{phase.label}</p>
                      <div className="flex-1" />
                      {date && (
                        <span className="text-[11px] tabular-nums text-white/80">
                          {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/85">{phase.hint}</p>
                  </div>

                  {/* Cards */}
                  <div
                    className="flex flex-1 flex-col gap-2 rounded-b-xl border border-t-0 border-[var(--sa-border)] bg-[var(--sa-bg)] p-2"
                    style={{ minHeight: 200 }}
                  >
                    {rows.map((it) => (
                      <div
                        key={it.id}
                        className="group rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-2.5 shadow-sm"
                      >
                        <div className="flex items-start gap-1.5">
                          <input
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12.5px] font-medium text-[var(--sa-text-primary)] outline-none"
                            defaultValue={it.title}
                            placeholder="What goes out"
                            onBlur={(e) => void updateCampaignItem(it.id, { title: e.target.value })}
                          />
                          <button
                            onClick={async () => {
                              setItems((p) => p.filter((x) => x.id !== it.id));
                              await deleteCampaignItem(it.id);
                            }}
                            aria-label="Remove"
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                          >
                            <Trash2 size={11} className="text-[var(--sa-text-tertiary)]" />
                          </button>
                        </div>

                        {it.brief && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--sa-text-tertiary)]">
                            {it.brief}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <select
                            className="rounded border-0 bg-[var(--sa-selected)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--sa-accent)] outline-none"
                            defaultValue={it.channel}
                            onChange={(e) => void updateCampaignItem(it.id, { channel: e.target.value })}
                          >
                            {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                          <select
                            className="rounded border-0 bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10.5px] text-[var(--sa-text-secondary)] outline-none"
                            defaultValue={it.status}
                            onChange={(e) => void updateCampaignItem(it.id, { status: e.target.value })}
                          >
                            {ITEM_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                          </select>
                          <button
                            onClick={() => setOpenItem(openItem === it.id ? null : it.id)}
                            className="text-[10.5px] text-[var(--sa-text-tertiary)] underline"
                          >
                            {openItem === it.id ? "less" : "more"}
                          </button>
                        </div>

                        {openItem === it.id && (
                          <div className="mt-2 flex flex-col gap-1.5 border-t border-[var(--sa-border)] pt-2">
                            <textarea
                              className="w-full resize-y rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] p-1.5 text-[11.5px] text-[var(--sa-text-primary)] outline-none"
                              rows={3}
                              placeholder="The brief"
                              defaultValue={it.brief ?? ""}
                              onBlur={(e) => void updateCampaignItem(it.id, { brief: e.target.value })}
                            />
                            <div className="flex gap-1.5">
                              <input
                                type="date"
                                className="flex-1 rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-1.5 py-1 text-[11px] text-[var(--sa-text-secondary)] outline-none"
                                defaultValue={it.due_date ?? ""}
                                onChange={(e) => void updateCampaignItem(it.id, { due_date: e.target.value || null })}
                              />
                              <input
                                className="flex-1 rounded border border-[var(--sa-border)] bg-[var(--sa-bg)] px-1.5 py-1 text-[11px] text-[var(--sa-text-secondary)] outline-none"
                                placeholder="Who's on it"
                                defaultValue={it.owner ?? ""}
                                onBlur={(e) => void updateCampaignItem(it.id, { owner: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => setPicking(phase.id as Phase)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--sa-border-strong)] py-2.5 text-[12px] font-medium text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)] hover:text-[var(--sa-accent)]"
                    >
                      <Plus size={12} /> Add from ideas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {picking && (
        <PlayPicker
          phase={picking}
          used={items.filter((i) => i.phase === picking).map((i) => i.title)}
          onClose={() => setPicking(null)}
          onPick={async (play) => { await addPlay(picking, play); }}
        />
      )}
    </div>
  );
}

/**
 * The idea picker.
 *
 * Every play carries the reason it works, not just its name. Someone who
 * understands why can adapt it; someone with only a title copies it
 * badly. That reasoning is the difference between a guided builder and a
 * list of buzzwords.
 */
function PlayPicker({
  phase, used, onClose, onPick,
}: {
  phase: Phase;
  used: string[];
  onClose: () => void;
  onPick: (play: Play) => Promise<void>;
}) {
  const spec = PHASES.find((p) => p.id === phase);
  const plays = playsFor(phase);
  const [added, setAdded] = useState<string[]>([]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl bg-[var(--sa-window)] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-4 py-3" style={{ background: spec?.tone }}>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white">{spec?.label} ideas</p>
            <p className="mt-0.5 text-[11.5px] text-white/85">{spec?.hint}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-white/80 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {plays.map((play) => {
              const already = used.includes(play.title) || added.includes(play.id);
              return (
                <button
                  key={play.id}
                  disabled={already}
                  onClick={async () => { setAdded((a) => [...a, play.id]); await onPick(play); }}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    already
                      ? "border-[var(--sa-border)] opacity-50"
                      : "border-[var(--sa-border)] hover:border-[var(--sa-accent)] hover:bg-[var(--sa-hover)]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--sa-text-primary)]">
                      {play.title}
                    </p>
                    {already ? (
                      <Check size={13} className="shrink-0 text-[var(--sa-success)]" />
                    ) : (
                      <Plus size={13} className="shrink-0 text-[var(--sa-text-tertiary)]" />
                    )}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-[var(--sa-text-secondary)]">{play.what}</p>
                  <p className="mt-1.5 text-[11px] italic leading-snug text-[var(--sa-text-tertiary)]">
                    {play.why}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {play.channels.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-[var(--sa-selected)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--sa-accent)]"
                      >
                        {CHANNEL_LABEL[c] ?? c}
                      </span>
                    ))}
                    <span className="rounded bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] text-[var(--sa-text-secondary)]">
                      {play.format}
                    </span>
                    <div className="flex-1" />
                    <span className="text-[10px] font-medium" style={{ color: EFFORT_TONE[play.effort] }}>
                      {EFFORT_LABEL[play.effort]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--sa-border)] px-4 py-2.5">
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            Pick as many as you want — each one arrives with its brief already written. You can edit
            everything afterwards.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <span className="text-[var(--sa-text-tertiary)]">{icon}</span>
      <p className="mt-2.5 text-[13px] font-medium text-[var(--sa-text-primary)]">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">{body}</p>
    </div>
  );
}
