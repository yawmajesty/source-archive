import Link from "next/link";
import { PublicPriceTool } from "./PublicPriceTool";

export const metadata = {
  title: "Garment pricing calculator — Source[Archive]",
  description:
    "Work out what a garment costs to make and what you should charge for it. Free, no sign-up.",
};

/**
 * The shareable calculator.
 *
 * Public and deliberately storage-free: everything the visitor types stays
 * in their own browser. A public page that wrote to the database would be
 * an open invitation to fill it with junk, and there is nothing here worth
 * keeping on our side — the value is the sum, not the record of it.
 */
export default function PublicPricePage() {
  return (
    <div className="min-h-screen bg-[var(--sa-bg)]">
      <header className="border-b border-[var(--sa-border)] bg-[var(--sa-window)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <Link href="/for-brands" className="text-[13px] font-semibold text-[var(--sa-text-primary)]">
            Source<span className="text-[var(--sa-text-tertiary)]">[</span>Archive
            <span className="text-[var(--sa-text-tertiary)]">]</span>
          </Link>
          <span className="text-[12px] text-[var(--sa-text-tertiary)]">Pricing calculator</span>
          <div className="flex-1" />
          <Link
            href="/sign-up"
            className="rounded-md bg-[var(--sa-accent)] px-3 py-1.5 text-[12.5px] font-medium text-white"
          >
            Save your styles — free trial
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-7">
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--sa-text-primary)]">
          What should you sell it for?
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--sa-text-secondary)]">
          List your fabrics and trims, add the factory&apos;s cut-make-trim, and this works
          backwards to the price you need to charge. Most calculators stop at cost × 2 — this one
          accounts for the discounting, returns and card fees that come out of the same money your
          margin is measured on.
        </p>
        <p className="mt-2 text-[12px] text-[var(--sa-text-tertiary)]">
          Nothing you type here is sent anywhere. It stays in this browser.
        </p>

        <div className="mt-7">
          <PublicPriceTool />
        </div>
      </div>
    </div>
  );
}
