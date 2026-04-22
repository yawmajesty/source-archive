"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Update } from "@/lib/mock-data";

interface Props {
  update: Update;
  onToggleVisibility?: (id: string, visible: boolean) => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export function UpdateItem({ update, onToggleVisibility }: Props) {
  const [visible, setVisible] = useState(update.visible_to_client);

  function toggle() {
    const next = !visible;
    setVisible(next);
    onToggleVisibility?.(update.id, next);
  }

  return (
    <div className={cn(
      "flex gap-3 py-3 border-b border-[var(--sa-border)] last:border-0",
      !visible && "opacity-60"
    )}>
      {/* Author bubble */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sa-accent-light)] text-[10px] font-semibold text-[var(--sa-accent)] mt-0.5">
        {update.author_initials}
      </div>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-[var(--sa-text-primary)]">{update.author}</span>
            <span className="text-[11px] text-[var(--sa-text-tertiary)]">{timeAgo(update.created_at)}</span>
          </div>
          <button
            onClick={toggle}
            className="shrink-0 flex items-center gap-1 text-[11px] text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)] transition-colors"
            title={visible ? "Visible to client — click to hide" : "Hidden from client — click to show"}
          >
            {visible
              ? <Eye size={11} strokeWidth={1.8} />
              : <EyeOff size={11} strokeWidth={1.8} />
            }
          </button>
        </div>
        <p className="text-[13px] text-[var(--sa-text-secondary)] leading-snug">{update.text}</p>
      </div>
    </div>
  );
}
