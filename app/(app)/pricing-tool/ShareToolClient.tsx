"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink, Calculator } from "lucide-react";

export function ShareToolClient({ url }: { url: string }) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  const message =
    `Thought this might be useful — it's a free calculator for working out ` +
    `what a garment costs to make and what you should charge for it.\n\n` +
    `You list your fabrics and trims, add the factory's cut-make-trim, and it ` +
    `works backwards to the price you need. It also accounts for discounting, ` +
    `returns and card fees, which is where most pricing goes wrong.\n\n` +
    `${url}\n\nNo sign-up needed.`;

  async function copy(text: string, which: "link" | "message") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard is blocked in some contexts; the field is selectable.
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--sa-border)] px-6 py-3">
        <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Pricing Tool</h1>
        <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">
          A free calculator you can send to anyone with a brand.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          {/* The link */}
          <div className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
            <div className="flex items-center gap-2">
              <Calculator size={15} className="text-[var(--sa-text-tertiary)]" />
              <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">Share link</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Share link"
                className="min-w-[200px] flex-1 rounded-md border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2 text-[13px] text-[var(--sa-text-primary)] outline-none"
              />
              <button
                onClick={() => copy(url, "link")}
                className="flex items-center gap-1.5 rounded-md bg-[var(--sa-accent)] px-3.5 py-2 text-[13px] font-medium text-white"
              >
                {copied === "link" ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-3 py-2 text-[13px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              >
                <ExternalLink size={13} /> Open
              </a>
            </div>

            <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--sa-text-tertiary)]">
              Anyone with the link can use it. No sign-up, no login, and nothing they type is sent
              to us — it stays in their browser. The page carries your Source Archive branding and
              a link to start a free trial.
            </p>
          </div>

          {/* Something to paste */}
          <div className="mt-4 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">
                A message to send with it
              </p>
              <div className="flex-1" />
              <button
                onClick={() => copy(message, "message")}
                className="flex items-center gap-1.5 rounded-md border border-[var(--sa-border)] px-2.5 py-1.5 text-[12.5px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              >
                {copied === "message" ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy message</>}
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--sa-bg)] p-3.5 font-sans text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
              {message}
            </pre>
          </div>

          {/* What they get */}
          <div className="mt-4 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5">
            <p className="text-[13px] font-medium text-[var(--sa-text-primary)]">What they can do with it</p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {[
                "List every fabric separately — supplier, price per metre, how much the garment takes",
                "Do the same for trims, priced per piece",
                "Add the factory's cut-make-trim quote",
                "Add freight, duty, sampling and tooling",
                "Set what discounting, returns and card fees cost them",
                "Get a wholesale price, a recommended retail, and what to charge on their own site",
              ].map((item) => (
                <li key={item} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--sa-text-secondary)]">
                  <span aria-hidden="true" className="text-[var(--sa-text-tertiary)]">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--sa-text-tertiary)]">
              To keep their work, they sign up — which drops them into their own brand workspace
              with the same calculator, saved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
