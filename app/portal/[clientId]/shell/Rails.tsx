"use client";

import { useState } from "react";

import {
  LayoutGrid, CheckCircle2, FolderOpen, FileText, Receipt,
  Paperclip, Sparkles, Clock, AlertCircle, Images, PackagePlus, MoreHorizontal, X, Menu,
} from "lucide-react";
import { RailSection } from "./PortalShell";
import type { PortalProject, PortalProduct } from "../page";
import type { SavedInvoice, AgencySettings } from "@/lib/data";

export type PortalRoute =
  | "overview" | "approvals" | "sampling" | "projects"
  | "moodboard" | "newproduct" | "files" | "contracts" | "references";

// ── The decision queue ───────────────────────────────────────
// A brand owner opens the portal to answer one question: what needs me?
// Today they have to hunt for it. This derives that list.

export interface AttentionItem {
  id: string;
  kind: "sample" | "invoice";
  title: string;
  detail: string;
  productId?: string;
}

export function attentionItems(projects: PortalProject[], invoices: SavedInvoice[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const project of projects) {
    for (const product of project.products) {
      // A sample sitting in review is a decision we're waiting on.
      if (product.stage === "sampling") {
        items.push({
          id: `sample-${product.id}`,
          kind: "sample",
          title: product.name,
          detail: `Sample round ${product.sample_round} awaiting your approval`,
          productId: product.id,
        });
      }
    }
  }

  for (const invoice of invoices) {
    if (invoice.status === "sent") {
      items.push({
        id: `invoice-${invoice.id}`,
        kind: "invoice",
        title: invoice.title ?? `Invoice · round ${invoice.round}`,
        detail: "Awaiting payment",
      });
    }
  }

  return items;
}

export interface UpcomingItem { id: string; title: string; date: string; productName: string }

export function upcomingItems(projects: PortalProject[]): UpcomingItem[] {
  const now = Date.now();
  const out: UpcomingItem[] = [];
  for (const project of projects) {
    for (const product of project.products) {
      for (const m of product.milestones) {
        if (m.completed_at) continue;
        const due = new Date(m.due_date).getTime();
        if (Number.isNaN(due) || due < now) continue;
        out.push({ id: m.id, title: m.title, date: m.due_date, productName: product.name });
      }
    }
  }
  return out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6);
}

// ── Left rail ────────────────────────────────────────────────

function NavItem({ icon, label, active, badge, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button className="mac-nav-item w-full" data-active={active} onClick={onClick} title={label}>
      {icon}
      <span className="rail-label flex-1 text-left">{label}</span>
      {badge ? (
        <span
          className="rail-label tnum rounded-full px-1.5 text-[10px] font-semibold"
          style={{ background: active ? "rgba(255,255,255,.25)" : "var(--accent)", color: "#fff" }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function LeftRail({
  route, setRoute, projects, attentionCount, agencySettings, onSelectProject, selectedProjectId,
  header,
}: {
  route: PortalRoute;
  setRoute: (r: PortalRoute) => void;
  projects: PortalProject[];
  attentionCount: number;
  agencySettings: AgencySettings;
  onSelectProject: (id: string) => void;
  selectedProjectId: string | null;
  /**
   * Context shown above the nav — the open product and its siblings.
   * A slot rather than a replacement: the rail used to be swapped out
   * entirely when a product was open, which took Invoices, Files and
   * everything else off the screen with no way back to them.
   */
  header?: React.ReactNode;
}) {
  const ICON = { size: 15, strokeWidth: 1.6 } as const;

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="mac-nav-group">Workspace</div>
      <NavItem icon={<LayoutGrid {...ICON} />} label="Overview" active={route === "overview"} onClick={() => setRoute("overview")} />
      <NavItem icon={<CheckCircle2 {...ICON} />} label="Approvals" active={route === "approvals"} badge={attentionCount || undefined} onClick={() => setRoute("approvals")} />

      <div className="mac-nav-group">Collections</div>
      {projects.map((p) => (
        <button
          key={p.id}
          className="mac-nav-item w-full"
          data-active={route === "projects" && selectedProjectId === p.id}
          onClick={() => { setRoute("projects"); onSelectProject(p.id); }}
          title={p.name}
        >
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
          <span className="rail-label flex-1 truncate text-left">{p.name}</span>
          <span className="rail-label tnum text-[11px]" style={{ color: "var(--label-3)" }}>{p.products.length}</span>
        </button>
      ))}

      <NavItem icon={<Images {...ICON} />} label="Moodboard" active={route === "moodboard"} onClick={() => setRoute("moodboard")} />
      <NavItem icon={<PackagePlus {...ICON} />} label="Brief a product" active={route === "newproduct"} onClick={() => setRoute("newproduct")} />

      <div className="mac-nav-group">Business</div>
      <NavItem icon={<Receipt {...ICON} />} label="Invoices" active={route === "sampling"} onClick={() => setRoute("sampling")} />
      <NavItem icon={<FileText {...ICON} />} label="Contracts" active={route === "contracts"} onClick={() => setRoute("contracts")} />
      <NavItem icon={<Paperclip {...ICON} />} label="Files" active={route === "files"} onClick={() => setRoute("files")} />
      <NavItem icon={<Sparkles {...ICON} />} label="References" active={route === "references"} onClick={() => setRoute("references")} />

      <div className="mt-auto pt-4">
        <div className="rail-label px-2 pb-2">
          <p className="text-[10px] uppercase tracking-[.04em]" style={{ color: "var(--label-3)" }}>Your production partner</p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--label-2)" }}>{agencySettings.site_title || "Source Archive"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Right rail ───────────────────────────────────────────────

export function RightRailOverview({
  attention, upcoming, updates, onOpenProduct,
}: {
  attention: AttentionItem[];
  upcoming: UpcomingItem[];
  updates: { id: string; author: string; text: string; created_at: string; productName: string }[];
  onOpenProduct: (productId: string) => void;
}) {
  return (
    <>
      <RailSection title="Needs your attention">
        {attention.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--label-3)" }}>Nothing waiting on you.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {attention.map((item) => (
              <button
                key={item.id}
                onClick={() => item.productId && onOpenProduct(item.productId)}
                className="mac-card mac-card-hover w-full p-2.5 text-left"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle size={13} strokeWidth={1.6} className="mt-0.5 shrink-0" style={{ color: "var(--amber)" }} />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium tight" style={{ color: "var(--label)" }}>{item.title}</p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--label-2)" }}>{item.detail}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </RailSection>

      <RailSection title="Upcoming">
        {upcoming.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--label-3)" }}>No scheduled dates.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((u) => (
              <div key={u.id} className="flex items-start gap-2">
                <Clock size={13} strokeWidth={1.6} className="mt-0.5 shrink-0" style={{ color: "var(--label-3)" }} />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px]" style={{ color: "var(--label)" }}>{u.title}</p>
                  <p className="tnum text-[11.5px]" style={{ color: "var(--label-2)" }}>
                    {new Date(u.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {u.productName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </RailSection>

      <RailSection title="Activity">
        {updates.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--label-3)" }}>No activity yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {updates.slice(0, 8).map((u) => (
              <div key={u.id} className="min-w-0">
                <p className="text-[12px] leading-snug" style={{ color: "var(--label)" }}>{u.text}</p>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--label-3)" }}>{u.author} · {u.productName}</p>
              </div>
            ))}
          </div>
        )}
      </RailSection>
    </>
  );
}


// ── Mobile ───────────────────────────────────────────────────
//
// Below 719px the CSS hides the left rail and reserves a row for this.
// Nothing was ever passed into that slot, so the portal had no
// navigation at all on a phone: no Invoices, no Files, no way out of a
// product. This is that missing piece.
//
// Four destinations plus More. A tab bar that scrolls hides whatever is
// off the edge, and nine tabs at phone width are unreadable — so the
// four a client actually opens get a tab, and the rest live one tap
// deeper where they can be read properly.

const PRIMARY: { route: PortalRoute; label: string; short: string; icon: typeof LayoutGrid }[] = [
  { route: "overview",  label: "Overview",    short: "Home",     icon: LayoutGrid },
  { route: "approvals", label: "Approvals",   short: "Approve",  icon: CheckCircle2 },
  { route: "projects",  label: "Collections", short: "Products", icon: FolderOpen },
  { route: "sampling",  label: "Invoices",    short: "Invoices", icon: Receipt },
];

const SECONDARY: { route: PortalRoute; label: string; icon: typeof LayoutGrid }[] = [
  { route: "moodboard",  label: "Moodboard",       icon: Images },
  { route: "newproduct", label: "Brief a product", icon: PackagePlus },
  { route: "files",      label: "Files",           icon: Paperclip },
  { route: "contracts",  label: "Contracts",       icon: FileText },
  { route: "references", label: "References",      icon: Sparkles },
];

export function MobileTabBar({
  route, setRoute, attentionCount,
}: {
  route: PortalRoute;
  setRoute: (r: PortalRoute) => void;
  attentionCount: number;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = SECONDARY.some((s) => s.route === route);

  function go(r: PortalRoute) {
    setRoute(r);
    setMoreOpen(false);
  }

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,.4)" }}
          onClick={() => setMoreOpen(false)}
          role="presentation"
        >
          <div
            className="w-full rounded-t-2xl pb-6 pt-2"
            style={{ background: "var(--content)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-2">
              <p className="flex-1 text-[15px] font-semibold" style={{ color: "var(--label)" }}>
                More
              </p>
              <button onClick={() => setMoreOpen(false)} aria-label="Close">
                <X size={18} style={{ color: "var(--label-3)" }} />
              </button>
            </div>
            {SECONDARY.map((item) => {
              const Icon = item.icon;
              const active = route === item.route;
              return (
                <button
                  key={item.route}
                  onClick={() => go(item.route)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  style={{ color: active ? "var(--accent)" : "var(--label)" }}
                >
                  <Icon size={19} strokeWidth={1.6} />
                  <span className="text-[15px]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {PRIMARY.map((item) => {
        const Icon = item.icon;
        const active = route === item.route;
        return (
          <button
            key={item.route}
            onClick={() => go(item.route)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1"
            style={{ color: active ? "var(--accent)" : "var(--label-3)" }}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={active ? 2 : 1.6} />
            <span className="text-[10px] leading-none">{item.short}</span>
            {item.route === "approvals" && attentionCount > 0 && (
              <span
                className="absolute right-[22%] top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white"
                style={{ background: "var(--danger, #FF3B30)" }}
              >
                {attentionCount}
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={() => setMoreOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1"
        style={{ color: inMore ? "var(--accent)" : "var(--label-3)" }}
        aria-label="More sections"
      >
        <MoreHorizontal size={19} strokeWidth={inMore ? 2 : 1.6} />
        <span className="text-[10px] leading-none">More</span>
      </button>
    </>
  );
}


/**
 * The menu in the top bar, for narrow screens.
 *
 * A second, independent way to every section. The bottom tab bar is the
 * nicer pattern, but it depends on a media query firing and a grid row
 * existing — and when that quietly failed, the portal had no navigation
 * at all and no clue that any was missing. A button where the logo sits
 * is somewhere people already look, and it cannot be hidden by a
 * stylesheet mistake.
 */
export function TopbarMenu({
  route, setRoute, attentionCount,
}: {
  route: PortalRoute;
  setRoute: (r: PortalRoute) => void;
  attentionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const all = [...PRIMARY, ...SECONDARY];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6.5px] md:hidden"
        style={{ color: "var(--label)" }}
      >
        <Menu size={18} strokeWidth={1.8} />
        {attentionCount > 0 && (
          <span
            className="absolute ml-4 mt-[-12px] h-[7px] w-[7px] rounded-full"
            style={{ background: "var(--danger, #FF3B30)" }}
          />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60]"
          style={{ background: "rgba(0,0,0,.4)" }}
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="absolute inset-y-0 left-0 w-[78%] max-w-[300px] overflow-y-auto pb-8"
            style={{ background: "var(--content)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-3.5">
              <p className="flex-1 text-[15px] font-semibold" style={{ color: "var(--label)" }}>
                Menu
              </p>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} style={{ color: "var(--label-3)" }} />
              </button>
            </div>

            {all.map((item) => {
              const Icon = item.icon;
              const active = route === item.route;
              return (
                <button
                  key={item.route}
                  onClick={() => { setRoute(item.route); setOpen(false); }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  style={{ color: active ? "var(--accent)" : "var(--label)" }}
                >
                  <Icon size={19} strokeWidth={active ? 2 : 1.6} />
                  <span className="flex-1 text-[15px]">{item.label}</span>
                  {item.route === "approvals" && attentionCount > 0 && (
                    <span
                      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white"
                      style={{ background: "var(--danger, #FF3B30)" }}
                    >
                      {attentionCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
