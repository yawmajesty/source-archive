"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Check, Clock, AlertTriangle } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { mediaKindFor } from "@/lib/product-media";
import { PRODUCTION_STAGES, STAGE_LABEL, groupByDate, type ProductionLogEntry, type ProductionStage } from "@/lib/production-log";
import { createLogEntry, attachLogPhotos } from "@/app/(app)/products/[id]/production-log-actions";
import { changeProductStage, PRODUCT_STAGES } from "@/app/(app)/products/[id]/stage-actions";

interface ProductLite { id: string; name: string; category: string; stage: string }

const today = () => new Date().toISOString().slice(0, 10);

export function WorkshopClient({ products, recent, authorName, canChangeStage }: {
  products: ProductLite[];
  recent: ProductionLogEntry[];
  authorName: string | null;
  canChangeStage: boolean;
}) {
  const [productId, setProductId] = useState<string>(products[0]?.id ?? "");
  const [stage, setStage] = useState<ProductionStage>("pattern");
  const [workDate, setWorkDate] = useState(today());
  const [summary, setSummary] = useState("");
  const [minutes, setMinutes] = useState("");
  const [blocked, setBlocked] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState(recent);
  const [stages, setStages] = useState<Record<string, string>>(
    Object.fromEntries(products.map((p) => [p.id, p.stage])),
  );
  const [stageBusy, setStageBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const grouped = useMemo(() => groupByDate(entries), [entries]);
  const currentStage = stages[productId];

  async function moveStage(to: string) {
    if (!productId || stageBusy) return;
    setStageBusy(true); setError(null);
    const res = await changeProductStage(productId, to, summary.trim() || undefined);
    if (!res.success) setError(res.error);
    else setStages((prev) => ({ ...prev, [productId]: to }));
    setStageBusy(false);
  }
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Unknown product";

  async function handleSave() {
    if (!productId || !summary.trim()) { setError("Pick a product and say what you did"); return; }
    setSaving(true); setError(null); setSaved(false);

    const res = await createLogEntry({
      product_id: productId,
      stage,
      work_date: workDate,
      summary: summary.trim(),
      minutes_spent: minutes ? parseInt(minutes, 10) : null,
      blocked_reason: blocked.trim() || null,
    });

    if (!res.success) { setError(res.error); setSaving(false); return; }

    if (files.length) {
      const uploaded: { url: string; kind: "image" | "video" }[] = [];
      for (const file of files) {
        const path = `${productId}/workshop/${Date.now()}-${file.name}`;
        const { url, error: upErr } = await uploadFile("product-media", path, file);
        if (url) uploaded.push({ url, kind: mediaKindFor(file.name, file.type) });
        else if (upErr) setError(`Entry saved, but a photo failed: ${upErr}`);
      }
      if (uploaded.length) {
        await attachLogPhotos({ entry_id: res.entry.id, product_id: productId, items: uploaded });
      }
    }

    setEntries((prev) => [res.entry, ...prev]);
    setSummary(""); setMinutes(""); setBlocked(""); setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[.04em]";
  const field = "w-full rounded-[6px] px-2.5 py-1.5 text-[13px] outline-none";
  const fieldStyle = { background: "var(--fill)", color: "var(--label)", boxShadow: "inset 0 0 0 .5px var(--sep)" };

  return (
    <div className="flex flex-col gap-5">
      <section className="mac-card p-4">
        <h1 className="text-[16px] font-semibold tight" style={{ color: "var(--label)" }}>Today&apos;s work</h1>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--label-2)" }}>
          Saved to the workshop only. Nothing reaches the client until it&apos;s released.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <span className={label} style={{ color: "var(--label-3)" }}>Product</span>
            <select className={field} style={fieldStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.length === 0 && <option value="">No active products</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.category}</option>
              ))}
            </select>
          </div>

          {canChangeStage && productId && (
            <div>
              <span className={label} style={{ color: "var(--label-3)" }}>
                Where this product is now
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRODUCT_STAGES.map((s) => (
                  <button
                    key={s.id}
                    disabled={stageBusy}
                    onClick={() => moveStage(s.id)}
                    className="rounded-[6px] px-2.5 py-1 text-[12.5px] transition-colors disabled:opacity-50"
                    style={{
                      background: currentStage === s.id ? "var(--green)" : "var(--fill)",
                      color: currentStage === s.id ? "#fff" : "var(--label-2)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px]" style={{ color: "var(--label-3)" }}>
                Moving a product is recorded and shown to the client.
              </p>
            </div>
          )}

          <div>
            <span className={label} style={{ color: "var(--label-3)" }}>What kind of work</span>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCTION_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStage(s.id)}
                  title={s.hint}
                  className="rounded-[6px] px-2.5 py-1 text-[12.5px] transition-colors"
                  style={{
                    background: stage === s.id ? "var(--accent)" : "var(--fill)",
                    color: stage === s.id ? "#fff" : "var(--label-2)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <span className={label} style={{ color: "var(--label-3)" }}>Date</span>
              <input type="date" className={field} style={fieldStyle} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </div>
            <div className="w-32">
              <span className={label} style={{ color: "var(--label-3)" }}>Minutes</span>
              <input type="number" min={0} placeholder="optional" className={`${field} tnum`} style={fieldStyle} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          </div>

          <div>
            <span className={label} style={{ color: "var(--label-3)" }}>What you did</span>
            <textarea
              rows={3}
              className={field}
              style={fieldStyle}
              placeholder="Drafted the front and back blocks, walked the side seam…"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div>
            <span className={label} style={{ color: "var(--label-3)" }}>Blocked on anything?</span>
            <input className={field} style={fieldStyle} placeholder="optional — waiting on interfacing, etc." value={blocked} onChange={(e) => setBlocked(e.target.value)} />
          </div>

          <div>
            <span className={label} style={{ color: "var(--label-3)" }}>Photos</span>
            <button onClick={() => fileRef.current?.click()} className="mac-button flex items-center gap-1.5">
              <Camera size={14} strokeWidth={1.6} />
              {files.length ? `${files.length} selected` : "Add photos"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </div>

          {error && <p className="text-[12px]" style={{ color: "var(--amber)" }}>{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || !products.length}
            className="mac-button mac-button-primary flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saved ? <><Check size={14} strokeWidth={2} /> Saved</> : saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[.04em]" style={{ color: "var(--label-3)" }}>
          Recently logged
        </h2>
        {grouped.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--label-3)" }}>Nothing logged yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map((day) => (
              <div key={day.date}>
                <p className="tnum mb-1 text-[11.5px]" style={{ color: "var(--label-3)" }}>
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <div className="flex flex-col gap-1.5">
                  {day.entries.map((e) => (
                    <div key={e.id} className="mac-card p-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--fill)", color: "var(--label-2)" }}>
                          {STAGE_LABEL[e.stage]}
                        </span>
                        <span className="truncate text-[12.5px] font-medium" style={{ color: "var(--label)" }}>{productName(e.product_id)}</span>
                        <div className="flex-1" />
                        {e.visible_to_client
                          ? <span className="text-[10.5px]" style={{ color: "var(--green)" }}>Released</span>
                          : <span className="text-[10.5px]" style={{ color: "var(--label-3)" }}>Internal</span>}
                      </div>
                      <p className="mt-1 text-[12.5px]" style={{ color: "var(--label-2)" }}>{e.summary}</p>
                      <div className="mt-1 flex items-center gap-3">
                        {e.minutes_spent ? (
                          <span className="tnum flex items-center gap-1 text-[11px]" style={{ color: "var(--label-3)" }}>
                            <Clock size={11} strokeWidth={1.6} /> {e.minutes_spent}m
                          </span>
                        ) : null}
                        {e.blocked_reason ? (
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--amber)" }}>
                            <AlertTriangle size={11} strokeWidth={1.6} /> {e.blocked_reason}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
