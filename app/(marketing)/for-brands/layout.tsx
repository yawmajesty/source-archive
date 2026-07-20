import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight } from "lucide-react";

// Public marketing shell. No auth gate — the whole point is to be
// reachable by prospects. Sign-in / start-trial buttons switch based on
// whether the visitor is already signed in.

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  return (
    <div className="min-h-screen bg-[var(--sa-bg)] text-[var(--sa-text-primary)]">
      {/* Announcement bar */}
      <div className="bg-[var(--sa-text-primary)] text-[var(--sa-window)] text-[11px] tracking-wider uppercase px-4 py-2 text-center">
        Now inviting brands to the early access program — 14 days free, no card.
      </div>

      {/* Header */}
      <header className="border-b border-[var(--sa-border)] bg-[var(--sa-window)]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/for-brands" className="flex items-center gap-2">
            <span className="font-serif italic text-[18px] text-[var(--sa-text-primary)]">Source[Archive]</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">for brands</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[13px] text-[var(--sa-text-secondary)]">
            <Link href="/for-brands/how-it-works" className="hover:text-[var(--sa-text-primary)] transition-colors">How it works</Link>
            <Link href="/for-brands/pricing" className="hover:text-[var(--sa-text-primary)] transition-colors">Pricing</Link>
            <Link href="/for-brands/about" className="hover:text-[var(--sa-text-primary)] transition-colors">About</Link>
          </nav>
          <div className="flex items-center gap-2">
            {userId ? (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-window)] hover:opacity-90"
              >
                Open dashboard <ArrowRight size={12} />
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="hidden sm:inline text-[13px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-text-primary)]">Sign in</Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--sa-window)] hover:opacity-90"
                >
                  Start free trial <ArrowRight size={12} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-[var(--sa-border)] bg-[var(--sa-window)] mt-20">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-4 gap-8">
          <div className="col-span-2 sm:col-span-1">
            <p className="font-serif italic text-[18px]">Source[Archive]</p>
            <p className="mt-2 text-[12px] text-[var(--sa-text-tertiary)] max-w-xs">
              A workspace for fashion brands to run their collections from concept through delivered production.
            </p>
          </div>
          <FooterCol title="Product" links={[
            { href: "/for-brands/how-it-works", label: "How it works" },
            { href: "/for-brands/pricing", label: "Pricing" },
            { href: "/sign-up", label: "Start free trial" },
            { href: "/sign-in", label: "Sign in" },
          ]} />
          <FooterCol title="Company" links={[
            { href: "/for-brands/about", label: "About" },
            { href: "/enquire", label: "Talk to us" },
            { href: "https://sourcearchive.studio", label: "Agency ↗", external: true },
          ]} />
          <FooterCol title="Legal" links={[
            { href: "/for-brands/terms", label: "Terms" },
            { href: "/for-brands/privacy", label: "Privacy" },
          ]} />
        </div>
        <div className="border-t border-[var(--sa-border)] px-6 py-4 max-w-6xl mx-auto flex items-center justify-between text-[11px] text-[var(--sa-text-tertiary)]">
          <span>© {new Date().getFullYear()} Source[Archive]. All rights reserved.</span>
          <span>Made in London.</span>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ href: string; label: string; external?: boolean }> }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--sa-text-tertiary)] mb-3">{title}</p>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-text-primary)]">
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="text-[12px] text-[var(--sa-text-secondary)] hover:text-[var(--sa-text-primary)]">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
