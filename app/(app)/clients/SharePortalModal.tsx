"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Trash2, Link2, X } from "lucide-react";
import {
  listClientMembers, addClientMember, removeClientMember, type ClientMember,
} from "./member-actions";

/**
 * Share a client's portal and manage who may open it.
 *
 * Both halves live together on purpose: the link and the people who can use
 * it are the same decision. With nobody added the link works for anyone who
 * has it; add the first person and it becomes sign-in only.
 */
export function SharePortalModal({ clientId, clientName, onClose }: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ClientMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "member">("member");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = typeof window !== "undefined" ? `${window.location.origin}/portal/${clientId}` : "";

  useEffect(() => {
    listClientMembers(clientId)
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  }

  async function add() {
    if (!email.trim() || busy) return;
    setBusy(true); setError(null);
    const res = await addClientMember(clientId, email, role);
    if (!res.success) { setError(res.error); setBusy(false); return; }
    setMembers((prev) => [...prev.filter((m) => m.id !== res.member.id), res.member]);
    setEmail("");
    setBusy(false);
  }

  async function remove(m: ClientMember) {
    const res = await removeClientMember(m.id, clientId);
    if (!res.success) { setError(res.error ?? "Could not remove"); return; }
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
  }

  const inp = "rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-2.5 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Share {clientName}&apos;s portal</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--sa-text-secondary)]">
              {loading
                ? "Checking who has access…"
                : members.length === 0
                  ? "Anyone with this link can open it. Add someone below to require a sign-in."
                  : `${members.length} ${members.length === 1 ? "person" : "people"} can sign in — the link alone no longer works.`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-primary)]">
            <X size={16} />
          </button>
        </div>

        {/* The link */}
        <div className="mb-5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">Portal link</p>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-2">
              <Link2 size={13} className="shrink-0 text-[var(--sa-text-tertiary)]" />
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--sa-text-primary)] outline-none" />
            </div>
            <button
              onClick={copy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-2 text-[12.5px] font-medium text-white"
            >
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
        </div>

        {/* The people */}
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">Who can open it</p>

          {!loading && members.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-[var(--sa-text-primary)]">{m.email}</p>
                    <p className="text-[11px] text-[var(--sa-text-tertiary)]">
                      {m.role === "owner" ? "Owner" : "Member"}
                      {m.claimed_at ? " · signed in" : " · hasn't signed in yet"}
                    </p>
                  </div>
                  <button onClick={() => remove(m)} className="text-[var(--sa-text-tertiary)] hover:text-red-500" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inp} min-w-0 flex-1`}
              placeholder="their@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            />
            <select className={inp} value={role} onChange={(e) => setRole(e.target.value as "owner" | "member")}>
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button
              onClick={add}
              disabled={busy || !email.trim()}
              className="rounded-lg bg-[var(--sa-accent)] px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-40"
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>

          <p className="mt-2 text-[11.5px] text-[var(--sa-text-tertiary)]">
            They sign in at <strong>/sign-in</strong> with this address. There is no automatic invite email yet — send them the link yourself.
          </p>
        </div>

        {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}
