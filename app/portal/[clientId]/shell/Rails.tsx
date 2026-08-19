"use client";

import {
  LayoutGrid, CheckCircle2, FolderOpen, FileText, Receipt,
  Paperclip, Sparkles, Clock, AlertCircle,
} from "lucide-react";
import { RailSection } from "./PortalShell";
import type { PortalProject, PortalProduct } from "../page";
import type { SavedInvoice, AgencySettings } from "@/lib/data";

export type PortalRoute =
  | "overview" | "approvals" | "sampling" | "projects"
  | "files" | "contracts" | "references";

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
}: {
  route: PortalRoute;
  setRoute: (r: PortalRoute) => void;
  projects: PortalProject[];
  attentionCount: number;
  agencySettings: AgencySettings;
  onSelectProject: (id: string) => void;
  selectedProjectId: string | null;
}) {
  const ICON = { size: 15, strokeWidth: 1.6 } as const;

  return (
    <div className="flex h-full flex-col">
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
