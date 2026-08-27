"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * There wasn't one, so any client-side error left the app on a dead screen
 * with no way forward. This shows what actually went wrong and offers a way
 * out — including a hard reload, because the most common cause is a browser
 * holding stale HTML that points at JavaScript files a newer deploy removed.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  const isChunkError =
    /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      `${error.name} ${error.message}`,
    );

  async function hardReload() {
    // Clear caches a stale bundle may be pinned in, then bypass the HTTP cache.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
    } catch {
      // Best effort — reload regardless.
    }
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--sa-bg)" }}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-6">
        <h1 className="text-[16px] font-semibold text-[var(--sa-text-primary)]">
          {isChunkError ? "This page needs a refresh" : "Something went wrong on this page"}
        </h1>

        <p className="mt-2 text-[13px] text-[var(--sa-text-secondary)]">
          {isChunkError
            ? "The app was updated while this tab was open, so your browser is holding an old copy. A refresh picks up the new version."
            : "The rest of the app is still working — you can go back and carry on."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={hardReload}
            className="rounded-lg bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white"
          >
            Refresh this page
          </button>
          <button
            onClick={() => reset()}
            className="rounded-lg border border-[var(--sa-border)] px-3.5 py-2 text-[13px] text-[var(--sa-text-secondary)]"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-[var(--sa-border)] px-3.5 py-2 text-[13px] text-[var(--sa-text-secondary)]"
          >
            Go to dashboard
          </a>
        </div>

        {/* The detail that makes a bug report useful instead of "it broke". */}
        <details className="mt-4">
          <summary className="cursor-pointer text-[12px] text-[var(--sa-text-tertiary)]">
            Technical details
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--sa-hover)] p-2.5 text-[11px] leading-relaxed text-[var(--sa-text-secondary)]">
{error.name}: {error.message}
{error.digest ? `\ndigest: ${error.digest}` : ""}
          </pre>
        </details>
      </div>
    </div>
  );
}
