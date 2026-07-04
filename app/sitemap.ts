import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/lib/url";

// Only public-facing routes belong in the sitemap. The agency backend
// (/dashboard, /clients, etc.) is behind auth and shouldn't be indexed.
// Client portals and per-factory token URLs are also excluded because they
// contain client-specific identifiers.
const PUBLIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/",         priority: 1.0, changeFrequency: "monthly" },
  { path: "/brief",    priority: 0.8, changeFrequency: "monthly" },
  { path: "/enquire",  priority: 0.8, changeFrequency: "monthly" },
  { path: "/techpack", priority: 0.7, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicOrigin() || "https://app.sourcearchive.studio";
  const now = new Date();
  return PUBLIC_ROUTES.map((r) => ({
    url: `${origin}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
