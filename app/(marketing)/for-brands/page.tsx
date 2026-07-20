import Link from "next/link";
import {
  ArrowRight,
  Layers,
  LayoutGrid,
  Kanban,
  CalendarClock,
  Coins,
  Camera,
  Users,
  ShieldCheck,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { PLAN_LIMITS } from "@/lib/plan-limits";

export const metadata = {
  title: "The workspace for fashion brands — Source[Archive] for brands",
  description:
    "Concept to delivered production in one place. Kanban, timeline, costing, sampling — every collection tracked the way you actually work.",
};

export default function MarketingLandingPage() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-1 text-[11px] uppercase tracking-widest text-[var(--sa-text-secondary)] mb-6">
            <Sparkles size={11} /> Early access is open
          </p>
          <h1 className="font-serif text-[42px] sm:text-[56px] leading-[1.05] tracking-tight text-[var(--sa-text-primary)] max-w-3xl mx-auto">
            Concept to delivered production,{" "}
            <span className="italic">in one workspace.</span>
          </h1>
          <p className="mt-6 text-[15px] sm:text-[16px] text-[var(--sa-text-secondary)] max-w-2xl mx-auto leading-relaxed">
            Kanban, timeline, costing, sampling — every collection tracked the way you actually work.
            Ditch the WhatsApp chains and shared drives.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-5 py-3 text-[13px] font-medium text-[var(--sa-window)] hover:opacity-90"
            >
              Start free trial <ArrowRight size={13} />
            </Link>
            <Link
              href="/for-brands/how-it-works"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-5 py-3 text-[13px] font-medium text-[var(--sa-text-primary)] hover:bg-[var(--sa-hover)]"
            >
              See how it works <ChevronRight size={13} />
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-[var(--sa-text-tertiary)]">14-day trial · No card required · Every feature unlocked</p>
        </div>

        {/* Product mockup placeholder */}
        <div className="max-w-5xl mx-auto px-6 pb-16">
          <div className="aspect-[16/9] rounded-2xl border border-[var(--sa-border)] bg-gradient-to-br from-[var(--sa-window)] to-[var(--sa-bg)] shadow-2xl shadow-black/5 flex items-center justify-center">
            <div className="text-center px-6">
              <LayoutGrid size={40} className="mx-auto text-[var(--sa-text-tertiary)]" strokeWidth={1} />
              <p className="mt-3 text-[12px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">Product screenshot</p>
              <p className="text-[11px] text-[var(--sa-text-tertiary)] max-w-md mt-1">
                A gallery of collection cards — cover images, style codes, stage badges. Swap views to kanban, timeline, or costing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value prop ───────────────────────────────────────── */}
      <section className="bg-[var(--sa-window)] border-y border-[var(--sa-border)]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ValueTile
              icon={<Layers size={20} />}
              title="Every collection, one truth."
              body="No more spreadsheets scattered across three drives. Colorways, spec, sample rounds, factory quotes — all under a single style code."
            />
            <ValueTile
              icon={<CalendarClock size={20} />}
              title="The calendar you always meant to keep."
              body="Kickoff, sample deadlines, ex-factory, launch. See what's due this week and what's slipping without hunting through email."
            />
            <ValueTile
              icon={<Coins size={20} />}
              title="Margins you can trust."
              body="Multi-currency FX, itemized cost breakdowns, retail + wholesale in your base currency. Flag styles below your target margin before it's too late."
            />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-2">The workspace</p>
          <h2 className="font-serif text-[32px] sm:text-[40px] tracking-tight">Built for how brands actually run collections.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard icon={<LayoutGrid size={16} />} title="Gallery, table, kanban" body="Switch views without losing context. Move a style from Concept to Approved with a drag. Guardrails catch missing sign-offs." />
          <FeatureCard icon={<CalendarClock size={16} />} title="Timeline & milestones" body="A Gantt-lite across every product's key dates. Overdue items surface at the top of each collection." />
          <FeatureCard icon={<Coins size={16} />} title="Costing with FX baked in" body="Enter costs in the factory's currency. Rollups convert to your base currency and flag margin breaches." />
          <FeatureCard icon={<Camera size={16} />} title="Sampling rounds" body="Track every proto from requested to approved. Feedback threads, photos, tracking numbers — all versioned by round." />
          <FeatureCard icon={<Kanban size={16} />} title="Stage kanban" body="A visual pipeline of your whole collection. Concept, Design, Tech Pack, Sampling, Production, Delivered." />
          <FeatureCard icon={<Users size={16} />} title="Team + supplier access" body="Invite your team, your factory, your production partner. Roles gate who can change margins or approve for production." />
        </div>
      </section>

      {/* ── Two-mode explanation ─────────────────────────────── */}
      <section className="bg-[var(--sa-window)] border-y border-[var(--sa-border)]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-2">Two ways to work with us</p>
            <h2 className="font-serif text-[32px] sm:text-[40px] tracking-tight">Independent or managed. Same platform.</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModeCard
              badge="Self-serve"
              title="Independent"
              body="Sign up, invite your team, run your own factories. You own every workflow. Pay monthly or annually — cancel any time."
              bullets={[
                "Bring your own suppliers",
                "Direct factory chat via sampling threads",
                "Cancel any time — your data stays put",
              ]}
              cta={{ href: "/sign-up", label: "Start free trial" }}
            />
            <ModeCard
              badge="Full service"
              title="Managed by Source[Archive]"
              body="Our production team joins your workspace. We source factories, negotiate rates, and drive sampling — you approve. No subscription, priced per collection."
              bullets={[
                "Source[Archive] production team as your collaborators",
                "Vetted factory network — no cold outreach",
                "Sample and production coordination handled",
              ]}
              cta={{ href: "/enquire", label: "Book a call" }}
              accent
            />
          </div>
        </div>
      </section>

      {/* ── Pricing preview ──────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-2">Pricing</p>
          <h2 className="font-serif text-[32px] sm:text-[40px] tracking-tight">Simple. Scales with your team.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["solo", "studio", "atelier"] as const).map((k) => {
            const p = PLAN_LIMITS[k];
            const isFeatured = k === "studio";
            return (
              <div
                key={k}
                className={
                  "rounded-2xl border p-6 flex flex-col " +
                  (isFeatured
                    ? "border-[var(--sa-text-primary)] bg-[var(--sa-window)] shadow-xl shadow-black/5"
                    : "border-[var(--sa-border)] bg-[var(--sa-window)]")
                }
              >
                <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">{p.audience}</p>
                <h3 className="mt-1 text-[22px] font-semibold">{p.displayName}</h3>
                <p className="mt-1 text-[12px] text-[var(--sa-text-secondary)]">{p.tagline}</p>
                <div className="mt-5 mb-5">
                  <span className="text-[36px] font-semibold">${p.monthlyPriceUsd}</span>
                  <span className="text-[12px] text-[var(--sa-text-tertiary)]"> /mo</span>
                </div>
                <Link
                  href="/for-brands/pricing"
                  className={
                    "text-center rounded-lg px-4 py-2 text-[13px] font-medium " +
                    (isFeatured
                      ? "bg-[var(--sa-text-primary)] text-[var(--sa-window)] hover:opacity-90"
                      : "border border-[var(--sa-border)] hover:bg-[var(--sa-hover)]")
                  }
                >
                  See what's included
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[12px] text-[var(--sa-text-tertiary)]">
          All plans start with a 14-day free trial. Cancel any time.
        </p>
      </section>

      {/* ── Security / trust ─────────────────────────────────── */}
      <section className="bg-[var(--sa-window)] border-y border-[var(--sa-border)]">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <ShieldCheck size={28} className="mx-auto text-[var(--sa-text-tertiary)]" strokeWidth={1.5} />
          <h3 className="mt-3 text-[18px] font-semibold">Your data stays your data.</h3>
          <p className="mt-2 text-[13px] text-[var(--sa-text-secondary)] max-w-lg mx-auto">
            Row-level tenant isolation, encrypted in transit and at rest. Your factory doesn't see your competitor's collection.
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="font-serif text-[32px] sm:text-[42px] tracking-tight">
          Start a collection today.
        </h2>
        <p className="mt-3 text-[14px] text-[var(--sa-text-secondary)]">
          No card. No demo call. Sign up and quick-add your first product in under a minute.
        </p>
        <Link
          href="/sign-up"
          className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-6 py-3 text-[13px] font-medium text-[var(--sa-window)] hover:opacity-90"
        >
          Start free trial <ArrowRight size={13} />
        </Link>
      </section>
    </div>
  );
}

function ValueTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-3 inline-flex items-center justify-center h-10 w-10 rounded-full bg-[var(--sa-bg)] text-[var(--sa-text-primary)]">
        {icon}
      </div>
      <h3 className="text-[17px] font-semibold text-[var(--sa-text-primary)]">{title}</h3>
      <p className="mt-1.5 text-[13px] text-[var(--sa-text-secondary)] leading-relaxed">{body}</p>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 hover:border-[var(--sa-text-primary)]/40 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--sa-bg)] text-[var(--sa-text-primary)]">
          {icon}
        </span>
        <h3 className="text-[14px] font-semibold">{title}</h3>
      </div>
      <p className="text-[12.5px] text-[var(--sa-text-secondary)] leading-relaxed">{body}</p>
    </div>
  );
}

function ModeCard({
  badge, title, body, bullets, cta, accent,
}: {
  badge: string;
  title: string;
  body: string;
  bullets: string[];
  cta: { href: string; label: string };
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-8 flex flex-col " +
        (accent
          ? "border-[var(--sa-text-primary)] bg-[var(--sa-text-primary)] text-[var(--sa-window)]"
          : "border-[var(--sa-border)] bg-[var(--sa-bg)]")
      }
    >
      <p className={"text-[10px] uppercase tracking-widest mb-2 " + (accent ? "text-[var(--sa-window)]/60" : "text-[var(--sa-text-tertiary)]")}>
        {badge}
      </p>
      <h3 className="text-[24px] font-semibold font-serif">{title}</h3>
      <p className={"mt-2 text-[13.5px] leading-relaxed " + (accent ? "text-[var(--sa-window)]/80" : "text-[var(--sa-text-secondary)]")}>
        {body}
      </p>
      <ul className={"mt-5 space-y-2 text-[13px] " + (accent ? "text-[var(--sa-window)]/90" : "text-[var(--sa-text-primary)]")}>
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className={"mt-1.5 h-1 w-1 rounded-full " + (accent ? "bg-[var(--sa-window)]" : "bg-[var(--sa-text-primary)]")} />
            {b}
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={
          "mt-auto pt-6 inline-flex items-center gap-1.5 text-[13px] font-medium " +
          (accent ? "text-[var(--sa-window)] hover:opacity-90" : "text-[var(--sa-text-primary)] hover:opacity-70")
        }
      >
        {cta.label} <ArrowRight size={13} />
      </Link>
    </div>
  );
}
