"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export function BriefForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", contact_email: "", country: "",
    industry: "", product_interest: "", estimated_budget: "", message: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-6" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 text-center max-w-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle size={32} strokeWidth={1.5} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-[22px] font-semibold text-[#1D1D1F]">Brief received</h2>
            <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed">
              Thank you, {form.contact_name.split(" ")[0] || "there"}. We&apos;ll review your brief and be in touch within 2 business days.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-[#D1D1D6] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#1A1A2E] transition-colors";
  const labelCls = "block text-[12px] font-medium text-[#6E6E73] mb-1.5";

  return (
    <div className="min-h-screen bg-[#F5F5F7]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center gap-2.5 px-8 py-5 border-b border-black/[0.08] bg-white">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1A2E] text-white text-[13px] font-bold">K</div>
        <span className="text-[15px] font-semibold text-[#1D1D1F]">Source[Archive]</span>
      </header>

      <main className="mx-auto max-w-xl px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">Tell us about your project</h1>
          <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed">
            Share a few details and we&apos;ll get back to you within 2 business days to discuss how we can help.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mt-8 flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Company name *</label>
              <input required className={inputCls} placeholder="Acme Studio" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Your name *</label>
              <input required className={inputCls} placeholder="Jane Smith" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email address *</label>
              <input required type="email" className={inputCls} placeholder="jane@company.com" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input className={inputCls} placeholder="United Kingdom" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Industry / sector</label>
              <input className={inputCls} placeholder="Fashion, Homeware…" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Estimated budget</label>
              <select
                className={inputCls}
                value={form.estimated_budget}
                onChange={(e) => set("estimated_budget", e.target.value)}
              >
                <option value="">Select range…</option>
                <option>Under £5,000</option>
                <option>£5,000 – £15,000</option>
                <option>£15,000 – £30,000</option>
                <option>£30,000 – £75,000</option>
                <option>£75,000+</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>What products are you looking to source? *</label>
            <input required className={inputCls} placeholder="e.g. Ceramic tableware, knitwear, candles…" value={form.product_interest} onChange={(e) => set("product_interest", e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Tell us more about your project</label>
            <textarea
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="Timeline, quantities, quality requirements, any relevant context…"
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-xl bg-[#1A1A2E] py-3 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Submit brief
          </button>

          <p className="text-center text-[11px] text-[#AEAEB2]">
            We&apos;ll respond within 2 business days. Your information is kept confidential.
          </p>
        </motion.form>
      </main>
    </div>
  );
}
