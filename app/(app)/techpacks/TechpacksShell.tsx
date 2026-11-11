"use client";

import { useState } from "react";
import { TechpacksClient } from "./TechpacksClient";
import { ProductionBoard } from "./ProductionBoard";
import type { ProductionBoard as Board } from "./production-actions";

// Two different things share the name "tech pack": what a client asks us
// for, and what a studio draws for us. They were never the same list, and
// putting them behind one tab bar is clearer than a second nav entry.
export function TechpacksShell({
  submissions,
  board,
}: {
  submissions: Parameters<typeof TechpacksClient>[0]["submissions"];
  board: Board;
}) {
  const [tab, setTab] = useState<"production" | "requests">(
    board.jobs.length > 0 || board.studios.length > 0 ? "production" : "requests",
  );

  const waiting = board.jobs.filter((j) => j.status === "requested").length;
  const delivered = board.jobs.filter((j) => j.status === "delivered").length;

  // The app shell gives every page a fixed-height column with overflow
  // hidden, so a page that does not scroll itself is simply clipped. Header
  // and tabs stay put; only the content below them scrolls. Wide because
  // five Kanban columns need about 1250px.
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto w-full max-w-[1600px]">
          <header className="mb-4">
            <h1 className="text-lg font-semibold text-[var(--sa-text-primary)]">Tech Packs</h1>
            <p className="mt-0.5 text-xs text-[var(--sa-text-secondary)]">
              What studios are drawing for us, and what clients have asked us for.
            </p>
          </header>

          <div className="flex gap-1 overflow-x-auto border-b border-[var(--sa-border)]">
            <Tab active={tab === "production"} onClick={() => setTab("production")}
              label="In production" badge={delivered > 0 ? delivered : waiting || undefined} />
            <Tab active={tab === "requests"} onClick={() => setTab("requests")}
              label="Client requests" badge={submissions.length || undefined} />
          </div>
        </div>
      </div>

      {tab === "production" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
            <ProductionBoard board={board} />
          </div>
        </div>
      ) : (
        // The requests view is its own full-height list/detail split, so it
        // takes the space and does its own scrolling inside.
        <div className="min-h-0 flex-1 overflow-hidden">
          <TechpacksClient submissions={submissions} />
        </div>
      )}
    </div>
  );
}

function Tab({
  active, onClick, label, badge,
}: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="relative shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors"
      style={{ color: active ? "var(--sa-text-primary)" : "var(--sa-text-tertiary)" }}
    >
      {label}
      {badge != null && (
        <span className="ml-1.5 rounded-full bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] tabular-nums">
          {badge}
        </span>
      )}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5" style={{ background: "var(--sa-accent)" }} />}
    </button>
  );
}
