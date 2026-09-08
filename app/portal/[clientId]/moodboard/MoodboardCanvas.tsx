"use client";

// ─────────────────────────────────────────────────────────────
// The board.
//
// One transformed layer holds every image; panning and zooming move that
// layer rather than the items, so an image's stored coordinates never
// change when you look around. Screen positions convert to board
// positions through toBoard(), which is the only place the two spaces
// meet — keeping that conversion in one function is what stops drag,
// drop and zoom from disagreeing with each other.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, Link2, X, ZoomIn, ZoomOut, Maximize2, Loader2, ImagePlus,
} from "lucide-react";
import { createUploadTicket } from "@/lib/storage-actions";
import { createClient } from "@supabase/supabase-js";
import {
  LINK_TYPES, LINK_LABEL, DEFAULT_WIDTH, nextSlot, topZ,
  type MoodboardItem, type MoodboardLink, type LinkType,
} from "@/lib/moodboard";
import {
  addItems, moveItem, updateItem, removeItem, linkItemToProduct, unlinkItem,
} from "../moodboard-actions";

interface Product { id: string; name: string; project: string | null }

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function MoodboardCanvas({
  boardId, clientId, initialItems, initialLinks, products, viewerName, canEdit = true,
}: {
  boardId: string;
  clientId: string;
  initialItems: MoodboardItem[];
  initialLinks: MoodboardLink[];
  products: Product[];
  viewerName?: string | null;
  canEdit?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [links, setLinks] = useState(initialLinks);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Live drag state lives in a ref, not state: a re-render per pointer
  // event makes dragging feel like treacle.
  const drag = useRef<
    | { mode: "item"; id: string; startX: number; startY: number; originX: number; originY: number }
    | { mode: "pan"; startX: number; startY: number; originX: number; originY: number }
    | null
  >(null);

  /** Screen coordinates → board coordinates. The one conversion. */
  const toBoard = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom],
  );

  // Pointer move and up are bound to the window so a fast drag that
  // leaves the element doesn't strand the item mid-move.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      if (d.mode === "pan") {
        setPan({ x: d.originX + (e.clientX - d.startX), y: d.originY + (e.clientY - d.startY) });
        return;
      }
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      setItems((prev) =>
        prev.map((i) => (i.id === d.id ? { ...i, x: d.originX + dx, y: d.originY + dy } : i)),
      );
    }

    function onUp() {
      const d = drag.current;
      drag.current = null;
      if (!d || d.mode !== "item") return;
      // Persist only on release — one write per move, not one per pixel.
      const moved = items.find((i) => i.id === d.id);
      if (moved) void moveItem({ itemId: moved.id, x: moved.x, y: moved.y, z: moved.z });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [items, zoom]);

  async function uploadFiles(files: File[], at?: { x: number; y: number }) {
    if (!canEdit) return;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (images.length > 30) {
      setError("30 images at a time, at most.");
      return;
    }

    setError(null);
    setUploading(images.length);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const placed: Array<{ image_url: string; storage_path: string; x: number; y: number; width: number; z: number }> = [];
    const baseZ = topZ(items);

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      try {
        const ticket = await createUploadTicket(
          "moodboard-media",
          `${clientId}/${Date.now()}-${i}-${file.name}`,
        );
        if (ticket.error || !ticket.path || !ticket.token) {
          setError(ticket.error ?? "Upload was refused");
          continue;
        }
        const { error: upErr } = await supabase.storage
          .from("moodboard-media")
          .uploadToSignedUrl(ticket.path, ticket.token, file);
        if (upErr) { setError(upErr.message); continue; }

        const { data } = supabase.storage.from("moodboard-media").getPublicUrl(ticket.path);
        const spot = at
          ? { x: at.x + (i % 4) * 24, y: at.y + Math.floor(i / 4) * 24 }
          : nextSlot(items, i);
        placed.push({
          image_url: data.publicUrl,
          storage_path: ticket.path,
          x: spot.x, y: spot.y, width: DEFAULT_WIDTH, z: baseZ + i,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
      setUploading((n) => n - 1);
    }

    setUploading(0);
    if (placed.length === 0) return;

    const res = await addItems({ boardId, items: placed, addedByName: viewerName ?? null });
    if (!res.success) { setError(res.error); return; }
    setItems((prev) => [...prev, ...res.items]);
  }

  const selectedItem = items.find((i) => i.id === selected) ?? null;
  const selectedLinks = links.filter((l) => l.item_id === selected);

  return (
    <div className="relative flex h-full min-h-[520px] overflow-hidden rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)]">
      {/* Surface */}
      <div
        ref={surfaceRef}
        className="relative flex-1 overflow-hidden"
        style={{ cursor: drag.current?.mode === "pan" ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.surface) return;
          setSelected(null);
          drag.current = { mode: "pan", startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
        }}
        onWheel={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.002)));
        }}
        onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropping(false);
          const at = toBoard(e.clientX, e.clientY);
          void uploadFiles(Array.from(e.dataTransfer.files), at);
        }}
      >
        {/* Grid, so panning across empty space still reads as movement */}
        <div
          data-surface="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--sa-border) 1px, transparent 1px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {items.map((item) => {
            const itemLinks = links.filter((l) => l.item_id === item.id);
            return (
              <div
                key={item.id}
                className="absolute"
                style={{ left: item.x, top: item.y, width: item.width, zIndex: item.z }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelected(item.id);
                  if (!canEdit) return;
                  const z = topZ(items);
                  setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, z } : i)));
                  drag.current = {
                    mode: "item", id: item.id,
                    startX: e.clientX, startY: e.clientY,
                    originX: item.x, originY: item.y,
                  };
                }}
              >
                <div
                  className={`overflow-hidden rounded-lg bg-[var(--sa-window)] shadow-sm ring-offset-2 transition-shadow ${
                    selected === item.id ? "ring-2 ring-[var(--sa-accent)]" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.caption ?? "Moodboard image"}
                    draggable={false}
                    className="block w-full select-none"
                  />
                </div>
                {(item.caption || itemLinks.length > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {item.caption && (
                      <span className="text-[11px] text-[var(--sa-text-secondary)]">{item.caption}</span>
                    )}
                    {itemLinks.map((l) => (
                      <span
                        key={l.id}
                        className="rounded bg-[var(--sa-selected)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--sa-accent)]"
                      >
                        {LINK_LABEL[l.link_type] ?? l.link_type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && uploading === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <ImagePlus size={26} className="text-[var(--sa-text-tertiary)]" />
            <p className="mt-2 text-[14px] font-medium text-[var(--sa-text-primary)]">
              Drop images anywhere
            </p>
            <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
              Build the board out as far as you like, then tag any image as a fabric, a trim, a
              customization or a photography reference and attach it to a product.
            </p>
          </div>
        )}

        {dropping && (
          <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-[var(--sa-accent)] bg-[var(--sa-accent-light)]" />
        )}

        {/* Controls */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-1 shadow-sm">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.2))}
            className="rounded p-1.5 text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
          >
            <ZoomOut size={14} />
          </button>
          <span className="w-10 text-center text-[11.5px] tabular-nums text-[var(--sa-text-tertiary)]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.2))}
            className="rounded p-1.5 text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
          >
            <ZoomIn size={14} />
          </button>
          <button
            aria-label="Reset view"
            onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }); }}
            className="rounded p-1.5 text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {canEdit && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {uploading > 0 && (
              <span className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-1.5 text-[12px] text-[var(--sa-text-secondary)]">
                <Loader2 size={12} className="animate-spin" /> {uploading} uploading
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white shadow-sm"
            >
              <Plus size={13} /> Add images
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void uploadFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </div>
        )}

        {error && (
          <p className="absolute bottom-3 right-3 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-500/15 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Inspector */}
      {selectedItem && (
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-[var(--sa-border)] bg-[var(--sa-window)]">
          <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-3 py-2.5">
            <p className="flex-1 text-[12.5px] font-semibold text-[var(--sa-text-primary)]">Image</p>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-3 p-3">
            <input
              className="w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
              placeholder="Caption"
              defaultValue={selectedItem.caption ?? ""}
              disabled={!canEdit}
              onBlur={(e) => {
                const caption = e.target.value;
                setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, caption } : i)));
                void updateItem({ itemId: selectedItem.id, caption });
              }}
            />

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                Size
              </p>
              <input
                type="range"
                min={120}
                max={640}
                step={20}
                value={selectedItem.width}
                disabled={!canEdit}
                className="w-full"
                onChange={(e) => {
                  const width = Number(e.target.value);
                  setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, width } : i)));
                }}
                onPointerUp={() =>
                  void moveItem({
                    itemId: selectedItem.id,
                    x: selectedItem.x, y: selectedItem.y, width: selectedItem.width,
                  })
                }
              />
            </div>

            <LinkPanel
              itemId={selectedItem.id}
              products={products}
              links={selectedLinks}
              canEdit={canEdit}
              onLinked={(link) => setLinks((prev) => [...prev.filter((l) => l.id !== link.id), link])}
              onUnlinked={(id) => setLinks((prev) => prev.filter((l) => l.id !== id))}
              onError={setError}
            />

            {canEdit && (
              <button
                onClick={async () => {
                  setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
                  setSelected(null);
                  await removeItem(selectedItem.id);
                }}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-md border border-[var(--sa-border)] py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:border-red-300 hover:text-red-500"
              >
                <Trash2 size={12} /> Remove from board
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function LinkPanel({
  itemId, products, links, canEdit, onLinked, onUnlinked, onError,
}: {
  itemId: string;
  products: Product[];
  links: MoodboardLink[];
  canEdit: boolean;
  onLinked: (l: MoodboardLink) => void;
  onUnlinked: (id: string) => void;
  onError: (e: string) => void;
}) {
  const [productId, setProductId] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("fabric");
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "A product";

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
        Use this on a product
      </p>

      {links.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {links.map((l) => (
            <div key={l.id} className="group flex items-center gap-1.5 rounded-md bg-[var(--sa-hover)] px-2 py-1.5">
              <Link2 size={11} className="shrink-0 text-[var(--sa-text-tertiary)]" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--sa-text-primary)]">
                {nameOf(l.product_id)}
              </span>
              <span className="shrink-0 text-[10.5px] font-medium text-[var(--sa-accent)]">
                {LINK_LABEL[l.link_type] ?? l.link_type}
              </span>
              {canEdit && (
                <button
                  aria-label="Remove link"
                  onClick={async () => { onUnlinked(l.id); await unlinkItem(l.id); }}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                >
                  <X size={11} className="text-[var(--sa-text-tertiary)]" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!canEdit ? null : products.length === 0 ? (
        <p className="text-[11.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
          No products yet — once there are, you can attach this image to one.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <select
            className="w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">Choose a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project ? `${p.project} — ${p.name}` : p.name}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2 py-1.5 text-[12px] text-[var(--sa-text-primary)] outline-none"
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as LinkType)}
          >
            {LINK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>

          <p className="text-[10.5px] leading-snug text-[var(--sa-text-tertiary)]">
            {LINK_TYPES.find((t) => t.id === linkType)?.hint}
          </p>

          <button
            disabled={!productId || busy}
            onClick={async () => {
              setBusy(true);
              const res = await linkItemToProduct({ itemId, productId, linkType });
              setBusy(false);
              if (!res.success) { onError(res.error); return; }
              onLinked(res.link);
              setProductId("");
            }}
            className="rounded-md bg-[var(--sa-accent)] py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          >
            Attach
          </button>
        </div>
      )}
    </div>
  );
}
