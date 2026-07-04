import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { getAgencySettings } from "@/lib/data";
import { getPublicOrigin } from "@/lib/url";
import "./globals.css";

// Metadata is generated from agency_settings so the agency can control site
// identity + SEO without a code deploy — see the Brand & SEO tab in Settings.
export async function generateMetadata(): Promise<Metadata> {
  const s = await getAgencySettings();
  const origin = getPublicOrigin();
  const canonical = origin || undefined;
  const ogImage = s.og_image_url || s.icon_url || undefined;

  return {
    metadataBase: origin ? new URL(origin) : undefined,
    title: {
      default: s.site_title,
      template: `%s — ${s.site_title}`,
    },
    description: s.site_description,
    applicationName: s.site_title,
    // Google Search Console verification token, pasted into Brand & SEO.
    verification: s.google_verification ? { google: s.google_verification } : undefined,
    // Favicon (any square PNG/SVG works). Falls back to the bundled favicon.ico.
    icons: s.favicon_url
      ? { icon: s.favicon_url, apple: s.favicon_url }
      : undefined,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: s.site_title,
      description: s.site_description,
      siteName: s.site_title,
      url: canonical,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: s.site_title }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: s.site_title,
      description: s.site_description,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('sa-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
            }}
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
