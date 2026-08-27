"use client";

import { useState } from "react";
import { UserPlus, Trash2, AlertCircle, Mail, X } from "lucide-react";
import type { AgencyRole } from "@/lib/agency-data";
import { CAPABILITIES, ROLE_LABEL, ROLE_HINT, type Capability } from "@/lib/permissions";
import type { TeamMember } from "../settings/team-actions";
import { addMember, setMemberRole, setMemberPermissions, removeMember, setMemberClientScope, setMemberProjectScope } from "../settings/team-actions";
import { inviteToAgency, revokeInvite, deleteEmptyAgency, type AgencyInvite } from "../settings/invite-actions";

const ROLES: AgencyRole[] = ["admin", "team", "maker"];

export function TeamClient({ agencyName, currentUserId, isAdmin, members, unattached, clients, projects, invites, emptyAgencies }: {
  agencyName: string;
  currentUserId: string;
  isAdmin: boolean;
  members: TeamMember[];
  unattached: TeamMember[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; client_id: string }[];
  invites: AgencyInvite[];
  emptyAgencies: { id: string; name: string; members: number }[];
}) {
  const [rows, setRows] = useState(members);
  const [pending, setPending] = useState(unattached);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState(invites);
  const [strays, setStrays] = useState(emptyAgencies);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AgencyRole>("team");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite() {
    if (!inviteEmail.trim() || busy) return;
    setBusy("invite"); setError(null); setNotice(null);
    const res = await inviteToAgency({ email: inviteEmail, role: inviteRole });
    if (!res.success) { setError(res.error); setBusy(null); return; }
    setPendingInvites((prev) => [res.invite, ...prev.filter((i) => i.id !== res.invite.id)]);
    setNotice(
      res.emailed
        ? `Invited ${res.invite.email}. They'll join ${agencyName} automatically when they sign in.`
        : `Invite recorded, but the email didn't send${res.emailError ? `: ${res.emailError}` : ""}.`,
    );
    setInviteEmail("");
    setBusy(null);
  }

  async function cancelInvite(i: AgencyInvite) {
    const res = await revokeInvite(i.id);
    if (!res.success) { setError(res.error ?? "Could not revoke"); return; }
    setPendingInvites((prev) => prev.filter((x) => x.id !== i.id));
  }

  async function removeStray(a: { id: string; name: string }) {
    if (!window.confirm(`Delete the empty agency "${a.name}"? Anyone in it will be asked to be invited again.`)) return;
    setBusy(a.id);
    const res = await deleteEmptyAgency(a.id);
    if (!res.success) setError(res.error ?? "Could not delete");
    else setStrays((prev) => prev.filter((x) => x.id !== a.id));
    setBusy(null);
  }

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

  async function toggleClient(m: TeamMember, clientId: string) {
    const next = m.client_scope.includes(clientId)
      ? m.client_scope.filter((c) => c !== clientId)
      : [...m.client_scope, clientId];
    setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...x, client_scope: next } : x)));
    const res = await setMemberClientScope(m.user_id, next);
    if (!res.success) setError(res.error ?? "Could not save client access");
  }

  async function clearScope(m: TeamMember) {
    setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...x, client_scope: [] } : x)));
    const res = await setMemberClientScope(m.user_id, []);
    if (!res.success) setError(res.error ?? "Could not save client access");
  }

  async function toggleProject(m: TeamMember, projectId: string) {
    const next = m.project_scope.includes(projectId)
      ? m.project_scope.filter((p) => p !== projectId)
      : [...m.project_scope, projectId];
    setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...x, project_scope: next } : x)));
    const res = await setMemberProjectScope(m.user_id, next);
    if (!res.success) setError(res.error ?? "Could not save project access");
  }

  async function clearProjectScope(m: TeamMember) {
    setRows((r) => r.map((x) => (x.user_id === m.user_id ? { ...x, project_scope: [] } : x)));
    const res = await setMemberProjectScope(m.user_id, []);
    if (!res.success) setError(res.error ?? "Could not save project access");
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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 md:px-6 md:pt-6">
        <h1 className="text-[17px] font-semibold text-[var(--sa-text-primary)]">Team &amp; permissions</h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--sa-text-tertiary)]">
          Who can do what inside {agencyName}. Admins have everything; everyone else has exactly what you grant.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-10 pt-4 md:px-6">
      {error && <p className="text-[12.5px] text-red-500">{error}</p>}

      {isAdmin && (
        <div className="rounded-xl border border-[var(--sa-border)] p-4">
          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Invite someone</p>
          <p className="mt-0.5 text-[12px] text-[var(--sa-text-secondary)]">
            They get an email, and joining puts them straight into {agencyName} with the role you pick —
            no separate workspace, nothing to adopt afterwards.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none"
              placeholder="their@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendInvite(); }}
            />
            <select
              className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-2 text-[13px] text-[var(--sa-text-primary)]"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AgencyRole)}
            >
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button
              onClick={sendInvite}
              disabled={busy === "invite" || !inviteEmail.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-40"
            >
              <Mail size={13} /> {busy === "invite" ? "Sending…" : "Send invite"}
            </button>
          </div>

          {pendingInvites.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              {pendingInvites.map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-[var(--sa-text-primary)]">{i.email}</p>
                    <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                      Invited as {ROLE_LABEL[i.role] ?? i.role} · not accepted yet
                    </p>
                  </div>
                  <button onClick={() => cancelInvite(i)} className="text-[var(--sa-text-tertiary)] hover:text-red-500" title="Revoke">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {notice && <p className="mt-2 text-[12px]" style={{ color: "var(--sa-success)" }}>{notice}</p>}
        </div>
      )}

      {isAdmin && strays.length > 0 && (
        <div className="rounded-xl border border-[var(--sa-border)] p-4">
          <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
            {strays.length} empty workspace{strays.length === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 mb-3 text-[12px] text-[var(--sa-text-secondary)]">
            Left over from before invites existed — each was created automatically when someone signed up.
            None holds any products or clients. Removing them keeps work from landing somewhere you can&apos;t see.
          </p>
          <div className="flex flex-col gap-1.5">
            {strays.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-[var(--sa-text-primary)]">{a.name}</p>
                  <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                    empty · {a.members} member{a.members === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  onClick={() => removeStray(a)}
                  disabled={busy === a.id}
                  className="rounded-md border border-[var(--sa-border)] px-2.5 py-1 text-[11.5px] text-[var(--sa-text-secondary)] hover:border-red-400 hover:text-red-500 disabled:opacity-40"
                >
                  {busy === a.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

              {m.role !== "admin" && (
                <div className="mt-3 rounded-lg border border-[var(--sa-border)] p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-medium text-[var(--sa-text-primary)]">Client access</span>
                    <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
                      {m.client_scope.length === 0
                        ? "All clients"
                        : `${m.client_scope.length} of ${clients.length} clients`}
                    </span>
                    {m.client_scope.length > 0 && isAdmin && (
                      <button onClick={() => clearScope(m)} className="text-[11.5px] text-[var(--sa-accent)]">
                        Give access to all
                      </button>
                    )}
                  </div>
                  <p className="mb-2 text-[11.5px] text-[var(--sa-text-tertiary)]">
                    Pick specific brands to limit them to one project&apos;s work. Leave everything unticked and
                    they see every client.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {clients.map((c) => {
                      const on = m.client_scope.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          disabled={!isAdmin}
                          onClick={() => toggleClient(m, c.id)}
                          className="rounded-md px-2 py-1 text-[11.5px] transition-colors disabled:opacity-60"
                          style={{
                            background: on ? "var(--sa-accent)" : "var(--sa-hover)",
                            color: on ? "#fff" : "var(--sa-text-secondary)",
                          }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 border-t border-[var(--sa-border)] pt-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-medium text-[var(--sa-text-primary)]">
                        Or narrow to specific collections
                      </span>
                      {m.project_scope.length > 0 && isAdmin && (
                        <button onClick={() => clearProjectScope(m)} className="text-[11.5px] text-[var(--sa-accent)]">
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="mb-2 text-[11.5px] text-[var(--sa-text-tertiary)]">
                      {m.project_scope.length > 0
                        ? `On ${m.project_scope.length} collection${m.project_scope.length === 1 ? "" : "s"} — this overrides the client selection above.`
                        : "Leave empty to use the client selection above."}
                    </p>
                    <div className="flex flex-col gap-2">
                      {clients
                        .filter((c) => projects.some((p) => p.client_id === c.id))
                        .map((c) => (
                          <div key={c.id}>
                            <p className="mb-1 text-[11px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">{c.name}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {projects.filter((p) => p.client_id === c.id).map((p) => {
                                const on = m.project_scope.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    disabled={!isAdmin}
                                    onClick={() => toggleProject(m, p.id)}
                                    className="rounded-md px-2 py-1 text-[11.5px] transition-colors disabled:opacity-60"
                                    style={{
                                      background: on ? "var(--sa-accent)" : "var(--sa-hover)",
                                      color: on ? "#fff" : "var(--sa-text-secondary)",
                                    }}
                                  >
                                    {p.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
