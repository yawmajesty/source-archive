"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  className?: string;
}

export function ResizablePanel({
  children,
  defaultWidth = 360,
  minWidth = 280,
  maxWidth = 480,
  storageKey = "sa-panel2-width",
  className,
}: Props) {
  const [width, setWidth] = useState(defaultWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Load persisted width
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const w = Number(saved);
        if (w >= minWidth && w <= maxWidth) setWidth(w);
      }
    } catch {}
  }, [storageKey, minWidth, maxWidth]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - startX.current;
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
        setWidth(next);
      };

      const onUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(storageKey, String(width));
        } catch {}
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, minWidth, maxWidth, storageKey]
  );

  return (
    <div
      className={cn("relative flex shrink-0 flex-col panel-border-r", className)}
      style={{ width }}
    >
      <div className="flex-1 overflow-hidden">{children}</div>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--sa-accent)] opacity-0 hover:opacity-40 transition-opacity z-10"
        title="Drag to resize"
      />
    </div>
  );
}
