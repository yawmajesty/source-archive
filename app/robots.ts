import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/lib/url";

// Public routes get indexed; authenticated + per-client-token routes are
// disallowed so we don't leak URL patterns to bots or accidentally index
// portal / factory / techpack review pages.
export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin() || "https://app.sourcearchive.studio";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/brief", "/enquire", "/techpack"],
        disallow: [
          "/dashboard",
          "/clients",
          "/projects",
          "/products",
          "/factories",
          "/costs",
          "/leads",
          "/references",
          "/settings",
          "/studio",
          "/tasks",
          "/techpacks",
          "/sign-in",
          "/sign-up",
          "/portal/",
          "/factory/",
          "/api/",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
