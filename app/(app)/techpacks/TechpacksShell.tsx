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

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-[var(--sa-text-primary)]">Tech Packs</h1>
        <p className="mt-0.5 text-xs text-[var(--sa-text-secondary)]">
          What studios are drawing for us, and what clients have asked us for.
        </p>
      </header>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--sa-border)]">
        <Tab active={tab === "production"} onClick={() => setTab("production")}
          label="In production" badge={delivered > 0 ? delivered : waiting || undefined} />
        <Tab active={tab === "requests"} onClick={() => setTab("requests")}
          label="Client requests" badge={submissions.length || undefined} />
      </div>

      {tab === "production" ? <ProductionBoard board={board} /> : <TechpacksClient submissions={submissions} />}
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
