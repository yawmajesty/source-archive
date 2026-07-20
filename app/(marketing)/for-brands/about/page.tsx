import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "About — Source[Archive] for brands",
  description: "Why we built a workspace for fashion brands, and who's behind it.",
};

export default function AboutPage() {
  return (
    <div>
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-8 text-center">
        <p className="text-[11px] uppercase tracking-widest text-[var(--sa-text-tertiary)] mb-3">About</p>
        <h1 className="font-serif text-[42px] sm:text-[52px] leading-[1.05] tracking-tight">
          Built by people who <span className="italic">actually run collections.</span>
        </h1>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-8 space-y-6 text-[15px] text-[var(--sa-text-secondary)] leading-[1.7]">
        <p>
          Source[Archive] started as a production agency for independent brands who wanted to make things
          properly — the right factory, the right fabrics, sensible margins. We noticed the same
          pattern on every project: brilliant creative work drowning in spreadsheet chaos.
        </p>
        <p>
          Every brand we worked with had the same problem stack. Costings scattered across four Google
          Sheets. Sample rounds tracked in WhatsApp with photos lost in the scroll. Factory quotes
          buried in email threads. A launch date on a Notion page nobody looked at.
        </p>
        <p>
          We built the tools we wished we had, then realised other brands wanted them too. So we split
          the product off into its own thing — this thing. The agency still exists (that's the "managed"
          option). The platform is for everyone else.
        </p>
      </section>

      <section className="bg-[var(--sa-window)] border-y border-[var(--sa-border)] mt-8">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h2 className="font-serif text-[24px] mb-4">What we believe</h2>
          <ul className="space-y-4 text-[14px] text-[var(--sa-text-secondary)] leading-relaxed">
            <li>
              <strong className="text-[var(--sa-text-primary)]">Your workspace is your data.</strong>{" "}
              Cancel any time, export what you like. We don't hold your work hostage.
            </li>
            <li>
              <strong className="text-[var(--sa-text-primary)]">Tools should match how you already work.</strong>{" "}
              Not force you to adopt someone else's methodology. Kanban if you want kanban, timeline
              if you want timeline, spreadsheets if you want spreadsheets.
            </li>
            <li>
              <strong className="text-[var(--sa-text-primary)]">Factories are collaborators, not vendors.</strong>{" "}
              We built sample rounds and comment threads because the relationship deserves
              first-class UI, not an afterthought email tab.
            </li>
            <li>
              <strong className="text-[var(--sa-text-primary)]">Margins are a design decision.</strong>{" "}
              You should see them at the same time as you see the sketch — not two weeks after the
              factory quotes.
            </li>
          </ul>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="font-serif text-[28px] tracking-tight">Want to know more?</h2>
        <p className="mt-3 text-[13.5px] text-[var(--sa-text-secondary)] max-w-md mx-auto">
          Whether you're a solo designer thinking about your first drop or an established brand
          rethinking your process — we'd love to hear from you.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-2 items-center justify-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-text-primary)] px-5 py-3 text-[13px] font-medium text-[var(--sa-window)] hover:opacity-90"
          >
            Start free trial <ArrowRight size={13} />
          </Link>
          <Link
            href="/enquire"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sa-border)] px-5 py-3 text-[13px] font-medium text-[var(--sa-text-primary)] hover:bg-[var(--sa-hover)]"
          >
            Talk to us
          </Link>
        </div>
      </section>
    </div>
  );
}
