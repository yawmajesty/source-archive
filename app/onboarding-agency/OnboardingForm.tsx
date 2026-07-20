"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createAgencyAction } from "./actions";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-generate a URL-safe slug from the name until the user edits it.
  const suggestedSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const effectiveSlug = slugTouched ? slug : suggestedSlug;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Agency name is required"); return; }
    if (!effectiveSlug) { setError("Slug is required"); return; }

    startTransition(async () => {
      const res = await createAgencyAction({ name: name.trim(), slug: effectiveSlug });
      if (!res.success) { setError(res.error); return; }
      router.push("/dashboard");
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6 space-y-4"
    >
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-semibold text-[var(--sa-text-tertiary)] mb-1.5">
          Agency name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Northlight Studio"
          autoFocus
          required
          className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest font-semibold text-[var(--sa-text-tertiary)] mb-1.5">
          Slug
        </label>
        <input
          type="text"
          value={effectiveSlug}
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
          placeholder="northlight-studio"
          required
          className="w-full rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] font-mono text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)]"
        />
        <p className="mt-1 text-[10px] text-[var(--sa-text-tertiary)]">
          Used internally. Auto-uniqued if taken.
        </p>
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-4 py-2.5 text-[13px] font-medium text-[var(--sa-window)] hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creating…" : <>Create agency <ArrowRight size={13} /></>}
      </button>
    </form>
  );
}
