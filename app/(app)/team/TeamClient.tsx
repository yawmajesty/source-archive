"use client";

import { useState } from "react";
import { UserPlus, Trash2, AlertCircle } from "lucide-react";
import type { AgencyRole } from "@/lib/agency-data";
import { CAPABILITIES, ROLE_LABEL, ROLE_HINT, type Capability } from "@/lib/permissions";
import type { TeamMember } from "../settings/team-actions";
import { addMember, setMemberRole, setMemberPermissions, removeMember } from "../settings/team-actions";

const ROLES: AgencyRole[] = ["admin", "team", "maker"];

export function TeamClient({ agencyName, currentUserId, isAdmin, members, unattached }: {
  agencyName: string;
  currentUserId: string;
  isAdmin: boolean;
  members: TeamMember[];
  unattached: TeamMember[];
}) {
  const [rows, setRows] = useState(members);
  const [pending, setPending] = useState(unattached);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function adopt(m: TeamMember, role: AgencyRole) {
    setBusy(m.user_id); setError(null);
    const res = await addMember(m.user_id, role);
    if (!res.success) { setError(res.error ?? "Could not add"); setBusy(null); return; }
    setPending((p) => p.filter((x) => x.user_id !== m.user_id));
    setRows((r) => [...r, { ...m, role, permissions: [], other_agency: null }]);
    setBusy(null);
  }

  async function changeRole(m: TeamMember, role: AgencyRole) {
    setBusy(m.user_id); setError(null);
    const res = await setMemberRole(m.user_id, role);
    if (!res.success) setError(res.error ?? "Could not change role");
    else setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...x, role } : x)));
    setBusy(null);
  }

  async function toggleCap(m: TeamMember, cap: Capability) {
    const next = m.permissions.includes(cap)
      ? m.permissions.filter((c) => c !== cap)
      : [...m.permissions, cap];
    setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...x, permissions: next } : x)));
    const res = await setMemberPermissions(m.user_id, next as Capability[]);
    if (!res.success) setError(res.error ?? "Could not save permissions");
  }

  async function remove(m: TeamMember) {
    if (!window.confirm(`Remove ${m.email ?? m.user_id} from ${agencyName}?`)) return;
    setBusy(m.user_id);
    const res = await removeMember(m.user_id);
    if (!res.success) setError(res.error ?? "Could not remove");
    else setRows((r) => r.filter((x) => x.user_id !== m.user_id));
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-[17px] font-semibold text-[var(--sa-text-primary)]">Team &amp; permissions</h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--sa-text-tertiary)]">
          Who can do what inside {agencyName}. Admins have everything; everyone else has exactly what you grant.
        </p>
      </div>

      {error && <p className="text-[12.5px] text-red-500">{error}</p>}

      {isAdmin && pending.length > 0 && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 p-4 dark:bg-amber-500/5">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-600" />
            <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
              {pending.length} {pending.length === 1 ? "person" : "people"} signed up but landed outside {agencyName}
            </p>
          </div>
          <p className="mb-3 text-[12px] text-[var(--sa-text-secondary)]">
            Signing up creates a new empty workspace, so they can log in but see none of your work.
            Add them here and they&apos;ll have access immediately.
          </p>
          <div className="flex flex-col gap-2">
            {pending.map((m) => (
              <div key={m.user_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[var(--sa-text-primary)]">{m.name ?? m.email ?? m.user_id}</p>
                  <p className="truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
                    {m.email}{m.other_agency ? ` · currently in “${m.other_agency}”` : ""}
                  </p>
                </div>
                {ROLES.map((r) => (
                  <button
                    key={r}
                    disabled={busy === m.user_id}
                    onClick={() => adopt(m, r)}
                    className="flex items-center gap-1 rounded-md border border-[var(--sa-border)] px-2.5 py-1 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] disabled:opacity-40"
                  >
                    <UserPlus size={12} /> Add as {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((m) => {
          const isSelf = m.user_id === currentUserId;
          return (
            <div key={m.user_id} className="rounded-xl border border-[var(--sa-border)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--sa-text-primary)]">
                    {m.name ?? m.email ?? m.user_id}{isSelf && <span className="ml-1.5 text-[11.5px] text-[var(--sa-text-tertiary)]">you</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-[var(--sa-text-tertiary)]">{m.email ?? m.user_id}</p>
                </div>

                <select
                  disabled={!isAdmin || isSelf || busy === m.user_id}
                  value={m.role}
                  onChange={(e) => changeRole(m, e.target.value as AgencyRole)}
                  className="rounded-md border border-[var(--sa-border)] bg-[var(--sa-window)] px-2 py-1 text-[12.5px] text-[var(--sa-text-primary)] disabled:opacity-60"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>

                {isAdmin && !isSelf && (
                  <button onClick={() => remove(m)} className="text-[var(--sa-text-tertiary)] hover:text-red-500" title="Remove from agency">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <p className="mt-1 text-[11.5px] text-[var(--sa-text-tertiary)]">{ROLE_HINT[m.role]}</p>

              {m.role === "admin" ? (
                <p className="mt-3 text-[12px] text-[var(--sa-text-tertiary)]">
                  Admins have every permission by default.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CAPABILITIES.map((c) => {
                    const on = m.permissions.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--sa-border)] p-2.5"
                        style={{ background: on ? "var(--sa-hover)" : "transparent" }}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          disabled={!isAdmin}
                          onChange={() => toggleCap(m, c.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-[var(--sa-text-primary)]">{c.label}</span>
                          <span className="block text-[11.5px] text-[var(--sa-text-tertiary)]">{c.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
