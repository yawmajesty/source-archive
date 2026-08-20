"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Eye, EyeOff, Search, Upload } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import {
  FABRIC_CATEGORIES, FABRIC_TIERS, SUSTAINABILITY_TAGS, STOCK_LABEL, priceBandFor,
  categoryByCode, REQUIRED_SHOTS, templateGaps, STOCK_HINT,
  type Fabric, type FabricTier, type PriceUnit, type StockStatus,
} from "@/lib/fabrics";
import { saveFabric, setFabricPublished, addFabricPhotos, listFabricPhotos, deleteFabricPhoto, type FabricPhoto } from "./actions";

// ─────────────────────────────────────────────────────────────
// The population tool. 40 well-documented entries beat 200 stubs, so this is
// built for fast repeated entry: name and category are the only required
// fields, everything else can be filled in on a second pass, and nothing is
// visible to clients until it is deliberately published.
// ─────────────────────────────────────────────────────────────

const empty = (): Partial<Fabric> & { name: string; category: string } => ({
  name: "",
  tier: "standard",
  category: FABRIC_CATEGORIES[0].en,
  category_code: FABRIC_CATEGORIES[0].code,
  price_unit: "metre",
  stock_status: "made_to_order",
  sustainability: [],
  moq_unit: "metre",
});

export function FabricsClient({ fabrics, canPublish }: { fabrics: Fabric[]; canPublish: boolean }) {
  const [rows, setRows] = useState(fabrics);
  const [draft, setDraft] = useState<(Partial<Fabric> & { name: string; category: string }) | null>(null);
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState<StockStatus | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const swatchRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<"texture" | "color" | "other">("other");
  const [photos, setPhotos] = useState<FabricPhoto[]>([]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byStock = stockFilter === "all" ? rows : rows.filter((f) => f.stock_status === stockFilter);
    if (!needle) return byStock;
    return byStock.filter((f) =>
      [f.code, f.name, f.category, f.category_code, f.composition, f.mill, f.tier]
        .filter(Boolean).join(" ").toLowerCase().includes(needle),
    );
  }, [rows, q, stockFilter]);

  const deadstockCount = rows.filter((f) => f.stock_status === "deadstock").length;

  const published = rows.filter((r) => r.is_published).length;

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null);
    const res = await saveFabric(draft);
    if (!res.success) { setError(res.error); setBusy(false); return; }
    setRows((prev) => {
      const without = prev.filter((r) => r.id !== res.fabric.id);
      return [...without, res.fabric].sort((a, b) => a.name.localeCompare(b.name));
    });
    // Keep the category so a run of similar fabrics is quick to enter.
    setDraft({ ...empty(), category: draft.category });
    setBusy(false);
  }

  async function openFabric(f: Fabric) {
    setDraft(f);
    setPhotos([]);
    const list = await listFabricPhotos(f.id);
    setPhotos(list);
  }

  async function togglePublish(f: Fabric) {
    const res = await setFabricPublished([f.id], !f.is_published);
    if (!res.success) { setError(res.error ?? "Could not publish"); return; }
    setRows((prev) => prev.map((r) => (r.id === f.id ? { ...r, is_published: !f.is_published } : r)));
  }

  async function uploadPhotos(files: File[], shot: "texture" | "color" | "other" = "other") {
    if (!draft?.id || !files.length) return;
    setBusy(true); setError(null);
    const uploaded: { url: string; kind: "image" | "video" }[] = [];
    for (const file of files) {
      const path = `fabrics/${draft.id}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
      const { url, error: upErr } = await uploadFile("brand-assets", path, file);
      if (url) uploaded.push({ url, kind: "image" });
      else if (upErr) setError(upErr);
    }
    if (uploaded.length) {
      const res = await addFabricPhotos(draft.id, uploaded.map((u) => ({ ...u, shot })));
      if (res.success) {
        setPhotos((prev) => [...prev, ...res.photos]);
        // First photo doubles as the list thumbnail.
        if (!draft.swatch_url) setDraft({ ...draft, swatch_url: uploaded[0].url });
      } else setError(res.error);
    }
    setBusy(false);
  }

  async function removePhoto(id: string) {
    const res = await deleteFabricPhoto(id);
    if (res.success) setPhotos((prev) => prev.filter((p) => p.id !== id));
    else setError(res.error ?? "Could not remove photo");
  }

  const inp = "w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1.5 text-[13px] text-[var(--sa-text-primary)] outline-none";
  const lbl = "mb-1 block text-[11px] font-medium text-[var(--sa-text-tertiary)]";

  function field(key: keyof Fabric, label: string, type: "text" | "number" = "text", placeholder = "") {
    return (
      <div>
        <span className={lbl}>{label}</span>
        <input
          type={type}
          className={inp}
          placeholder={placeholder}
          value={(draft?.[key] as string | number | null) ?? ""}
          onChange={(e) =>
            setDraft((d) => d && ({
              ...d,
              [key]: type === "number" ? (e.target.value === "" ? null : parseFloat(e.target.value)) : e.target.value,
            }))
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[17px] font-semibold text-[var(--sa-text-primary)]">Fabric library</h1>
        <span className="text-[12px] text-[var(--sa-text-tertiary)]">
          {rows.length} fabrics · {published} published to clients
        </span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={13} className="absolute left-2 top-2 text-[var(--sa-text-tertiary)]" />
          <input className={`${inp} pl-7 w-56`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button
          onClick={() => setDraft(draft ? null : empty())}
          className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
        >
          <Plus size={14} /> {draft ? "Close" : "Add fabric"}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "in_stock", "made_to_order", "deadstock", "discontinued"] as const).map((k) => {
            const on = stockFilter === k;
            const count = k === "all" ? rows.length : rows.filter((f) => f.stock_status === k).length;
            return (
              <button
                key={k}
                onClick={() => setStockFilter(k)}
                title={k === "all" ? "" : STOCK_HINT[k]}
                className="rounded-md px-2.5 py-1 text-[12px] transition-colors"
                style={{
                  background: on ? "var(--sa-accent)" : "var(--sa-hover)",
                  color: on ? "#fff" : "var(--sa-text-secondary)",
                }}
              >
                {k === "all" ? "All" : STOCK_LABEL[k]}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
          {deadstockCount > 0 && stockFilter !== "deadstock" && (
            <span className="ml-1 text-[11.5px] text-[var(--sa-text-tertiary)]">
              {deadstockCount} deadstock — limited quantity, usually no repeat
            </span>
          )}
        </div>
      )}

      {rows.length === 0 && !draft && (
        <div className="rounded-xl border border-dashed border-[var(--sa-border)] p-8 text-center">
          <p className="text-[13px] text-[var(--sa-text-primary)]">The library is empty.</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-[var(--sa-text-tertiary)]">
            Nothing here is visible to clients until you publish it, so you can build it up over time.
            Aim for depth over breadth — a well-documented handful reads better than a long list of stubs.
          </p>
        </div>
      )}

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      {draft && (
        <div className="rounded-xl border border-[var(--sa-border)] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
              {draft.id ? "Edit fabric" : "New fabric"}
            </p>
            {draft.code ? (
              <span className="rounded-md bg-[var(--sa-hover)] px-2 py-0.5 font-mono text-[12px] tabular-nums text-[var(--sa-text-primary)]">
                {draft.code}
              </span>
            ) : (
              <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                Code is allocated from tier + fabric type when you save
              </span>
            )}
            {draft.id && (() => {
              const gaps = templateGaps(draft, photos.map((p) => p.shot));
              return gaps.length ? (
                <span className="text-[11.5px]" style={{ color: "var(--sa-warning)" }}>
                  Still needed: {gaps.join(", ")}
                </span>
              ) : (
                <span className="text-[11.5px]" style={{ color: "var(--sa-success)" }}>Template complete</span>
              );
            })()}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {field("name", "Name *", "text", "Heavy organic French terry")}
            <div>
              <span className={lbl}>Fabric type *</span>
              <select
                className={inp}
                value={draft.category_code ?? FABRIC_CATEGORIES[0].code}
                onChange={(e) => {
                  const cat = categoryByCode(e.target.value);
                  setDraft({ ...draft, category_code: e.target.value, category: cat?.en ?? e.target.value });
                }}
              >
                {FABRIC_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} · {c.en} · {c.zh}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={lbl}>Tier *</span>
              <select
                className={inp}
                value={draft.tier ?? "standard"}
                onChange={(e) => setDraft({ ...draft, tier: e.target.value as FabricTier })}
                disabled={!!draft.id}
                title={draft.id ? "Tier is part of the code and fixed once allocated" : ""}
              >
                {FABRIC_TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            {field("composition", "Composition", "text", "100% organic cotton")}
            {field("gsm", "GSM", "number", "380")}

            {field("hand_feel", "Hand feel", "text", "Dense, brushed back, soft")}
            {field("stretch", "Stretch", "text", "None / 2-way / 4-way")}
            {field("drape", "Drape", "text", "Structured, holds shape")}
            {field("mill", "Mill / supplier", "text", "Who this comes from")}

            {field("price_per_unit_usd", "Price", "number", "8.50")}
            <div>
              <span className={lbl}>Price unit</span>
              <select
                className={inp}
                value={draft.price_unit ?? "metre"}
                onChange={(e) => setDraft({ ...draft, price_unit: e.target.value as PriceUnit })}
              >
                {["metre", "yard", "sqft", "kg"].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {field("moq", "MOQ", "number", "300")}
            {field("lead_time_days", "Lead time (days)", "number", "21")}

            {field("consumption_per_unit", "Consumption per garment", "number", "1.8")}
            <div>
              <span className={lbl}>Stock</span>
              <select
                className={inp}
                value={draft.stock_status ?? "made_to_order"}
                onChange={(e) => setDraft({ ...draft, stock_status: e.target.value as StockStatus })}
              >
                {Object.entries(STOCK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-[var(--sa-text-tertiary)]">
                {STOCK_HINT[(draft.stock_status ?? "made_to_order") as StockStatus]}
              </p>
            </div>
            {field("our_cost_usd", "Our cost (internal)", "number")}
            <div>
              <span className={lbl}>Photos</span>
              <button
                onClick={() => swatchRef.current?.click()}
                disabled={!draft.id}
                title={draft.id ? "" : "Save the fabric first, then add photos"}
                className={`${inp} flex items-center gap-1.5 text-left disabled:opacity-50`}
              >
                <Upload size={13} /> {draft.id ? "Add photos" : "Save first"}
              </button>
              <input
                ref={swatchRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => uploadPhotos(Array.from(e.target.files ?? []), shotRef.current)}
              />
            </div>
          </div>

          <div className="mt-3">
            <span className={lbl}>Sustainability</span>
            <div className="flex flex-wrap gap-1.5">
              {SUSTAINABILITY_TAGS.map((t) => {
                const on = (draft.sustainability ?? []).includes(t);
                return (
                  <button
                    key={t}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        sustainability: on
                          ? (draft.sustainability ?? []).filter((x) => x !== t)
                          : [...(draft.sustainability ?? []), t],
                      })
                    }
                    className="rounded-md px-2 py-1 text-[11.5px]"
                    style={{
                      background: on ? "var(--sa-accent)" : "var(--sa-hover)",
                      color: on ? "#fff" : "var(--sa-text-secondary)",
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {field("notes", "Notes (client-visible)")}
            {field("mill_notes", "Mill notes (internal)")}
          </div>

          {draft.id && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {REQUIRED_SHOTS.map((slot) => {
                const shots = photos.filter((p) => p.shot === slot.id);
                return (
                  <div key={slot.id} className="rounded-lg border border-[var(--sa-border)] p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-[var(--sa-text-primary)]">{slot.label}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: shots.length ? "rgba(31,122,76,.12)" : "var(--sa-hover)",
                          color: shots.length ? "var(--sa-success)" : "var(--sa-text-tertiary)",
                        }}
                      >
                        {shots.length ? "Added" : "Required"}
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] text-[var(--sa-text-tertiary)]">{slot.hint}</p>
                    <div className="flex flex-wrap gap-2">
                      {shots.map((ph) => (
                        <div key={ph.id} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--sa-border)]">
                          <img src={ph.url} alt={slot.label} className="h-full w-full object-cover" />
                          <button
                            onClick={() => removePhoto(ph.id)}
                            className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white group-hover:flex"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => { shotRef.current = slot.id; swatchRef.current?.click(); }}
                        className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[var(--sa-border)] text-[var(--sa-text-tertiary)]"
                        title={`Add ${slot.label}`}
                      >
                        <Upload size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {photos.some((p) => p.shot !== "texture" && p.shot !== "color") && (
                <div className="sm:col-span-2">
                  <span className={lbl}>Other photos</span>
                  <div className="flex flex-wrap gap-2">
                    {photos.filter((p) => p.shot !== "texture" && p.shot !== "color").map((ph) => (
                      <div key={ph.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--sa-border)]">
                        <img src={ph.url} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => removePhoto(ph.id)}
                          className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] text-white group-hover:flex"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy || !draft.name.trim()}
              className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : draft.id ? "Save changes" : "Save and add another"}
            </button>
            <button onClick={() => setDraft(null)} className="text-[12.5px] text-[var(--sa-text-secondary)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {filtered.map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded-lg border border-[var(--sa-border)] p-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md" style={{ background: "var(--sa-hover)" }}>
              {f.swatch_url && <img src={f.swatch_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[13px] font-medium text-[var(--sa-text-primary)]">
                {f.code && (
                  <span className="rounded bg-[var(--sa-hover)] px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--sa-text-secondary)]">
                    {f.code}
                  </span>
                )}
                {f.name}
              </p>
              <p className="truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                {[f.tier === "premium" ? "Premium" : "Standard", f.category, f.composition,
                  f.gsm ? `${f.gsm} gsm` : null, STOCK_LABEL[f.stock_status]]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>
            {f.stock_status === "deadstock" && (
              <span
                className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold"
                style={{ background: "rgba(168,91,20,.14)", color: "var(--sa-warning)" }}
                title={STOCK_HINT.deadstock}
              >
                Deadstock
              </span>
            )}
            <span className="text-[12px] tabular-nums text-[var(--sa-text-secondary)]">
              {f.price_per_unit_usd != null ? `$${f.price_per_unit_usd}/${f.price_unit}` : "—"}
              {f.price_per_unit_usd != null && (
                <span className="ml-1.5 text-[var(--sa-text-tertiary)]">
                  {f.price_band ?? priceBandFor(f.price_per_unit_usd, f.price_unit)}
                </span>
              )}
            </span>
            <button onClick={() => openFabric(f)} className="text-[12px] text-[var(--sa-text-secondary)]">Edit</button>
            {canPublish && (
              <button
                onClick={() => togglePublish(f)}
                className="flex items-center gap-1 text-[11.5px]"
                style={{ color: f.is_published ? "var(--sa-success)" : "var(--sa-text-tertiary)" }}
                title={f.is_published ? "Visible to clients" : "Hidden from clients"}
              >
                {f.is_published ? <Eye size={13} /> : <EyeOff size={13} />}
                {f.is_published ? "Published" : "Draft"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
