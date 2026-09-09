"use client";

// ─────────────────────────────────────────────────────────────
// The client's own product brief.
//
// Written as a sequence of questions with a photo strip on each, not a
// form: someone describing a garment they can picture and can't name
// needs prompting, and every section here is a question an email thread
// reliably fails to answer.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Plus, Trash2, Send, ChevronLeft, Check, ImagePlus } from "lucide-react";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createUploadTicket } from "@/lib/storage-actions";
import {
  BRIEF_TEXT_FIELDS, BRIEF_MEDIA_SLOTS, FIT_TYPES, PRODUCT_CATEGORIES,
  briefCompleteness, type ProductBrief, type BriefMedia,
} from "@/lib/product-brief";
import {
  listBriefs, getBrief, createBrief, updateBrief,
  addBriefMedia, captionBriefMedia, removeBriefMedia, submitBrief, deleteBrief,
  listBriefReplies, replyAsClient, type BriefReply,
} from "../product-brief-actions";

interface Collection { id: string; name: string }

const INPUT =
  "w-full rounded-md border px-2.5 py-2 text-[13px] outline-none";
const inputStyle = {
  borderColor: "var(--portal-border, rgba(0,0,0,.1))",
  background: "var(--portal-surface, #fff)",
  color: "var(--portal-text-primary, #1d1d1f)",
};

export function ProductBriefTool({
  clientId, collections,
}: {
  clientId: string;
  collections: Collection[];
}) {
  const [briefs, setBriefs] = useState<ProductBrief[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({ projectId: collections[0]?.id ?? "", name: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBriefs(clientId).then((b) => { setBriefs(b); setLoading(false); });
  }, [clientId]);

  if (openId) {
    return (
      <BriefEditor
        briefId={openId}
        onBack={() => setOpenId(null)}
        onSubmitted={(id) => {
          setBriefs((p) => p.map((b) => (b.id === id ? { ...b, status: "submitted" } : b)));
          setOpenId(null);
        }}
        onDeleted={(id) => { setBriefs((p) => p.filter((b) => b.id !== id)); setOpenId(null); }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h2 className="text-[18px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
        Brief a new product
      </h2>
      <p className="mt-1 max-w-xl text-[13px] leading-relaxed" style={{ color: "var(--portal-text-secondary)" }}>
        Tell us what you want made and it goes straight into your collection. Photos help more than
        words — if you can show us the fit or the fabric, do.
      </p>

      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}

      {collections.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--portal-text-tertiary)" }}>
          You don&apos;t have a collection to add to yet — we&apos;ll set one up with you first.
        </p>
      ) : starting ? (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
        >
          <label className="block">
            <span className="text-[11.5px] font-medium" style={{ color: "var(--portal-text-secondary)" }}>
              Which collection
            </span>
            <select
              className={INPUT}
              style={inputStyle}
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="mt-2 block">
            <span className="text-[11.5px] font-medium" style={{ color: "var(--portal-text-secondary)" }}>
              What should we call it?
            </span>
            <input
              autoFocus
              className={INPUT}
              style={inputStyle}
              placeholder="A working name is fine — Boxy overshirt"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              disabled={!form.name.trim() || !form.projectId}
              onClick={async () => {
                setError(null);
                const res = await createBrief({
                  clientId, projectId: form.projectId, name: form.name,
                });
                if (!res.success) { setError(res.error); return; }
                setBriefs((p) => [res.brief, ...p]);
                setOpenId(res.brief.id);
                setStarting(false);
                setForm({ projectId: collections[0]?.id ?? "", name: "" });
              }}
              className="rounded-md px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
              style={{ background: "var(--portal-accent, #0058B0)" }}
            >
              Start the brief
            </button>
            <button
              onClick={() => setStarting(false)}
              className="text-[13px]"
              style={{ color: "var(--portal-text-tertiary)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setStarting(true)}
          className="mt-4 flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium text-white"
          style={{ background: "var(--portal-accent, #0058B0)" }}
        >
          <Plus size={14} /> Brief a product
        </button>
      )}

      <div className="mt-6 flex flex-col gap-1.5">
        {loading ? (
          <p className="text-[13px]" style={{ color: "var(--portal-text-tertiary)" }}>Loading…</p>
        ) : briefs.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--portal-text-tertiary)" }}>
            Nothing briefed yet.
          </p>
        ) : (
          briefs.map((b) => (
            <button
              key={b.id}
              onClick={() => setOpenId(b.id)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left"
              style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--portal-text-primary)" }}>
                  {b.name}
                </span>
                <span className="block truncate text-[11.5px]" style={{ color: "var(--portal-text-tertiary)" }}>
                  {collections.find((c) => c.id === b.project_id)?.name ?? "—"}
                </span>
              </span>
              <span
                className="shrink-0 rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide"
                style={
                  b.status === "draft"
                    ? { background: "rgba(0,0,0,.06)", color: "var(--portal-text-secondary)" }
                    : { background: "rgba(52,199,89,.14)", color: "#1E8E4E" }
                }
              >
                {b.status === "draft" ? "Draft" : "Sent"}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function BriefEditor({
  briefId, onBack, onSubmitted, onDeleted,
}: {
  briefId: string;
  onBack: () => void;
  onSubmitted: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [brief, setBrief] = useState<ProductBrief | null>(null);
  const [media, setMedia] = useState<BriefMedia[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [who, setWho] = useState({ name: "", email: "" });
  const [replies, setReplies] = useState<BriefReply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    getBrief(briefId).then((d) => {
      if (!d) { setError("Couldn't open this brief"); return; }
      setBrief(d.brief);
      setMedia(d.media);
    });
    listBriefReplies(briefId).then(setReplies);
  }, [briefId]);

  function patch(p: Partial<ProductBrief>) {
    if (!brief) return;
    setBrief({ ...brief, ...p });
    void updateBrief(brief.id, p);
  }

  async function upload(files: File[], slot: string) {
    if (!brief || files.length === 0) return;
    setUploadingSlot(slot);
    setError(null);
    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const done: Array<{ image_url: string; storage_path: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      const ticket = await createUploadTicket("brief-media", `${brief.id}/${Date.now()}-${i}-${f.name}`);
      if (ticket.error || !ticket.path || !ticket.token) { setError(ticket.error ?? "Upload refused"); continue; }
      const { error: upErr } = await supabase.storage
        .from("brief-media").uploadToSignedUrl(ticket.path, ticket.token, f);
      if (upErr) { setError(upErr.message); continue; }
      const { data } = supabase.storage.from("brief-media").getPublicUrl(ticket.path);
      done.push({ image_url: data.publicUrl, storage_path: ticket.path });
    }
    setUploadingSlot(null);
    if (done.length === 0) return;
    const res = await addBriefMedia({ briefId: brief.id, slot, items: done });
    if (!res.success) { setError(res.error); return; }
    setMedia((m) => [...m, ...res.media]);
  }

  if (!brief) {
    return <p className="p-6 text-[13px]" style={{ color: "var(--portal-text-tertiary)" }}>{error ?? "Loading…"}</p>;
  }

  const done = brief.status !== "draft";
  const progress = briefCompleteness(brief, media.length);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[12.5px]"
        style={{ color: "var(--portal-text-secondary)" }}
      >
        <ChevronLeft size={14} /> All briefs
      </button>

      {/* Uncommitted until blur, like every other field here. Writing on
          each keystroke sent one request per character and made the field
          feel frozen on a slow connection. */}
      <input
        className="mt-3 w-full border-0 bg-transparent p-0 text-[22px] font-semibold tracking-tight outline-none"
        style={{ color: "var(--portal-text-primary)" }}
        defaultValue={brief.name}
        readOnly={done}
        onBlur={(e) => {
          const name = e.target.value.trim();
          if (name && name !== brief.name) patch({ name });
        }}
      />

      {done ? (
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px]" style={{ color: "#1E8E4E" }}>
          <Check size={13} /> Sent — it&apos;s in your collection now.
        </p>
      ) : (
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--portal-text-tertiary)" }}>
          {progress.answered} of {progress.total} answered
          {progress.missing.length > 0 && ` · still to do: ${progress.missing.join(", ")}`}
        </p>
      )}

      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {/* Basics */}
        <Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <Label>Category</Label>
              <select
                className={INPUT} style={inputStyle} disabled={done}
                value={brief.category ?? ""}
                onChange={(e) => patch({ category: e.target.value || null })}
              >
                <option value="">Choose…</option>
                {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <Label>Size range</Label>
              <input
                className={INPUT} style={inputStyle} disabled={done}
                placeholder="XS–XL, or one size"
                defaultValue={brief.size_range ?? ""}
                onBlur={(e) => patch({ size_range: e.target.value || null })}
              />
            </label>
          </div>

          <div className="mt-2">
            <Label>Fit</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {FIT_TYPES.map((f) => {
                const on = (brief.fit_type ?? []).includes(f);
                return (
                  <button
                    key={f}
                    disabled={done}
                    onClick={() =>
                      patch({
                        fit_type: on
                          ? brief.fit_type.filter((x) => x !== f)
                          : [...(brief.fit_type ?? []), f],
                      })
                    }
                    className="rounded-md border px-2 py-1 text-[12px]"
                    style={
                      on
                        ? { borderColor: "transparent", background: "rgba(0,88,176,.12)", color: "#0058B0", fontWeight: 500 }
                        : { borderColor: "var(--portal-border)", color: "var(--portal-text-secondary)" }
                    }
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* The questions, each with its own photos */}
        {BRIEF_TEXT_FIELDS.map((f) => {
          const slot = BRIEF_MEDIA_SLOTS.find((s) => s.id === f.slot);
          const shots = media.filter((m) => m.slot === f.slot);
          return (
            <Card key={f.key as string}>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
                  {f.label}
                </p>
                <p className="min-w-0 flex-1 text-[11px]" style={{ color: "var(--portal-text-tertiary)" }}>
                  {f.hint}
                </p>
                {!done && (
                  <label className="shrink-0 cursor-pointer text-[11.5px] font-medium" style={{ color: "var(--portal-accent, #0058B0)" }}>
                    {uploadingSlot === f.slot ? "Uploading…" : "Add photos"}
                    <input
                      type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => { void upload(Array.from(e.target.files ?? []), f.slot); e.target.value = ""; }}
                    />
                  </label>
                )}
              </div>

              <textarea
                className={`${INPUT} mt-2 resize-y`}
                style={inputStyle}
                rows={f.long ? 3 : 2}
                disabled={done}
                placeholder={slot?.hint}
                defaultValue={(brief[f.key] as string) ?? ""}
                onBlur={(e) => patch({ [f.key]: e.target.value || null } as Partial<ProductBrief>)}
              />

              {shots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {shots.map((m) => (
                    <div key={m.id} className="group w-[120px]">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.image_url}
                          alt={m.note ?? f.label}
                          className="h-[120px] w-[120px] rounded-lg object-cover"
                        />
                        {!done && (
                          <button
                            onClick={async () => {
                              setMedia((p) => p.filter((x) => x.id !== m.id));
                              await removeBriefMedia(m.id);
                            }}
                            aria-label="Remove"
                            className="absolute right-1 top-1 rounded bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 size={10} color="#fff" />
                          </button>
                        )}
                      </div>
                      <input
                        className="mt-1 w-full border-0 bg-transparent p-0 text-[11px] outline-none"
                        style={{ color: "var(--portal-text-secondary)" }}
                        placeholder="What's this showing?"
                        disabled={done}
                        defaultValue={m.note ?? ""}
                        onBlur={(e) => void captionBriefMedia(m.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {shots.length === 0 && !done && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--portal-text-tertiary)" }}>
                  <ImagePlus size={11} /> A photo here saves a lot of back and forth.
                </p>
              )}
            </Card>
          );
        })}

        {/* Commercials */}
        <Card>
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
            Quantity and timing
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="block">
              <Label>How many</Label>
              <input
                type="number" min={1} className={INPUT} style={inputStyle} disabled={done}
                defaultValue={brief.target_quantity ?? ""}
                onBlur={(e) => patch({ target_quantity: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
            <label className="block">
              <Label>Target price each</Label>
              <input
                type="number" step="0.01" className={INPUT} style={inputStyle} disabled={done}
                defaultValue={brief.target_price ?? ""}
                onBlur={(e) => patch({ target_price: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
            <label className="block">
              <Label>Needed by</Label>
              <input
                type="date" className={INPUT} style={inputStyle} disabled={done}
                defaultValue={brief.needed_by ?? ""}
                onChange={(e) => patch({ needed_by: e.target.value || null })}
              />
            </label>
          </div>
          <label className="mt-2 block">
            <Label>Anything else</Label>
            <textarea
              className={`${INPUT} resize-y`} style={inputStyle} rows={2} disabled={done}
              placeholder="Deadlines, certifications, anything we should know"
              defaultValue={brief.notes ?? ""}
              onBlur={(e) => patch({ notes: e.target.value || null })}
            />
          </label>
        </Card>

        {done && (
          <Card>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
              Conversation
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {replies.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--portal-text-tertiary)" }}>
                  Nothing yet. We&apos;ll come back to you here.
                </p>
              ) : (
                replies.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg p-2.5"
                    style={{
                      background: r.side === "agency" ? "rgba(0,88,176,.08)" : "rgba(0,0,0,.04)",
                    }}
                  >
                    <p className="text-[11px] font-medium" style={{ color: "var(--portal-text-tertiary)" }}>
                      {r.side === "agency" ? r.author_name || "Source Archive" : r.author_name || "You"}
                    </p>
                    <p
                      className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed"
                      style={{ color: "var(--portal-text-primary)" }}
                    >
                      {r.body}
                    </p>
                  </div>
                ))
              )}
            </div>

            <textarea
              className={`${INPUT} mt-2 resize-y`}
              style={inputStyle}
              rows={3}
              placeholder="Ask a question, or answer one"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <button
              disabled={replying || !replyBody.trim()}
              onClick={async () => {
                setReplying(true);
                setError(null);
                const res = await replyAsClient({
                  briefId: brief.id, body: replyBody, authorName: brief.submitted_by_name ?? undefined,
                });
                setReplying(false);
                if (!res.success) { setError(res.error); return; }
                setReplies((p) => [...p, res.reply]);
                setReplyBody("");
              }}
              className="mt-2 flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
              style={{ background: "var(--portal-accent, #0058B0)" }}
            >
              <Send size={13} /> {replying ? "Sending…" : "Send"}
            </button>
          </Card>
        )}

        {/* Send */}
        {!done && (
          <Card>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--portal-text-primary)" }}>
              Send it over
            </p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--portal-text-tertiary)" }}>
              It goes into your collection straight away and we&apos;ll pick it up from there. You can
              keep editing until you send.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className={`${INPUT} w-auto flex-1`} style={inputStyle}
                placeholder="Your name"
                value={who.name}
                onChange={(e) => setWho({ ...who, name: e.target.value })}
              />
              <input
                className={`${INPUT} w-auto flex-1`} style={inputStyle}
                placeholder="Your email"
                value={who.email}
                onChange={(e) => setWho({ ...who, email: e.target.value })}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                disabled={sending || !brief.name.trim()}
                onClick={async () => {
                  setSending(true);
                  setError(null);
                  const res = await submitBrief(brief.id, who);
                  setSending(false);
                  if (!res.success) { setError(res.error); return; }
                  onSubmitted(brief.id);
                }}
                className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"
                style={{ background: "var(--portal-accent, #0058B0)" }}
              >
                <Send size={13} /> {sending ? "Sending…" : "Send this brief"}
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete this draft?")) return;
                  await deleteBrief(brief.id);
                  onDeleted(brief.id);
                }}
                className="text-[12.5px]"
                style={{ color: "var(--portal-text-tertiary)" }}
              >
                Delete draft
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--portal-border)", background: "var(--portal-surface)" }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11.5px] font-medium" style={{ color: "var(--portal-text-secondary)" }}>
      {children}
    </span>
  );
}
