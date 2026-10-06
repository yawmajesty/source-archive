"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Package, DollarSign, Factory, CheckSquare,
  Users, Inbox, Folder, FolderOpen, Settings, Menu, X, LogOut, Layers, FileText, Sparkles, Calculator, Mail, Contact, Camera, DatabaseBackup, Receipt,
  Star, ChevronRight,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { toggleClientPin } from "@/app/(app)/clients/actions";
import { DarkModeToggle } from "@/components/shared/DarkModeToggle";
import type { Client } from "@/lib/mock-data";

interface Props {
  clients: Client[];
  overdueMilestones: number;
  pendingApprovals: number;
  userEmail?: string | null;
}

const WORKSPACE_NAV = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/clients",    label: "Clients",      icon: Users },
  { href: "/crm",        label: "CRM",          icon: Contact },
  { href: "/products",   label: "All Products", icon: Package },
  { href: "/tasks",      label: "Tasks",        icon: CheckSquare },
  { href: "/costs",      label: "Cost Tracker", icon: DollarSign },
  { href: "/invoices",   label: "Invoices",     icon: Receipt },
  { href: "/factories",  label: "Factories",    icon: Factory },
  { href: "/fabrics",    label: "Fabrics",      icon: Layers },
  { href: "/studio-plan", label: "Shoots & Marketing", icon: Camera },
  { href: "/team",       label: "Team",         icon: Users },
  { href: "/leads",       label: "Leads",        icon: Inbox },
  { href: "/references",  label: "References",   icon: Layers },
  { href: "/techpacks",   label: "Tech Packs",   icon: FileText },
  { href: "/pricing-tool", label: "Pricing Tool", icon: Calculator },
  { href: "/emails",      label: "Emails",       icon: Mail },
  { href: "/settings/backups", label: "Backups", icon: DatabaseBackup },
];

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const fadeSlideItem = {
  hidden: { opacity: 0, x: -6 },
  show:  { opacity: 1, x: 0, transition: { duration: 0.2 } },
};

/**
 * One client in the sidebar.
 *
 * The star only appears on hover, or when it is already pinned — a column
 * of stars down a list of twenty-four is noise, and the pin is a thing you
 * do occasionally rather than something you need to see constantly.
 */
function ClientRow({
  client, active, onNavClick, onPinned,
}: {
  client: Client;
  active: boolean;
  onNavClick?: () => void;
  onPinned: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pinned = Boolean(client.pinned_at);

  async function togglePin(e: React.MouseEvent) {
    // The row is a link; pinning must not navigate.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    onPinned(null);
    const res = await toggleClientPin(client.id, !pinned);
    setBusy(false);
    if (!res.success) onPinned(res.error);
  }

  return (
    <motion.div variants={fadeSlideItem}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 transition-colors",
          active ? "bg-[var(--sa-selected)]" : "hover:bg-[var(--sa-hover)]",
        )}
      >
        <Link
          href={`/clients/${client.id}`}
          onClick={onNavClick}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-none transition-colors",
            active ? "font-medium text-[var(--sa-accent)]" : "text-[var(--sa-text-secondary)] group-hover:text-[var(--sa-text-primary)]",
          )}
        >
          {active
            ? <FolderOpen size={14} strokeWidth={2} className="shrink-0 text-[var(--sa-accent)]" />
            : <Folder size={14} strokeWidth={1.8} className="shrink-0 text-[var(--sa-text-tertiary)] group-hover:text-[var(--sa-text-secondary)]" />}
          <span className="flex-1 truncate">{client.name}</span>
          {client.has_new_activity && !active && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sa-accent)]" />
          )}
        </Link>

        <button
          onClick={togglePin}
          disabled={busy}
          aria-label={pinned ? `Unpin ${client.name}` : `Pin ${client.name}`}
          title={pinned ? "Unpin from the sidebar" : "Pin to the top of the sidebar"}
          className={cn(
            "shrink-0 rounded p-1 transition-opacity disabled:opacity-40",
            pinned
              ? "text-[var(--sa-accent)] opacity-100"
              : "text-[var(--sa-text-tertiary)] opacity-0 hover:text-[var(--sa-text-primary)] focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          <Star size={12} strokeWidth={2} fill={pinned ? "currentColor" : "none"} />
        </button>
      </div>
    </motion.div>
  );
}

function NavItem({
  href, label, icon: Icon, isActive, hasActivity, badge, onClick,
}: {
  href: string; label: string; icon: React.ElementType;
  isActive: boolean; hasActivity?: boolean; badge?: number; onClick?: () => void;
}) {
  return (
    <motion.div variants={fadeSlideItem}>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-none transition-colors group",
          isActive
            ? "bg-[var(--sa-selected)] text-[var(--sa-accent)] font-medium"
            : "text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-primary)]"
        )}
      >
        <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8}
          className={cn(isActive ? "text-[var(--sa-accent)]" : "text-[var(--sa-text-tertiary)] group-hover:text-[var(--sa-text-secondary)]")}
        />
        <span className="flex-1 truncate">{label}</span>
        {hasActivity && !isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--sa-accent)]" />}
        {badge != null && badge > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sa-danger)] px-1 text-[10px] font-medium text-white leading-none">
            {badge}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function SidebarContent({
  clients, overdueMilestones, pendingApprovals, userEmail, onNavClick,
}: Props & { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const [showInactive, setShowInactive] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Pinned first, in the order they were pinned; then everyone still being
  // worked with; then the inactive ones, folded away. Before migration 039
  // pinned_at is simply absent and this collapses to the old two groups.
  const pinnedClients = clients
    .filter((c) => c.pinned_at)
    .sort((a, b) => String(a.pinned_at).localeCompare(String(b.pinned_at)));
  const unpinned = clients.filter((c) => !c.pinned_at);
  const liveClients = unpinned.filter((c) => c.status !== "inactive");
  const inactiveClients = unpinned.filter((c) => c.status === "inactive");

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Scrollable nav body */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <div className="mb-1">
          <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Workspaces
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show">
            {WORKSPACE_NAV.map((item) => (
              <NavItem key={item.href} {...item} isActive={isActive(item.href)} onClick={onNavClick} />
            ))}
          </motion.div>
        </div>

        <div className="mb-1 mt-3">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            My Brand
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show">
            <NavItem href="/studio" label="Studio" icon={Sparkles} isActive={isActive("/studio")} onClick={onNavClick} />
          </motion.div>
        </div>

        {pinnedClients.length > 0 && (
          <div className="mb-1 mt-3">
            <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
              <Star size={9} strokeWidth={2.5} fill="currentColor" /> Pinned
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              {pinnedClients.map((client) => (
                <ClientRow key={client.id} client={client} active={isActive(`/clients/${client.id}`)}
                  onNavClick={onNavClick} onPinned={setPinError} />
              ))}
            </motion.div>
          </div>
        )}

        <div className="mb-1 mt-3">
          <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
            Clients
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="show">
            {liveClients.map((client) => (
              <ClientRow key={client.id} client={client} active={isActive(`/clients/${client.id}`)}
                onNavClick={onNavClick} onPinned={setPinError} />
            ))}
          </motion.div>

          {/* Inactive clients keep their records and their portal; they just
              stop taking up the list you scroll every day. */}
          {inactiveClients.length > 0 && (
            <>
              {showInactive && (
                <motion.div variants={staggerContainer} initial="hidden" animate="show">
                  {inactiveClients.map((client) => (
                    <ClientRow key={client.id} client={client} active={isActive(`/clients/${client.id}`)}
                      onNavClick={onNavClick} onPinned={setPinError} />
                  ))}
                </motion.div>
              )}
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[11.5px] text-[var(--sa-text-tertiary)] transition-colors hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-secondary)]"
              >
                <ChevronRight size={11} strokeWidth={2}
                  className={cn("shrink-0 transition-transform", showInactive && "rotate-90")} />
                {showInactive ? "Hide" : "Show"} {inactiveClients.length} inactive
              </button>
            </>
          )}

          {pinError && (
            <p className="px-2.5 pt-1.5 text-[11px] leading-snug" style={{ color: "var(--sa-danger)" }}>
              {pinError}
            </p>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="px-2 pb-3 pt-2 flex flex-col gap-0.5" style={{ borderTop: "1px solid var(--sa-border)" }}>
        <Link href="/settings" onClick={onNavClick}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-secondary)] transition-colors"
        >
          <Settings size={14} strokeWidth={1.8} />
          <span>Settings</span>
        </Link>

        {userEmail && (
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2 mt-0.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--sa-accent)] text-white text-[10px] font-semibold select-none">
              {userEmail[0].toUpperCase()}
            </div>
            <span className="flex-1 truncate text-[11px] text-[var(--sa-text-tertiary)]">{userEmail}</span>
          </div>
        )}

        <button
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-danger)] transition-colors"
        >
          <LogOut size={14} strokeWidth={1.8} />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );
}

export function Sidebar({ clients, overdueMilestones, pendingApprovals, userEmail }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex h-full w-60 flex-col shrink-0 glass bg-[var(--sa-sidebar)] panel-border-r">
        <div className="flex items-center justify-between px-4 py-3.5 panel-border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--sa-accent)] text-white text-[12px] font-bold leading-none select-none">S</div>
            <span className="text-[15px] font-semibold text-[var(--sa-text-primary)] tracking-tight">
              Source<span className="font-light opacity-70">[Archive]</span>
            </span>
          </Link>
          <DarkModeToggle />
        </div>
        <SidebarContent
          clients={clients}
          overdueMilestones={overdueMilestones}
          pendingApprovals={pendingApprovals}
          userEmail={userEmail}
        />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-12 bg-[var(--sa-sidebar)] border-b border-[var(--sa-border)]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--sa-accent)] text-white text-[12px] font-bold leading-none select-none">S</div>
          <span className="text-[15px] font-semibold text-[var(--sa-text-primary)] tracking-tight">
            Source<span className="font-light opacity-70">[Archive]</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-black/40"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--sa-sidebar)] shadow-xl"
            >
              <div className="flex items-center justify-between px-4 py-3.5 panel-border-b">
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--sa-accent)] text-white text-[12px] font-bold leading-none select-none">S</div>
                  <span className="text-[15px] font-semibold text-[var(--sa-text-primary)] tracking-tight">
                    Source<span className="font-light opacity-70">[Archive]</span>
                  </span>
                </Link>
                <button onClick={() => setMobileOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
                  <X size={16} />
                </button>
              </div>
              <SidebarContent
                clients={clients}
                overdueMilestones={overdueMilestones}
                pendingApprovals={pendingApprovals}
                userEmail={userEmail}
                onNavClick={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
