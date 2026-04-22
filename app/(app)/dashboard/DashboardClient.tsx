"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Briefcase,
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { StageTrack } from "@/components/shared/StageTrack";
import type { DashboardStats, ActivityItem, ClientSummary } from "@/lib/data";

interface Props {
  stats: DashboardStats;
  activity: ActivityItem[];
  clients: ClientSummary[];
}

function HealthRing({ score }: { score: number }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const progress = score / 100;

  const color =
    score >= 80 ? "var(--sa-success)"
    : score >= 60 ? "var(--sa-warning)"
    : "var(--sa-danger)";

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke="var(--sa-border-strong)"
          strokeWidth="7"
        />
        <motion.circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-xl font-semibold text-[var(--sa-text-primary)]">
          {score}
        </span>
        <span className="text-[10px] text-[var(--sa-text-tertiary)]">health</span>
      </div>
    </div>
  );
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

export function DashboardClient({ stats, activity, clients }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Dashboard</h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Active Projects"
            value={stats.activeProjects}
            icon={Briefcase}
          />
          <StatCard
            label="In Sampling"
            value={stats.productsInSampling}
            icon={FlaskConical}
          />
          <StatCard
            label="Pipeline Value"
            value={stats.totalPipelineValue}
            prefix="$"
            icon={TrendingUp}
          />
          <StatCard
            label="Overdue Milestones"
            value={stats.overdueMilestones}
            icon={AlertTriangle}
          />
        </div>

        {/* Middle row: health + client summary */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Pipeline Health */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 flex flex-col gap-4"
          >
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
              Pipeline Health
            </h2>
            <div className="flex items-center gap-6">
              <HealthRing score={stats.pipelineHealthScore} />
              <div className="flex flex-col gap-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--sa-success)]" />
                  <span className="text-[var(--sa-text-secondary)]">On track</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--sa-warning)]" />
                  <span className="text-[var(--sa-text-secondary)]">
                    {stats.overdueMilestones} overdue
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--sa-accent)]" />
                  <span className="text-[var(--sa-text-secondary)]">
                    {stats.productsInSampling} sampling
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Client Summary */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="xl:col-span-2 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 flex flex-col gap-3"
          >
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
              Clients
            </h2>
            <div className="flex flex-col gap-2">
              {clients.map(({ client, totalProducts, completedProducts, activeProjects }) => {
                const pct = totalProducts > 0 ? (completedProducts / totalProducts) * 100 : 0;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--sa-hover)] transition-colors group"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sa-accent-light)] text-[13px] font-semibold text-[var(--sa-accent)]">
                      {client.logo_initial}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-[var(--sa-text-primary)] truncate">
                          {client.name}
                        </span>
                        <span className="text-[11px] text-[var(--sa-text-tertiary)] shrink-0">
                          {completedProducts}/{totalProducts} shipped
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-[var(--sa-border-strong)] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-[var(--sa-accent)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                    </div>
                    <ChevronRight
                      size={13}
                      className="shrink-0 text-[var(--sa-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5"
        >
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--sa-text-secondary)]">
            Recent Activity
          </h2>
          <div className="flex flex-col">
            {activity.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className="flex gap-3 py-2.5 border-b border-[var(--sa-border)] last:border-0"
              >
                {/* Author bubble */}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sa-accent-light)] text-[10px] font-semibold text-[var(--sa-accent)] mt-0.5">
                  {item.author_initials}
                </div>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/products/${item.product_id}`}
                      className="text-[13px] font-medium text-[var(--sa-text-primary)] hover:text-[var(--sa-accent)] transition-colors truncate"
                    >
                      {item.product_name}
                    </Link>
                    <span className="text-[11px] text-[var(--sa-text-tertiary)]">
                      · {item.client_name}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--sa-text-secondary)] line-clamp-2">
                    {item.text}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--sa-text-tertiary)] mt-0.5">
                  {timeAgo(item.created_at)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
