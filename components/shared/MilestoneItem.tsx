"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/lib/mock-data";

interface Props {
  milestone: Milestone;
  onComplete?: (id: string) => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function MilestoneItem({ milestone, onComplete }: Props) {
  const [completed, setCompleted] = useState(!!milestone.completed_at);
  const now = new Date();
  const isOverdue = !completed && new Date(milestone.due_date) < now;

  function handleComplete() {
    if (completed) return;
    setCompleted(true);
    onComplete?.(milestone.id);
  }

  return (
    <div className="flex items-start gap-3 py-2">
      {/* Checkbox / indicator */}
      <button
        onClick={handleComplete}
        className="mt-0.5 shrink-0"
        disabled={completed}
        title={completed ? "Completed" : "Mark as complete"}
      >
        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sa-success)]"
            >
              <Check size={9} className="text-white" strokeWidth={3} />
            </motion.div>
          ) : isOverdue ? (
            <motion.div key="overdue" className="flex h-4 w-4 items-center justify-center">
              <AlertCircle size={14} className="text-[var(--sa-danger)]" strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div key="upcoming" className="flex h-4 w-4 items-center justify-center">
              <Circle size={12} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Vertical line connector (not on last item — handled by parent) */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] leading-snug",
            completed
              ? "line-through text-[var(--sa-text-tertiary)]"
              : isOverdue
              ? "text-[var(--sa-text-primary)] font-medium"
              : "text-[var(--sa-text-primary)]"
          )}
        >
          {milestone.title}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px]",
              completed
                ? "text-[var(--sa-success)]"
                : isOverdue
                ? "text-[var(--sa-danger)] font-medium"
                : "text-[var(--sa-text-tertiary)]"
            )}
          >
            {completed
              ? `Done ${formatDate(milestone.completed_at!)}`
              : isOverdue
              ? `Overdue · Due ${formatDate(milestone.due_date)}`
              : `Due ${formatDate(milestone.due_date)}`}
          </span>
        </div>
        {milestone.notes && !completed && (
          <p className="text-[11px] text-[var(--sa-text-tertiary)] italic">{milestone.notes}</p>
        )}
      </div>
    </div>
  );
}
