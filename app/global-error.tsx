"use client";

/**
 * Last-resort boundary: catches errors in the root layout itself, where
 * app/error.tsx can't render. Must supply its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", background: "#F5F5F7" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, background: "#fff", border: "1px solid rgba(0,0,0,.08)", borderRadius: 16, padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1D1D1F" }}>The app failed to start</h1>
            <p style={{ marginTop: 8, fontSize: 13, color: "#6E6E73" }}>
              This is usually a browser holding an old copy after an update. Refreshing normally fixes it.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: "#0047AB", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
              >
                Refresh
              </button>
              <button
                onClick={() => reset()}
                style={{ background: "transparent", color: "#6E6E73", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
              >
                Try again
              </button>
            </div>
            <pre style={{ marginTop: 16, fontSize: 11, color: "#8E8E93", whiteSpace: "pre-wrap" }}>
              {error.name}: {error.message}{error.digest ? `\ndigest: ${error.digest}` : ""}
            </pre>
          </div>
        </div>
      </body>
    </html>
  );
}
