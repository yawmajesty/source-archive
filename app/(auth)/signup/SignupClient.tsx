"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export function SignupClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3.5 py-2.5 text-[14px] text-[var(--sa-text-primary)] placeholder:text-[var(--sa-text-tertiary)] outline-none focus:border-[var(--sa-accent)] transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--sa-bg)" }}>
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--sa-accent)] text-white text-[18px] font-bold select-none shadow-sm">
            S
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--sa-text-primary)] tracking-tight">
            Source<span className="font-light opacity-60">[Archive]</span>
          </h1>
          <p className="text-[13px] text-[var(--sa-text-tertiary)]">Create your account</p>
        </div>

        <div className="rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 shadow-sm">
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
                placeholder="Jane Smith"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@agency.com"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sa-text-tertiary)]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                minLength={6}
                className={inputCls}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-[var(--sa-danger)] dark:bg-red-500/10">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-[var(--sa-accent)] py-2.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-[var(--sa-text-tertiary)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--sa-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
