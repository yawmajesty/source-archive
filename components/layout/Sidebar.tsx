"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  DollarSign,
  Factory,
  CheckSquare,
  Users,
  Inbox,
  Folder,
  FolderOpen,
  Settings,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/shared/DarkModeToggle";
import type { Client } from "@/lib/mock-data";

interface Props {
  clients: Client[];
  overdueMilestones: number;
  pendingApprovals: number;
}

const WORKSPACE_NAV = [
  { href: "/dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { href: "/clients",    label: "Clients",     icon: Users },
  { href: "/products",   label: "All Products", icon: Package },
  { href: "/tasks",      label: "Tasks",        icon: CheckSquare },
  { href: "/costs",      label: "Cost Tracker", icon: DollarSign },
  { href: "/factories",  label: "Factories",    icon: Factory },
  { href: "/leads",      label: "Leads",        icon: Inbox },
];

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const fadeSlideItem = {
  hidden: { opacity: 0, x: -6 },
  show:  { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  hasActivity,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  hasActivity?: boolean;
  badge?: number;
}) {
  return (
    <motion.div variants={fadeSlideItem}>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-none transition-colors group",
          isActive
            ? "bg-[var(--sa-selected)] text-[var(--sa-accent)] font-medium"
            : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)]"
        )}
      >
        <Icon
          size={14}
          strokeWidth={isActive ? 2.2 : 1.8}
          className={cn(isActive ? "text-[var(--sa-accent)]" : "text-[var(--sa-text-tertiary)] group-hover:text-[var(--sa-text-secondary)]")}
        />
        <span className="flex-1 truncate">{label}</span>
        {hasActivity && !isActive && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--sa-accent)]" />
        )}
        {badge != null && badge > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sa-danger)] px-1 text-[10px] font-medium text-white leading-none">
            {badge}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

export function Sidebar({ clients, overdueMilestones, pendingApprovals }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="flex h-full w-60 flex-col shrink-0 glass bg-[var(--sa-sidebar)] panel-border-r"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 panel-border-b">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--sa-accent)] text-white text-[12px] font-bold leading-none select-none">
            S
          </div>
          <span className="text-[15px] font-semibold text-[var(--sa-text-primary)] tracking-tight">
            Source<span className="font-light opacity-70">[Archive]</span>
          </span>
        </Link>
        <DarkModeToggle />
      </div>

      {/* Scrollable nav body */}
      <div className="flex-1 overflow-y-auto py-2 px-2">

        {/* WORKSPACES */}
        <div className="mb-1">
          <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Workspaces
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {WORKSPACE_NAV.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={isActive(item.href)}
              />
            ))}
          </motion.div>
        </div>

        {/* CLIENTS */}
        <div className="mb-1 mt-3">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Clients
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {clients.map((client) => {
              const href = `/clients/${client.id}`;
              const active = isActive(href);
              return (
                <motion.div key={client.id} variants={fadeSlideItem}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-none transition-colors group",
                      active
                        ? "bg-[var(--sa-selected)] text-[var(--sa-accent)] font-medium"
                        : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)]"
                    )}
                  >
                    {active ? (
                      <FolderOpen
                        size={14}
                        strokeWidth={2}
                        className="text-[var(--sa-accent)] shrink-0"
                      />
                    ) : (
                      <Folder
                        size={14}
                        strokeWidth={1.8}
                        className="text-[var(--sa-text-tertiary)] group-hover:text-[var(--sa-text-secondary)] shrink-0"
                      />
                    )}
                    <span className="flex-1 truncate">{client.name}</span>
                    {client.has_new_activity && !active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--sa-accent)]" />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* VIEWS */}
        <div className="mb-1 mt-3">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Views
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <NavItem
              href="/views/needs-attention"
              label="Needs Attention"
              icon={AlertCircle}
              isActive={isActive("/views/needs-attention")}
              badge={overdueMilestones}
            />
            <NavItem
              href="/views/awaiting-approval"
              label="Awaiting Approval"
              icon={Clock}
              isActive={isActive("/views/awaiting-approval")}
              badge={pendingApprovals}
            />
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 pb-3 panel-border-b" style={{ borderTop: "1px solid var(--sa-border)" }}>
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-secondary)] transition-colors mt-2"
        >
          <Settings size={14} strokeWidth={1.8} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
