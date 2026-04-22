"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon?: LucideIcon;
  className?: string;
}

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export function StatCard({ label, value, prefix, suffix, trend, trendLabel, icon: Icon, className }: Props) {
  const count = useCountUp(value);

  const formatted =
    value >= 1000
      ? (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + "k"
      : count.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-[var(--sa-window)] border border-[var(--sa-border)] p-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--sa-text-secondary)] uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sa-accent-light)]">
            <Icon size={14} className="text-[var(--sa-accent)]" strokeWidth={2} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && (
          <span className="text-sm font-medium text-[var(--sa-text-secondary)]">{prefix}</span>
        )}
        <span className="font-mono text-2xl font-semibold text-[var(--sa-text-primary)] leading-none">
          {value >= 1000 ? formatted : count.toLocaleString()}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-[var(--sa-text-secondary)]">{suffix}</span>
        )}
      </div>
      {trendLabel && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-xs",
              trend === "up" && "text-[var(--sa-success)]",
              trend === "down" && "text-[var(--sa-danger)]",
              trend === "neutral" && "text-[var(--sa-text-tertiary)]"
            )}
          >
            {trendLabel}
          </span>
        </div>
      )}
    </motion.div>
  );
}
