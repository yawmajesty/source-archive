"use client";

import { useState, useTransition } from "react";
import { Shield, User, Copy, Check } from "lucide-react";
import { updateUserRole, saveAgencySettings } from "./actions";
import type { ClerkUserProfile } from "./page";
import type { AgencySettings } from "@/lib/data";

interface Props {
  currentUser: { id: string; email: string; role: string };
  team: ClerkUserProfile[];
  isAdmin: boolean;
  agencySettings: AgencySettings;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  team: "Member",
  client: "Client",
};

function RoleSelect({ profile, currentUserId }: { profile: ClerkUserProfile; currentUserId: string }) {
  const [isPending, startTransition] = useTransition();
  const isSelf = profile.id === currentUserId;

  return (
    <select
      value={profile.role}
      disabled={isSelf || isPending}
      onChange={(e) => {
        const role = e.target.value as "admin" | "team" | "client";
        startTransition(() => updateUserRole(profile.id, role));
      }}
      className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-2.5 py-1 text-[12px] text-[var(--sa-text-primary)] disabled:opacity-50 cursor-pointer"
    >
      <option value="team">Member</option>
      <option value="admin">Admin</option>
      <option value="client">Client</option>
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

const INPUT_CLS = "w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[12px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--sa-accent)]";
const LABEL_CLS = "text-[11px] font-medium text-[var(--sa-text-secondary)] mb-1 block";

function Field({ label, value, onChange, placeholder, span2 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : undefined}>
      <label className={LABEL_CLS}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLS}
      />
    </div>
  );
}

function InvoiceSettings({ initial }: { initial: AgencySettings }) {
  const [s, setS] = useState<AgencySettings>(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function set(key: keyof AgencySettings) {
    return (v: string) => setS((prev) => ({ ...prev, [key]: v }));
  }

  function handleSave() {
    startTransition(async () => {
      await saveAgencySettings(s);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-3">Invoice settings</h2>
      <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] divide-y divide-[var(--sa-border)]">

        <div className="px-4 py-4 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-2">Bank details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Account name"       value={s.account_name}       onChange={set("account_name")}       placeholder="YAW LIMITED" />
            <Field label="Bank name"          value={s.bank_name}          onChange={set("bank_name")}          placeholder="AIRWALLEX (UK) LIMITED" />
            <Field label="Account number"     value={s.account_number}     onChange={set("account_number")}     placeholder="01090237" />
            <Field label="Sort code"          value={s.sort_code}          onChange={set("sort_code")}          placeholder="04-19-07" />
            <Field label="IBAN"               value={s.iban}               onChange={set("iban")}               placeholder="GB35AIRW04190701090237" />
            <Field label="SWIFT / BIC code"   value={s.swift_code}         onChange={set("swift_code")}         placeholder="AIRWGB22XXX" />
            <Field label="Account location"   value={s.account_location}   onChange={set("account_location")}   placeholder="United Kingdom" />
            <Field label="Account created on" value={s.account_created_on} onChange={set("account_created_on")} placeholder="14 May 2025" />
            <Field label="Bank address" value={s.bank_address} onChange={set("bank_address")} placeholder="Labs House 15-19 Bloomsbury Way, London, WC1A 2TH" span2 />
          </div>
        </div>

        <div className="px-4 py-4 flex flex-col gap-1.5">
          <label className={LABEL_CLS}>Payment terms</label>
          <textarea
            value={s.invoice_terms}
            onChange={(e) => setS((prev) => ({ ...prev, invoice_terms: e.target.value }))}
            rows={3}
            placeholder="Payment due within 14 days of invoice date. All sampling fees are non-refundable."
            className={`${INPUT_CLS} resize-none`}
          />
        </div>

        <div className="px-4 py-3 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-4 py-1.5 text-[12px] font-medium text-white disabled:opacity-50 transition-opacity"
          >
            {saved ? <><Check size={12} /> Saved</> : isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--sa-text-tertiary)]">These appear on every sampling invoice downloaded from the client portal.</p>
    </section>
  );
}

export function SettingsClient({ currentUser, team, isAdmin, agencySettings }: Props) {
  const signupUrl = typeof window !== "undefined"
    ? `${window.location.origin}/sign-up`
    : "/sign-up";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-5 border-b border-[var(--sa-border)]">
        <h1 className="text-[18px] font-semibold text-[var(--sa-text-primary)]">Settings</h1>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6 max-w-2xl">

        {/* Account */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-3">Your account</h2>
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sa-accent)] text-white text-[13px] font-semibold select-none">
                {currentUser.email[0].toUpperCase()}
              </div>
              <span className="flex-1 text-[13px] text-[var(--sa-text-primary)]">{currentUser.email}</span>
              <span className="flex items-center gap-1 rounded-full bg-[var(--sa-selected)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--sa-accent)]">
                {ROLE_LABELS[currentUser.role] ?? currentUser.role}
              </span>
            </div>
          </div>
        </section>

        {isAdmin && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--sa-text-tertiary)]">Team members</h2>
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
                            {(member.fullName ?? member.email)[0].toUpperCase()}
                          </div>
                          <div>
                            {member.fullName && <div className="font-medium text-[var(--sa-text-primary)]">{member.fullName}</div>}
                            <div className="text-[11px] text-[var(--sa-text-tertiary)]">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleSelect profile={member} currentUserId={currentUser.id} />
                      </td>
                      <td className="px-4 py-3 text-[var(--sa-text-tertiary)]">
                        {new Date(member.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
              Share the invite link so new members can create their account. Assign their role here once they've signed up.
            </p>
          </section>
        )}

        {isAdmin && <InvoiceSettings initial={agencySettings} />}

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
