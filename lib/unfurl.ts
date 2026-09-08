// ─────────────────────────────────────────────────────────────
// Turning a pasted link into a preview.
//
// Two ways in, tried in order:
//
//   1. oEmbed, where the platform publishes one. YouTube, TikTok and
//      Vimeo do, and it gives a proper title, author and thumbnail.
//   2. OpenGraph tags scraped from the page. Pinterest, RedNote and most
//      of the rest serve these to crawlers even without an oEmbed
//      endpoint.
//
// Instagram deliberately has no fallback worth chasing: its oEmbed has
// needed a Facebook app token since 2020 and it blocks unauthenticated
// scrapers. An Instagram link becomes a plain card with the domain on
// it, which is honest, rather than a broken image that looks like a bug.
//
// SECURITY: this fetches a URL a user typed. That is a server-side
// request forgery hole unless every one of the guards below holds — the
// server can reach the cloud metadata endpoint and anything else on the
// private network, and a preview is not worth handing that out.
// ─────────────────────────────────────────────────────────────

export interface Unfurled {
  url: string;
  provider: string;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  authorName: string | null;
  /** Player/embed HTML, only ever from a known oEmbed provider. */
  embedHtml: string | null;
}

const TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024;

/** oEmbed endpoints that are public and need no token. */
const OEMBED: { test: RegExp; endpoint: (url: string) => string; provider: string }[] = [
  {
    provider: "YouTube",
    test: /^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)$/i,
    endpoint: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  },
  {
    provider: "TikTok",
    test: /^(www\.)?tiktok\.com$/i,
    endpoint: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  },
  {
    provider: "Vimeo",
    test: /^(www\.)?vimeo\.com$/i,
    endpoint: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  },
];

/** Recognised sources, for labelling a card we couldn't read. */
const KNOWN: { test: RegExp; name: string }[] = [
  { test: /pinterest\.[a-z.]+$|pin\.it$/i, name: "Pinterest" },
  { test: /instagram\.com$/i,              name: "Instagram" },
  { test: /tiktok\.com$/i,                 name: "TikTok" },
  { test: /xiaohongshu\.com$|xhslink\.com$/i, name: "RedNote" },
  { test: /youtube\.com$|youtu\.be$/i,     name: "YouTube" },
  { test: /vimeo\.com$/i,                  name: "Vimeo" },
  { test: /behance\.net$/i,                name: "Behance" },
  { test: /are\.na$/i,                     name: "Are.na" },
  { test: /x\.com$|twitter\.com$/i,        name: "X" },
];

export function providerFor(hostname: string): string {
  const hit = KNOWN.find((k) => k.test.test(hostname));
  return hit ? hit.name : hostname.replace(/^www\./, "");
}

/**
 * Reject anything that isn't a public web address.
 *
 * Blocks non-http schemes, credentials in the URL, and every private,
 * loopback, link-local and reserved range — including the 169.254.169.254
 * cloud metadata address, which is the one that actually gets exploited.
 */
export function isPubliclyFetchable(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That doesn't look like a link" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https links work here" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Links with credentials in them aren't allowed" };
  }

  const host = url.hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return { ok: false, reason: "That address isn't reachable" };
  }
  // Bare IPv6, and the loopback in particular.
  if (host.startsWith("[") || host === "::1") {
    return { ok: false, reason: "That address isn't reachable" };
  }

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    const isPrivate =
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||          // link-local, incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      a >= 224;                             // multicast and reserved
    if (isPrivate) return { ok: false, reason: "That address isn't reachable" };
  }

  return { ok: true, url };
}

async function fetchText(url: string, accept: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Manual redirects: a 302 to a private address would otherwise walk
      // straight past the check above.
      redirect: "manual",
      headers: {
        Accept: accept,
        // Most platforms only serve OpenGraph tags to something that
        // looks like a crawler.
        "User-Agent": "Mozilla/5.0 (compatible; SourceArchiveBot/1.0; +https://sourcearchive.studio)",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      const next = new URL(location, url).toString();
      const check = isPubliclyFetchable(next);
      if (!check.ok) return null;
      // One hop only. Chains are for crawlers, not for a paste box.
      const second = await fetch(next, {
        signal: controller.signal,
        redirect: "error",
        headers: { Accept: accept, "User-Agent": "Mozilla/5.0 (compatible; SourceArchiveBot/1.0)" },
      });
      if (!second.ok) return null;
      return (await second.text()).slice(0, MAX_BYTES);
    }

    if (!res.ok) return null;
    return (await res.text()).slice(0, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function meta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    // property= and name= both occur in the wild, in either attribute order.
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return decodeEntities(m[1]).trim() || null;
    }
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

export async function unfurl(raw: string): Promise<Unfurled | { error: string }> {
  const check = isPubliclyFetchable(raw);
  if (!check.ok) return { error: check.reason };

  const url = check.url;
  const provider = providerFor(url.hostname);

  // 1. oEmbed, where it's public.
  const oe = OEMBED.find((o) => o.test.test(url.hostname));
  if (oe) {
    const body = await fetchText(oe.endpoint(url.toString()), "application/json");
    if (body) {
      try {
        const j = JSON.parse(body) as Record<string, unknown>;
        return {
          url: url.toString(),
          provider: oe.provider,
          title: (j.title as string) ?? null,
          description: null,
          thumbnail: (j.thumbnail_url as string) ?? null,
          authorName: (j.author_name as string) ?? null,
          embedHtml: typeof j.html === "string" ? j.html : null,
        };
      } catch {
        // Fall through to OpenGraph.
      }
    }
  }

  // 2. OpenGraph.
  const html = await fetchText(url.toString(), "text/html,application/xhtml+xml");
  if (!html) {
    return {
      url: url.toString(), provider,
      title: null, description: null, thumbnail: null, authorName: null, embedHtml: null,
    };
  }

  const thumb = meta(html, "og:image:secure_url", "og:image", "twitter:image", "twitter:image:src");
  return {
    url: url.toString(),
    provider,
    title:
      meta(html, "og:title", "twitter:title") ??
      html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim() ??
      null,
    description: meta(html, "og:description", "twitter:description", "description"),
    // A thumbnail on a private address is the same hole in a different shape.
    thumbnail: thumb && isPubliclyFetchable(thumb).ok ? thumb : null,
    authorName: meta(html, "og:site_name", "author"),
    embedHtml: null,
  };
}
