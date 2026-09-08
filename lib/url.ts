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

  // Server-side with the variable unset. This used to return "" and every
  // absolute link built here came out as a bare path — fine in a page,
  // useless in an email, where "/portal/x" is not a link at all.
  //
  // Vercel injects the production domain and the per-deployment host, so
  // there is always something better than nothing to fall back on. An
  // explicit NEXT_PUBLIC_APP_URL still wins, because only that one is
  // guaranteed to be the domain you actually want in front of clients.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "";
}

export function buildPublicUrl(path: string): string {
  const origin = getPublicOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
