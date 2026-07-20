import Link from "next/link";
import { ArrowRight, Check, Minus, MessageCircle } from "lucide-react";
import { PLAN_LIMITS, isUnlimited, type Plan } from "@/lib/plan-limits";

export const metadata = {
  title: "Pricing — Source[Archive] for brands",
  description: "Three tiers, one free trial. Pick the plan that fits your team.",
};

// Order matters: shown left → right on the cards and the matrix.
const TIERS: Plan[] = ["solo", "studio", "atelier"];

// Feature matrix — one row per feature, per-tier values.
const MATRIX: Array<{ label: string; group?: string; value: (p: Plan) => React.ReactNode }> = [
  { label: "Active collections",     value: (p) => fmtLimit(PLAN_LIMITS[p].collections) },
  { label: "Teammate seats",         value: (p) => fmtLimit(PLAN_LIMITS[p].members) },
  { label: "Workspace storage",      value: (p) => fmtBytes(PLAN_LIMITS[p].storageBytes) },
  { label: "Activity history",       value: (p) => fmtDays(PLAN_LIMITS[p].activityRetentionDays) },
  { label: "Kanban & timeline",      value: () => <YesIcon /> },
  { label: "Multi-currency costing", value: () => <YesIcon /> },
  { label: "Sample rounds & feedback", value: () => <YesIcon /> },
  { label: "CSV export",             value: (p) => (PLAN_LIMITS[p].csvExport ? <YesIcon /> : <NoIcon />) },
  { label: "PDF line sheet",         value: (p) => (PLAN_LIMITS[p].pdfLineSheet ? <YesIcon /> : <NoIcon />) },
  { label: "Supplier guest access",  value: (p) => (p === "atelier" ? <YesIcon /> : <NoIcon />) },
  { label: "Priority support",       value: (p) => (p === "atelier" ? <YesIcon /> : <NoIcon />) },
];

export default function PricingPage() {
  return (
    <div>
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-8 text-center">
        <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-3">Pricing</p>
        <h1 className="font-serif text-[42px] sm:text-[52px] leading-[1.05] tracking-tight">
          Pay for what you use. <span className="italic">Nothing more.</span>
        </h1>
        <p className="mt-5 text-[15px] text-[var(--sa-text-secondary)] max-w-2xl mx-auto">
          Start with the free trial. Move to a paid plan when you're ready — your work carries over. Cancel any time.
        </p>
      </section>

      {/* Trial callout */}
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">Free trial</p>
            <p className="text-[14px] font-semibold">14 days · Every feature unlocked · No card</p>
          </div>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-4 py-2 text-[12px] font-medium text-[var(--sa-window)] hover:opacity-90"
          >
            Start free trial <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Tier cards */}
      <section className="max-w-6xl mx-auto px-6 pt-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((k) => {
            const p = PLAN_LIMITS[k];
            const featured = k === "studio";
            return (
              <div
                key={k}
                className={
                  "rounded-2xl border p-6 flex flex-col " +
                  (featured
                    ? "border-[var(--sa-text-primary)] bg-[var(--sa-window)] shadow-xl shadow-black/5"
                    : "border-[var(--sa-border)] bg-[var(--sa-window)]")
                }
              >
                <div className="flex items-baseline justify-between mb-3">
                  <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)]">{p.audience}</p>
                  {featured && (
                    <span className="rounded-full bg-[var(--sa-text-primary)] px-2 py-0.5 text-[9px] uppercase tracking-widest text-[var(--sa-window)]">
                      Most picked
                    </span>
                  )}
                </div>
                <h3 className="text-[24px] font-semibold">{p.displayName}</h3>
                <p className="mt-1 text-[12.5px] text-[var(--sa-text-secondary)]">{p.tagline}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-[40px] font-semibold leading-none">${p.monthlyPriceUsd}</span>
                  <span className="text-[12px] text-[var(--sa-text-tertiary)]">/mo</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--sa-text-tertiary)]">
                  or ${p.yearlyPriceUsd}/mo billed annually
                </p>
                <ul className="mt-5 space-y-2 text-[13px] text-[var(--sa-text-primary)]">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check size={12} className="mt-1.5 text-[var(--sa-text-primary)] shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={
                    "mt-6 text-center rounded-lg px-4 py-2.5 text-[13px] font-medium " +
                    (featured
                      ? "bg-[var(--sa-text-primary)] text-[var(--sa-window)] hover:opacity-90"
                      : "border border-[var(--sa-border)] hover:bg-[var(--sa-hover)]")
                  }
                >
                  Start with {p.displayName}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature matrix */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="font-serif text-[24px] mb-4">What's in each plan</h2>
        <div className="rounded-2xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--sa-bg)] border-b border-[var(--sa-border)]">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--sa-text-primary)]">Feature</th>
                  {TIERS.map((t) => (
                    <th key={t} className="px-5 py-3 font-semibold text-center text-[var(--sa-text-primary)]">
                      {PLAN_LIMITS[t].displayName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sa-border)]">
                {MATRIX.map((row) => (
                  <tr key={row.label}>
                    <td className="px-5 py-2.5 text-[var(--sa-text-primary)]">{row.label}</td>
                    {TIERS.map((t) => (
                      <td key={t} className="px-5 py-2.5 text-center text-[var(--sa-text-secondary)]">
                        {row.value(t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Managed enquiry */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-[var(--sa-text-primary)] bg-[var(--sa-text-primary)] text-[var(--sa-window)] p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[var(--sa-window)]/60 mb-2">Managed by Source[Archive]</p>
            <h3 className="text-[24px] font-serif">Not a subscription — priced per collection.</h3>
            <p className="mt-2 text-[13px] text-[var(--sa-window)]/80 max-w-lg">
              We source your factories, negotiate rates, and drive sampling. You approve. Same workspace, our production team as collaborators.
            </p>
          </div>
          <Link
            href="/enquire"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-window)] px-5 py-3 text-[13px] font-medium text-[var(--sa-text-primary)] hover:opacity-90 shrink-0"
          >
            <MessageCircle size={13} /> Book a call
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-serif text-[28px] mb-6 text-center">Common questions</h2>
        <div className="space-y-3">
          <Faq q="What happens after the trial ends?" a="Your workspace stays intact — reads still work, edits pause until you pick a plan. Nothing is deleted." />
          <Faq q="Can I switch tiers later?" a="Yes. Upgrade any time; downgrades apply at the next billing cycle. Your data doesn't move." />
          <Faq q="Does the factory pay for a seat?" a="On Atelier we include supplier guest access (view + comment on sample rounds you share). On Solo/Studio they'd need a paid seat if you want them editing." />
          <Faq q="What currencies can I quote in?" a="Every ISO-4217 currency. Set FX rates per collection, roll up in your base currency. Rate history preserved so historic costings don't drift." />
          <Faq q="Where is my data hosted?" a="On Supabase, EU region. Encrypted in transit and at rest. Row-level tenant isolation between workspaces." />
        </div>
      </section>
    </div>
  );
}

function YesIcon() {
  return <Check size={13} className="inline-block text-emerald-600 dark:text-emerald-400" />;
}
function NoIcon() {
  return <Minus size={13} className="inline-block text-[var(--sa-text-tertiary)]" />;
}
function fmtLimit(n: number) {
  return isUnlimited(n) ? "Unlimited" : n.toLocaleString();
}
function fmtBytes(n: number) {
  const gb = n / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb} GB`;
  return `${Math.round(n / (1024 * 1024))} MB`;
}
function fmtDays(n: number) {
  if (isUnlimited(n)) return "Unlimited";
  if (n >= 365) return `${Math.round(n / 365)} year${n >= 730 ? "s" : ""}`;
  return `${n} days`;
}
function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-4 open:pb-5">
      <summary className="list-none cursor-pointer flex items-center justify-between text-[13.5px] font-semibold text-[var(--sa-text-primary)]">
        {q}
        <span className="text-[var(--sa-text-tertiary)] group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="mt-2 text-[13px] text-[var(--sa-text-secondary)] leading-relaxed">{a}</p>
    </details>
  );
}
