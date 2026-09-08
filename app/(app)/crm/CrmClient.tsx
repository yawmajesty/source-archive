"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Phone, Mail, MessageSquare, FileText, Users, Package, Eye, Send,
  Sparkles, Plus, Trash2, CalendarClock, X,
} from "lucide-react";
import {
  ATTENTION_STYLE, TOUCHPOINT_KINDS,
  type ClientCrmSummary, type ClientContact, type TimelineItem,
  type TouchpointKind, type TouchpointDirection,
} from "@/lib/crm";
import {
  getClientTimeline, getClientContacts, logTouchpoint, deleteTouchpoint,
  setFollowUp, saveContact, deleteContact, emailClient, saveCrmNotes,
} from "./actions";
import { draftFollowUp, summariseRelationship } from "./ai-actions";

const CARD = "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]";
const INPUT =
  "w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";

const SOURCE_ICON: Record<string, React.ElementType> = {
  touchpoint: MessageSquare,
  email: Mail,
  stage: Package,
  portal: Eye,
};

const KIND_ICON: Record<string, React.ElementType> = {
  call: Phone,
  meeting: Users,
  note: FileText,
  whatsapp: MessageSquare,
  email: Mail,
};

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function CrmClient({ clients }: { clients: ClientCrmSummary[] }) {
  const [activeId, setActiveId] = useState<string | null>(clients[0]?.id ?? null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [busyAi, setBusyAi] = useState<"summary" | "draft" | null>(null);
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [logging, setLogging] = useState(false);
  const [, startTransition] = useTransition();

  const active = clients.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    setSummary(null);
    setError(null);
    setNotice(null);
    Promise.all([getClientTimeline(activeId), getClientContacts(activeId)])
      .then(([t, c]) => { setTimeline(t); setContacts(c); })
      .catch(() => setError("Couldn't load this client's history"))
      .finally(() => setLoading(false));
  }, [activeId]);

  async function refreshTimeline() {
    if (!activeId) return;
    setTimeline(await getClientTimeline(activeId));
  }

  async function runSummary() {
    if (!activeId) return;
    setBusyAi("summary"); setError(null);
    const res = await summariseRelationship(activeId);
    setBusyAi(null);
    if (!res.success) { setError(res.error); return; }
    setSummary(res.text);
  }

  async function runDraft() {
    if (!activeId || !active) return;
    setBusyAi("draft"); setError(null);
    const res = await draftFollowUp(activeId);
    setBusyAi(null);
    if (!res.success) { setError(res.error); return; }
    const to = contacts.find((c) => c.is_primary && c.email)?.email
      ?? contacts.find((c) => c.email)?.email
      ?? active.contactEmail
      ?? "";
    setCompose({ to, subject: res.subject, body: res.body });
  }

  function openCompose() {
    if (!active) return;
    const to = contacts.find((c) => c.is_primary && c.email)?.email
      ?? contacts.find((c) => c.email)?.email
      ?? active.contactEmail
      ?? "";
    setCompose({ to, subject: "", body: "" });
  }

  async function send() {
    if (!compose || !activeId) return;
    setError(null);
    const res = await emailClient({
      clientId: activeId, to: compose.to, subject: compose.subject, body: compose.body,
    });
    if (!res.success) { setError(res.error); return; }
    setCompose(null);
    setNotice(
      res.status === "skipped"
        ? "Recorded, but not delivered — email isn't switched on yet. It's in the Emails log."
        : "Sent.",
    );
    await refreshTimeline();
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Who needs attention ─────────────────── */}
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-r border-[var(--sa-border)]">
        <div className="border-b border-[var(--sa-border)] px-4 py-3">
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">CRM</h1>
          <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            Sorted by who needs hearing from.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {clients.length === 0 && (
            <p className="p-3 text-[12.5px] text-[var(--sa-text-tertiary)]">No clients yet.</p>
          )}
          {clients.map((c) => {
            const s = ATTENTION_STYLE[c.attention];
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`mb-0.5 flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left ${
                  c.id === activeId ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      c.id === activeId ? "font-medium text-[var(--sa-accent)]" : "text-[var(--sa-text-primary)]"
                    }`}
                  >
                    {c.name}
                  </span>
                  {c.attention !== "fine" && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: s.bg, color: s.fg }}
                    >
                      {s.label}
                    </span>
                  )}
                </span>
                <span className="truncate text-[11px] text-[var(--sa-text-tertiary)]">{c.reason}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── The relationship ────────────────────── */}
      {!active ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-[var(--sa-text-tertiary)]">Pick a client.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--sa-border)] px-6 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-[var(--sa-text-primary)]">
                {active.name}
              </h2>
              <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                {active.reason} · {active.productCount} product{active.productCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex-1" />
            <button
              onClick={runSummary}
              disabled={busyAi !== null}
              className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
            >
              <Sparkles size={13} /> {busyAi === "summary" ? "Reading…" : "Where do things stand?"}
            </button>
            <button
              onClick={runDraft}
              disabled={busyAi !== null}
              className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-50"
            >
              <Sparkles size={13} /> {busyAi === "draft" ? "Writing…" : "Draft a follow-up"}
            </button>
            <button
              onClick={openCompose}
              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
            >
              <Send size={13} /> Write
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

          <div className="flex flex-1 gap-6 overflow-y-auto p-6">
            {/* Timeline */}
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              {summary && (
                <div className={`${CARD} p-4`}>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-[var(--sa-accent)]" />
                    <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">
                      Where things stand
                    </p>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--sa-text-secondary)]">{summary}</p>
                  <p className="mt-2 text-[11px] text-[var(--sa-text-tertiary)]">
                    Written from the record below. Check anything you&apos;re about to repeat to a client.
                  </p>
                </div>
              )}

              <LogTouchpoint
                open={logging}
                onOpen={() => setLogging(true)}
                onClose={() => setLogging(false)}
                onSaved={async () => { setLogging(false); await refreshTimeline(); }}
                clientId={active.id}
                onError={setError}
              />

              <div className={`${CARD} overflow-hidden`}>
                {loading ? (
                  <p className="p-4 text-[12.5px] text-[var(--sa-text-tertiary)]">Loading…</p>
                ) : timeline.length === 0 ? (
                  <p className="p-4 text-[12.5px] text-[var(--sa-text-tertiary)]">
                    Nothing recorded yet. Log a call, or write to them.
                  </p>
                ) : (
                  timeline.map((t, i) => {
                    const Icon = KIND_ICON[t.kind] ?? SOURCE_ICON[t.source] ?? FileText;
                    return (
                      <div
                        key={t.id}
                        className={`group flex gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-[var(--sa-border)]" : ""}`}
                      >
                        <Icon size={14} className="mt-0.5 shrink-0 text-[var(--sa-text-tertiary)]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug text-[var(--sa-text-primary)]">{t.title}</p>
                          {t.detail && (
                            <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--sa-text-tertiary)]">
                              {t.detail}
                            </p>
                          )}
                          {t.status === "skipped" && (
                            <p className="mt-0.5 text-[11.5px] text-[var(--sa-warning)]">
                              Not delivered — email isn&apos;t switched on
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)]">
                          {when(t.at)}
                        </span>
                        {t.touchpointId && (
                          <button
                            aria-label="Delete entry"
                            onClick={() => {
                              const id = t.touchpointId!;
                              setTimeline((prev) => prev.filter((x) => x.id !== t.id));
                              startTransition(async () => { await deleteTouchpoint(id); });
                            }}
                            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                          >
                            <Trash2 size={12} className="text-[var(--sa-text-tertiary)]" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Side */}
            <div className="flex w-72 shrink-0 flex-col gap-4">
              <FollowUp client={active} onError={setError} />
              <Contacts
                clientId={active.id}
                contacts={contacts}
                setContacts={setContacts}
                onError={setError}
                onWrite={(email) => setCompose({ to: email, subject: "", body: "" })}
              />
              <Notes clientId={active.id} />
            </div>
          </div>
        </div>
      )}

      {compose && (
        <Compose
          value={compose}
          onChange={setCompose}
          onClose={() => setCompose(null)}
          onSend={send}
        />
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────

function LogTouchpoint({
  open, onOpen, onClose, onSaved, clientId, onError,
}: {
  open: boolean; onOpen: () => void; onClose: () => void; onSaved: () => void;
  clientId: string; onError: (e: string) => void;
}) {
  const [kind, setKind] = useState<TouchpointKind>("call");
  const [direction, setDirection] = useState<TouchpointDirection>("outbound");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="flex items-center gap-1.5 self-start text-[12.5px] font-medium text-[var(--sa-accent)]"
      >
        <Plus size={13} /> Log a call, meeting or note
      </button>
    );
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex flex-wrap gap-2">
        <select className={`${INPUT} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as TouchpointKind)}>
          {TOUCHPOINT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <select
          className={`${INPUT} w-auto`}
          value={direction}
          onChange={(e) => setDirection(e.target.value as TouchpointDirection)}
        >
          <option value="outbound">We reached out</option>
          <option value="inbound">They got in touch</option>
          <option value="internal">Internal note</option>
        </select>
      </div>
      <input
        autoFocus
        className={`${INPUT} mt-2`}
        placeholder="What happened, in one line"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
      />
      <textarea
        className={`${INPUT} mt-2 min-h-[70px] resize-y`}
        placeholder="Anything worth remembering (optional)"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy || !summary.trim()}
          onClick={async () => {
            setBusy(true);
            const res = await logTouchpoint({ clientId, kind, direction, summary, detail });
            setBusy(false);
            if (!res.success) { onError(res.error); return; }
            setSummary(""); setDetail("");
            onSaved();
          }}
          className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={onClose} className="text-[12.5px] text-[var(--sa-text-tertiary)]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FollowUp({ client, onError }: { client: ClientCrmSummary; onError: (e: string) => void }) {
  const [date, setDate] = useState(client.nextFollowUpAt ?? "");
  const [note, setNote] = useState(client.followUpNote ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDate(client.nextFollowUpAt ?? "");
    setNote(client.followUpNote ?? "");
  }, [client.id, client.nextFollowUpAt, client.followUpNote]);

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-1.5">
        <CalendarClock size={13} className="text-[var(--sa-text-tertiary)]" />
        <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">Follow up</p>
      </div>
      <input type="date" className={`${INPUT} mt-2`} value={date} onChange={(e) => setDate(e.target.value)} />
      <input
        className={`${INPUT} mt-2`}
        placeholder="About what?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        onClick={async () => {
          const res = await setFollowUp(client.id, date || null, note);
          if (!res.success) { onError(res.error); return; }
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
        className="mt-2 w-full rounded-md border border-[var(--sa-border)] py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
      >
        {saved ? "Saved" : "Set reminder"}
      </button>
    </div>
  );
}

function Contacts({
  clientId, contacts, setContacts, onError, onWrite,
}: {
  clientId: string;
  contacts: ClientContact[];
  setContacts: (c: ClientContact[]) => void;
  onError: (e: string) => void;
  onWrite: (email: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "" });

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-1.5">
        <Users size={13} className="text-[var(--sa-text-tertiary)]" />
        <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">People</p>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {contacts.length === 0 && (
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">Nobody added yet.</p>
        )}
        {contacts.map((c) => (
          <div key={c.id} className="group">
            <div className="flex items-baseline gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--sa-text-primary)]">
                {c.name}
              </span>
              {c.is_primary && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                  Main
                </span>
              )}
              <button
                aria-label={`Remove ${c.name}`}
                onClick={async () => {
                  setContacts(contacts.filter((x) => x.id !== c.id));
                  await deleteContact(c.id);
                }}
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
              >
                <Trash2 size={11} className="text-[var(--sa-text-tertiary)]" />
              </button>
            </div>
            {c.role && <p className="text-[11px] text-[var(--sa-text-tertiary)]">{c.role}</p>}
            {c.email && (
              <button
                onClick={() => onWrite(c.email!)}
                className="block max-w-full truncate text-left text-[11.5px] text-[var(--sa-accent)]"
              >
                {c.email}
              </button>
            )}
            {c.phone && <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">{c.phone}</p>}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {(["name", "role", "email", "phone"] as const).map((f) => (
            <input
              key={f}
              className={INPUT}
              placeholder={f === "name" ? "Name" : f === "role" ? "Role, e.g. Production" : f === "email" ? "Email" : "Phone"}
              value={form[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
            />
          ))}
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const res = await saveContact({ clientId, ...form });
                if (!res.success) { onError(res.error); return; }
                setContacts([...contacts, res.contact]);
                setForm({ name: "", email: "", phone: "", role: "" });
                setAdding(false);
              }}
              className="rounded-md bg-[var(--sa-accent)] px-2.5 py-1 text-[12px] font-medium text-white"
            >
              Add
            </button>
            <button onClick={() => setAdding(false)} className="text-[12px] text-[var(--sa-text-tertiary)]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[var(--sa-accent)]"
        >
          <Plus size={11} /> Add someone
        </button>
      )}
    </div>
  );
}

function Notes({ clientId }: { clientId: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  // Deliberately not preloaded: the notes field is write-mostly and
  // fetching it would need another round trip on every client switch.
  return (
    <div className={`${CARD} p-4`}>
      <p className="text-[12px] font-semibold text-[var(--sa-text-primary)]">Account notes</p>
      <textarea
        className={`${INPUT} mt-2 min-h-[90px] resize-y`}
        placeholder="How they like to work, who decides, anything to remember."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={async () => {
          await saveCrmNotes(clientId, text);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
        className="mt-2 w-full rounded-md border border-[var(--sa-border)] py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
      >
        {saved ? "Saved" : "Save notes"}
      </button>
    </div>
  );
}

function Compose({
  value, onChange, onClose, onSend,
}: {
  value: { to: string; subject: string; body: string };
  onChange: (v: { to: string; subject: string; body: string }) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const [sending, setSending] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-[var(--sa-window)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-4 py-3">
          <p className="flex-1 text-[14px] font-semibold text-[var(--sa-text-primary)]">Write to the client</p>
          <button onClick={onClose} aria-label="Close" className="text-[var(--sa-text-tertiary)]">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          <input
            className={INPUT}
            placeholder="To"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
          <input
            className={INPUT}
            placeholder="Subject"
            value={value.subject}
            onChange={(e) => onChange({ ...value, subject: e.target.value })}
          />
          <textarea
            className={`${INPUT} min-h-[220px] resize-y leading-relaxed`}
            placeholder="Write your message."
            value={value.body}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--sa-border)] px-4 py-3">
          <button
            disabled={sending}
            onClick={async () => { setSending(true); await onSend(); setSending(false); }}
            className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            <Send size={13} /> {sending ? "Sending…" : "Send"}
          </button>
          <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
            Goes out from your Source Archive address and lands in the Emails log.
          </span>
        </div>
      </div>
    </div>
  );
}
