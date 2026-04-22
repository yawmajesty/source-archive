"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  separator?: boolean;
  shortcut?: string;
}

interface Position { x: number; y: number }

interface Props {
  items: ContextMenuItem[];
  children: React.ReactNode;
  className?: string;
}

export function ContextMenu({ items, children, className }: Props) {
  const [pos, setPos] = useState<Position | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function open(e: React.MouseEvent) {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  }

  function close() {
    setPos(null);
  }

  useEffect(() => {
    if (!pos) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [pos]);

  // Clamp menu within viewport
  function getMenuStyle(p: Position): React.CSSProperties {
    const menuW = 200;
    const menuH = items.length * 32 + 8;
    const x = Math.min(p.x, window.innerWidth - menuW - 8);
    const y = Math.min(p.y, window.innerHeight - menuH - 8);
    return { position: "fixed", top: y, left: x, zIndex: 9999 };
  }

  return (
    <>
      <div onContextMenu={open} className={className}>
        {children}
      </div>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <motion.div
                ref={menuRef}
                style={getMenuStyle(pos)}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="rounded-xl border border-[var(--sa-border-strong)] bg-[var(--sa-window)] py-1 shadow-xl shadow-black/10 min-w-48"
              >
                {items.map((item, i) => (
                  <div key={i}>
                    {item.separator && i > 0 && (
                      <div className="my-1 h-px bg-[var(--sa-border)]" />
                    )}
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-[13px] leading-none hover:bg-[var(--sa-hover)] transition-colors text-left",
                        item.variant === "danger"
                          ? "text-[var(--sa-danger)]"
                          : "text-[var(--sa-text-primary)]"
                      )}
                      onClick={() => {
                        item.onClick();
                        close();
                      }}
                    >
                      {item.icon && <span className="opacity-60">{item.icon}</span>}
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[11px] text-[var(--sa-text-tertiary)]">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
