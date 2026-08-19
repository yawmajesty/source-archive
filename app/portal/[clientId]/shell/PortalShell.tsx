"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Three-zone macOS app shell.
//
// The old portal was a centred max-w-4xl column, which left ~480px of dead
// space per side on a wide display and put navigation in a pill row that had
// already run out of room at six items. The gutters now carry navigation and
// context, which is what every serious workspace tool does with them.
//
// Each zone scrolls independently: only the center scrolls in normal use, so
// a long activity feed never pushes the product grid.
// ─────────────────────────────────────────────────────────────

const RIGHT_RAIL_KEY = "portal-right-rail";

export function useRightRail(): [boolean, () => void] {
  // Default open on wide screens; the CSS collapses it below 1180px anyway.
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(RIGHT_RAIL_KEY);
    if (stored !== null) setOpen(stored === "open");
  }, []);

  return [
    open,
    () =>
      setOpen((prev) => {
        const next = !prev;
        window.localStorage.setItem(RIGHT_RAIL_KEY, next ? "open" : "closed");
        return next;
      }),
  ];
}

export function PortalShell({
  topbar,
  left,
  right,
  tabbar,
  rightOpen,
  children,
}: {
  topbar: ReactNode;
  left: ReactNode;
  right?: ReactNode;
  tabbar?: ReactNode;
  rightOpen: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="portal-app"
      data-right={rightOpen ? "open" : "closed"}
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif" }}
    >
      <div className="portal-topbar mac-toolbar hairline-b flex items-center gap-3 px-3">{topbar}</div>
      <aside className="portal-left mac-sidebar hairline-r px-2 py-3">{left}</aside>
      <main className="portal-center">
        <div className="portal-center-inner px-6 py-5">{children}</div>
      </main>
      {right ? <aside className="portal-right mac-sidebar hairline-l px-4 py-4">{right}</aside> : null}
      {tabbar ? <nav className="portal-tabbar mac-toolbar items-center justify-around">{tabbar}</nav> : null}
    </div>
  );
}

export function RightRailToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={open ? "Hide context panel" : "Show context panel"}
      title={open ? "Hide context panel" : "Show context panel"}
      className="flex h-[26px] w-[26px] items-center justify-center rounded-[6.5px] transition-colors"
      style={{ color: open ? "var(--accent)" : "var(--label-2)", background: open ? "var(--fill)" : "transparent" }}
    >
      <PanelRight size={15} strokeWidth={1.6} />
    </button>
  );
}

// Section heading used throughout both rails.
export function RailSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[.04em]" style={{ color: "var(--label-3)" }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mac-segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          data-selected={value === o.id}
          className="mac-segment"
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
