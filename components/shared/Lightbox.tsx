"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// Looking at the actual photograph.
//
// Thumbnails are square and cropped, which is right for a grid and wrong
// for checking a sample: a sleeve or a hem sitting outside the square was
// simply not visible anywhere in the app. This shows the file as it was
// uploaded — contained, not cropped, and at full resolution rather than
// the resized version the grid uses.
//
// Lifted out of the client portal, which had it, so the agency side stops
// being the only place you cannot see your own photographs properly.
// ─────────────────────────────────────────────────────────────

export interface LightboxItem {
  url: string;
  caption?: string | null;
  kind?: "image" | "video" | null;
}

export function Lightbox({
  items,
  startIndex = 0,
  onClose,
}: {
  items: LightboxItem[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const current = items[index];

  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, [index]);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(items.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, close]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      setScale((s) => Math.min(5, Math.max(1, s - e.deltaY * 0.003)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    setOffset({ x: offsetStart.current.x + e.clientX - dragStart.current.x, y: offsetStart.current.y + e.clientY - dragStart.current.y });
  }
  function onMouseUp() { dragging.current = false; }

  function onImgClick() {
    if (scale > 1) { setScale(1); setOffset({ x: 0, y: 0 }); }
    else setScale(2.5);
  }

  const nav = (dir: 1 | -1) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => Math.max(0, Math.min(items.length - 1, i + dir)));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center select-none" style={{ background: "rgba(0,0,0,0.93)" }}>
      {/* Header */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-10">
        <span className="text-white/50 text-[13px]">{index + 1} / {items.length}</span>
        <button onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full text-white text-[18px]" style={{ background: "rgba(255,255,255,0.12)" }}>✕</button>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex items-center justify-center"
        style={{ width: "100vw", height: "100vh", overflow: "hidden", cursor: scale > 1 ? "grab" : "zoom-in" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onImgClick}
      >
        {current?.kind === "video" ? (
          <video
            src={current.url}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", pointerEvents: "auto" }}
          />
        ) : (
          <img
            src={current?.url}
            alt={current?.caption ?? ""}
            draggable={false}
            style={{
              maxWidth: "92vw",
              maxHeight: "88vh",
              objectFit: "contain",
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transition: dragging.current ? "none" : "transform 0.2s ease",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Prev */}
      {index > 0 && (
        <button onClick={nav(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white text-[22px]" style={{ background: "rgba(255,255,255,0.12)" }}>‹</button>
      )}
      {/* Next */}
      {index < items.length - 1 && (
        <button onClick={nav(1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white text-[22px]" style={{ background: "rgba(255,255,255,0.12)" }}>›</button>
      )}

      {scale === 1 && current?.kind !== "video" && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/30 pointer-events-none">Click or scroll to zoom · arrow keys to navigate</p>
      )}
    </div>
  );
}

// ── Product detail drawer ────────────────────────────────────
