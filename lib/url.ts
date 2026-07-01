// Canonical public origin for URLs that get copied and shared with clients,
// factories, or leads. We can't rely on window.location.origin because the
// agency may be browsing the app on a preview domain (eg *.vercel.app) — a
// link they copy from that host is worthless once they email it out.
//
// Configure NEXT_PUBLIC_APP_URL in Vercel to your custom domain, eg
//   NEXT_PUBLIC_APP_URL=https://app.sourcearchive.studio
export function getPublicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function buildPublicUrl(path: string): string {
  const origin = getPublicOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
