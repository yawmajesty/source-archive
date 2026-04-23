"use client";

import { useState, useTransition } from "react";
import { Shield, User, Copy, Check } from "lucide-react";
import { updateUserRole } from "./actions";
import type { Profile } from "./page";

interface Props {
  currentUser: { id: string; email: string; profile: Profile | null };
  team: Profile[];
  isAdmin: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  agency_admin: "Admin",
  agency_member: "Member",
};

function RoleSelect({ profile, currentUserId }: { profile: Profile; currentUserId: string }) {
  const [isPending, startTransition] = useTransition();
  const isSelf = profile.id === currentUserId;

  return (
    <select
      value={profile.role}
      disabled={isSelf || isPending}
      onChange={(e) => {
        const role = e.target.value as "agency_admin" | "agency_member";
        startTransition(() => updateUserRole(profile.id, role));
      }}
      className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1 text-[12px] text-[var(--sa-text-primary)] disabled:opacity-50 cursor-pointer"
    >
      <option value="agency_member">Member</option>
      <option value="agency_admin">Admin</option>
    </select>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)] transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "Copied!" : "Copy invite link"}
    </button>
  );
}

export function SettingsClient({ currentUser, team, isAdmin }: Props) {
  const signupUrl = typeof window !== "undefined"
    ? `${window.location.origin}/signup`
    : "/signup";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-5 border-b border-[var(--sa-border)]">
        <h1 className="text-[18px] font-semibold text-[var(--sa-text-primary)]">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6 max-w-2xl">

        {/* Account */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-3">
            Your account
          </h2>
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] divide-y divide-[var(--sa-border)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sa-accent)] text-white text-[13px] font-semibold select-none">
                {currentUser.email[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[var(--sa-text-primary)]">
                  {currentUser.profile?.full_name ?? currentUser.email}
                </span>
                <span className="text-[11px] text-[var(--sa-text-tertiary)]">{currentUser.email}</span>
              </div>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--sa-selected)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--sa-accent)]">
                {currentUser.profile?.role ? ROLE_LABEL[currentUser.profile.role] : "Member"}
              </span>
            </div>
          </div>
        </section>

        {/* Team management — admin only */}
        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">
                Team members
              </h2>
              <CopyLink url={signupUrl} />
            </div>

            <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--sa-border)]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">Name / Email</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">Role</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--sa-border)]">
                  {team.map((member) => (
                    <tr key={member.id} className="hover:bg-[var(--sa-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sa-accent)]/20 text-[var(--sa-accent)] text-[10px] font-semibold select-none">
                            {(member.full_name ?? member.email)[0].toUpperCase()}
                          </div>
                          <div>
                            {member.full_name && (
                              <div className="font-medium text-[var(--sa-text-primary)]">{member.full_name}</div>
                            )}
                            <div className="text-[11px] text-[var(--sa-text-tertiary)]">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleSelect profile={member} currentUserId={currentUser.id} />
                      </td>
                      <td className="px-4 py-3 text-[var(--sa-text-tertiary)]">
                        {new Date(member.created_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {team.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-[var(--sa-text-tertiary)]">
                  <User size={20} strokeWidth={1.5} />
                  <p className="text-[13px]">No team members yet</p>
                </div>
              )}
            </div>

            <p className="mt-2.5 text-[11px] text-[var(--sa-text-tertiary)]">
              Share the invite link above so new members can create their account. You can then assign them a role here.
            </p>
          </section>
        )}

        {!isAdmin && (
          <section>
            <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-4 flex items-start gap-3">
              <Shield size={16} strokeWidth={1.5} className="text-[var(--sa-text-tertiary)] mt-0.5 shrink-0" />
              <p className="text-[13px] text-[var(--sa-text-secondary)]">
                Team management is only available to admins. Contact your workspace admin to change your role or invite new members.
              </p>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
