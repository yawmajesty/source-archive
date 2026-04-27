"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { submitEnquiry } from "./actions";

const HOW_FOUND = [
  "Instagram", "Google", "Referral / Word of mouth", "LinkedIn",
  "Press / Editorial", "Trade show", "Other",
];

const inputCls = "w-full rounded-xl border border-[#D1D1D6] bg-white px-4 py-3 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#1A1A2E] transition-colors";
const labelCls = "block text-[12px] font-semibold text-[#6E6E73] mb-1.5 uppercase tracking-wide";

export function EnquireForm() {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_name: "", company_name: "", contact_email: "",
    phone: "", country: "", industry: "",
    product_interest: "", how_found_us: "", message: "",
  });

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contact_name || !form.company_name || !form.contact_email) return;
    setSaving(true);
    await submitEnquiry({
      contact_name: form.contact_name,
      company_name: form.company_name,
      contact_email: form.contact_email,
      phone: form.phone || null,
      country: form.country || null,
      industry: form.industry || null,
      product_interest: form.product_interest || null,
      how_found_us: form.how_found_us || null,
      message: form.message || null,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-[#E5E5EA] px-10 py-14 max-w-md w-full text-center">
          <div className="flex justify-center mb-5">
            <CheckCircle size={48} className="text-emerald-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">Thanks, we'll be in touch.</h1>
          <p className="text-[14px] text-[#6E6E73] leading-relaxed">
            We've received your enquiry and will get back to you within 1–2 business days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-start py-16 px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A2E] text-white text-[16px] font-bold mb-4">S</div>
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">Get in touch</h1>
          <p className="mt-2 text-[15px] text-[#6E6E73]">Tell us about your brand and what you're working on.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-[#E5E5EA] px-8 py-8 flex flex-col gap-6">

          {/* Contact */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] uppercase tracking-widest border-b border-[#F2F2F7] pb-2">Contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Your name *</label>
                <input required className={inputCls} placeholder="Jane Smith" value={form.contact_name} onChange={set("contact_name")} />
              </div>
              <div>
                <label className={labelCls}>Brand / Company *</label>
                <input required className={inputCls} placeholder="Acme Studio" value={form.company_name} onChange={set("company_name")} />
              </div>
              <div>
                <label className={labelCls}>Email *</label>
                <input required type="email" className={inputCls} placeholder="jane@brand.com" value={form.contact_email} onChange={set("contact_email")} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} placeholder="+44 7700 900000" value={form.phone} onChange={set("phone")} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input className={inputCls} placeholder="United Kingdom" value={form.country} onChange={set("country")} />
              </div>
              <div>
                <label className={labelCls}>Industry</label>
                <input className={inputCls} placeholder="Menswear, Streetwear…" value={form.industry} onChange={set("industry")} />
              </div>
            </div>
          </div>

          {/* What they need */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[13px] font-semibold text-[#1D1D1F] uppercase tracking-widest border-b border-[#F2F2F7] pb-2">Your project</h2>
            <div>
              <label className={labelCls}>What are you looking to produce?</label>
              <textarea
                rows={3}
                className={inputCls}
                placeholder="e.g. A capsule collection of 3 styles — hoodie, tracksuit bottoms, and a tee. Looking at 200 units per style."
                value={form.product_interest}
                onChange={set("product_interest")}
              />
            </div>
            <div>
              <label className={labelCls}>Anything else you'd like to share?</label>
              <textarea
                rows={2}
                className={inputCls}
                placeholder="Timeline, budget, references, any other context…"
                value={form.message}
                onChange={set("message")}
              />
            </div>
          </div>

          {/* How found */}
          <div>
            <label className={labelCls}>How did you find us?</label>
            <select className={`${inputCls} appearance-none`} value={form.how_found_us} onChange={set("how_found_us")}>
              <option value="">Select…</option>
              {HOW_FOUND.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "#1A1A2E" }}
          >
            {saving ? "Sending…" : "Send enquiry"}
          </button>
        </form>
      </div>
    </div>
  );
}
