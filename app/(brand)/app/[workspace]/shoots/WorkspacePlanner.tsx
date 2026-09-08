"use client";

import { useState } from "react";
import { Camera, Megaphone, Plus } from "lucide-react";
import { SHOOT_TYPES, type ShootType } from "@/lib/shoots";
import { createWorkspaceShoot, createWorkspaceCampaign, type WsShoot } from "./actions";

const CARD = "rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]";
const INPUT =
  "w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1.5 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]";

interface Campaign { id: string; name: string; kind: string; launch_date: string | null }

export function WorkspacePlanner({
  slug, shoots: initialShoots, campaigns: initialCampaigns,
}: {
  slug: string;
  shoots: WsShoot[];
  campaigns: Campaign[];
}) {
  const [shoots, setShoots] = useState(initialShoots);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [error, setError] = useState<string | null>(null);
  const [shootForm, setShootForm] = useState({ title: "", type: "ecom" as ShootType });
  const [campForm, setCampForm] = useState({
    name: "", kind: "collection" as "collection" | "always_on", launchDate: "",
  });

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[18px] font-semibold text-[var(--sa-text-primary)]">Shoots &amp; Marketing</h1>
        <p className="mt-1 text-[13px] text-[var(--sa-text-secondary)]">
          Brief a photographer, plan a drop.
        </p>

        {error && <p className="mt-3 text-[12.5px] text-red-500">{error}</p>}

        {/* Shoots */}
        <div className={`${CARD} mt-5 p-4`}>
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-[var(--sa-text-tertiary)]" />
            <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Shoots</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className={`${INPUT} min-w-[180px] flex-1`}
              placeholder="Name the shoot"
              value={shootForm.title}
              onChange={(e) => setShootForm({ ...shootForm, title: e.target.value })}
            />
            <select
              className={`${INPUT} w-auto`}
              value={shootForm.type}
              onChange={(e) => setShootForm({ ...shootForm, type: e.target.value as ShootType })}
            >
              {SHOOT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button
              onClick={async () => {
                setError(null);
                const res = await createWorkspaceShoot({
                  slug, title: shootForm.title, shootType: shootForm.type,
                });
                if (!res.success) { setError(res.error); return; }
                setShoots((s) => [
                  { id: res.id, workspace_id: null, title: shootForm.title || "Untitled shoot",
                    shoot_type: shootForm.type, status: "planning", shoot_date: null, location: null },
                  ...s,
                ]);
                setShootForm({ title: "", type: "ecom" });
              }}
              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
            {SHOOT_TYPES.find((t) => t.id === shootForm.type)?.hint} — the standard shot list comes with it.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {shoots.length === 0 && (
              <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">No shoots yet.</p>
            )}
            {shoots.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--sa-text-primary)]">
                  {s.title}
                </span>
                <span className="shrink-0 text-[11.5px] text-[var(--sa-text-tertiary)]">
                  {SHOOT_TYPES.find((t) => t.id === s.shoot_type)?.label ?? s.shoot_type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Campaigns */}
        <div className={`${CARD} mt-4 p-4`}>
          <div className="flex items-center gap-2">
            <Megaphone size={15} className="text-[var(--sa-text-tertiary)]" />
            <p className="text-[13px] font-semibold text-[var(--sa-text-primary)]">Marketing</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className={`${INPUT} min-w-[160px] flex-1`}
              placeholder="Campaign name"
              value={campForm.name}
              onChange={(e) => setCampForm({ ...campForm, name: e.target.value })}
            />
            <select
              className={`${INPUT} w-auto`}
              value={campForm.kind}
              onChange={(e) => setCampForm({ ...campForm, kind: e.target.value as "collection" | "always_on" })}
            >
              <option value="collection">A drop</option>
              <option value="always_on">Always on</option>
            </select>
            {campForm.kind === "collection" && (
              <input
                type="date"
                className={`${INPUT} w-auto`}
                value={campForm.launchDate}
                onChange={(e) => setCampForm({ ...campForm, launchDate: e.target.value })}
              />
            )}
            <button
              onClick={async () => {
                setError(null);
                const res = await createWorkspaceCampaign({
                  slug, name: campForm.name, kind: campForm.kind,
                  launchDate: campForm.launchDate || null,
                });
                if (!res.success) { setError(res.error); return; }
                setCampaigns((c) => [
                  { id: res.id, name: campForm.name || "Untitled campaign",
                    kind: campForm.kind, launch_date: campForm.launchDate || null },
                  ...c,
                ]);
                setCampForm({ name: "", kind: "collection", launchDate: "" });
              }}
              className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
            >
              <Plus size={13} /> Add
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">
            {campForm.kind === "collection"
              ? "Comes with the full run already dated from your launch — teaser through remarketing."
              : "Comes with a weekly rhythm you can edit."}
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {campaigns.length === 0 && (
              <p className="text-[12.5px] text-[var(--sa-text-tertiary)]">Nothing planned yet.</p>
            )}
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--sa-text-primary)]">{c.name}</span>
                <span className="shrink-0 text-[11.5px] text-[var(--sa-text-tertiary)]">
                  {c.kind === "always_on" ? "Always on" : c.launch_date ?? "No date"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
