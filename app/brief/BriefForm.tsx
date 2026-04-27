"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Plus, Trash2, ChevronRight, ChevronLeft, ExternalLink } from "lucide-react";
import { submitBrief } from "./actions";
import type { BriefProduct } from "@/lib/mock-data";

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Dresses & Skirts", "Knitwear", "Activewear", "Accessories", "Footwear", "Homeware", "Beauty", "Other"];
const INDUSTRIES = ["Womenswear", "Menswear", "Unisex / Genderless", "Kids & Baby", "Accessories", "Homeware & Lifestyle", "Beauty & Wellness", "Sportswear", "Other"];
const HOW_FOUND = ["Instagram", "Google", "Referral / Word of mouth", "LinkedIn", "Press / Editorial", "Trade show", "Other"];

const inputCls = "w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#1A1A2E] transition-colors";
const labelCls = "block text-[12px] font-medium text-[#6E6E73] mb-1.5 uppercase tracking-wide";
const selectCls = `${inputCls} appearance-none`;

function ToggleGroup({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="rounded-full px-4 py-2 text-[13px] font-medium border transition-colors"
          style={value === o.value
            ? { background: "#1A1A2E", color: "#fff", borderColor: "#1A1A2E" }
            : { background: "#fff", color: "#3A3A3C", borderColor: "#D1D1D6" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const EMPTY_PRODUCT: BriefProduct = {
  name: "", category: "", description: "", target_qty: null,
  target_price_usd: null, colorways: null, moodboard_link: "", sustainability: "",
};

function ProductForm({ product, onChange, onRemove, index }: {
  product: BriefProduct; onChange: (p: BriefProduct) => void; onRemove: () => void; index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const set = (k: keyof BriefProduct, v: any) => onChange({ ...product, [k]: v });

  return (
    <div className="rounded-2xl border border-[#D1D1D6] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
      >
        <div>
          <p className="text-[14px] font-semibold text-[#1D1D1F]">
            {product.name || `Product ${index + 1}`}
          </p>
          {product.category && <p className="text-[12px] text-[#6E6E73] mt-0.5">{product.category}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 rounded-lg text-[#AEAEB2] hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <ChevronRight size={16} className={`text-[#AEAEB2] transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-[#F2F2F7]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div>
              <label className={labelCls}>Product name *</label>
              <input className={inputCls} placeholder="e.g. Oversized bomber jacket" value={product.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={selectCls} value={product.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description / brief</label>
            <textarea rows={3} className={`${inputCls} resize-none`} placeholder="Describe the product — silhouette, fabrics, details, finish…" value={product.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Target quantity</label>
              <input type="number" min={0} className={inputCls} placeholder="e.g. 300" value={product.target_qty ?? ""} onChange={(e) => set("target_qty", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className={labelCls}>Target price (USD)</label>
              <input type="number" min={0} step="0.01" className={inputCls} placeholder="e.g. 45.00" value={product.target_price_usd ?? ""} onChange={(e) => set("target_price_usd", e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label className={labelCls}>Colourways</label>
              <input type="number" min={1} className={inputCls} placeholder="e.g. 3" value={product.colorways ?? ""} onChange={(e) => set("colorways", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Moodboard / reference link</label>
              <input type="url" className={inputCls} placeholder="https://pinterest.com/…" value={product.moodboard_link} onChange={(e) => set("moodboard_link", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Sustainability requirements</label>
              <input className={inputCls} placeholder="e.g. GOTS cotton, recycled nylon" value={product.sustainability} onChange={(e) => set("sustainability", e.target.value)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 rounded-full transition-all duration-300"
          style={{
            flex: i === step - 1 ? 2 : 1,
            background: i < step ? "#1A1A2E" : "#E5E5EA",
          }}
        />
      ))}
    </div>
  );
}

const TOTAL_STEPS = 4;

export function BriefForm() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  // Step 1: Brand
  const [brand, setBrand] = useState({
    company_name: "", website: "", contact_name: "", contact_email: "",
    phone: "", country: "", industry: "", brand_stage: "",
    manufactured_before: "" as "" | "yes" | "no", how_found_us: "",
  });

  // Step 2: Products
  const [products, setProducts] = useState<BriefProduct[]>([{ ...EMPTY_PRODUCT }]);

  // Step 3: References
  const [refs, setRefs] = useState({
    estimated_budget: "", timeline: "", moodboard_links: "",
    sustainability_requirements: "", message: "",
  });

  function setBrandField(k: keyof typeof brand, v: string) {
    setBrand((prev) => ({ ...prev, [k]: v }));
  }
  function setRefsField(k: keyof typeof refs, v: string) {
    setRefs((prev) => ({ ...prev, [k]: v }));
  }

  function addProduct() {
    setProducts((prev) => [...prev, { ...EMPTY_PRODUCT }]);
  }
  function updateProduct(i: number, p: BriefProduct) {
    setProducts((prev) => prev.map((x, idx) => idx === i ? p : x));
  }
  function removeProduct(i: number) {
    setProducts((prev) => prev.filter((_, idx) => idx !== i));
  }

  const canNext1 = brand.company_name.trim() && brand.contact_name.trim() && brand.contact_email.trim();
  const canNext2 = products.length > 0 && products.some((p) => p.name.trim());

  async function handleSubmit() {
    setSubmitting(true);
    await submitBrief({
      company_name: brand.company_name,
      website: brand.website || null,
      contact_name: brand.contact_name,
      contact_email: brand.contact_email,
      phone: brand.phone || null,
      country: brand.country || null,
      industry: brand.industry || null,
      brand_stage: brand.brand_stage || null,
      manufactured_before: brand.manufactured_before === "yes" ? true : brand.manufactured_before === "no" ? false : null,
      how_found_us: brand.how_found_us || null,
      estimated_budget: refs.estimated_budget || null,
      timeline: refs.timeline || null,
      moodboard_links: refs.moodboard_links || null,
      sustainability_requirements: refs.sustainability_requirements || null,
      message: refs.message || null,
      brief_products: products.filter((p) => p.name.trim()),
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-6" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-6 text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle size={32} strokeWidth={1.5} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-[24px] font-semibold text-[#1D1D1F]">Brief received</h2>
            <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed">
              Thank you, {brand.contact_name.split(" ")[0]}. We'll review your brief and be in touch within 2 business days.
            </p>
          </div>
          <p className="text-[12px] text-[#AEAEB2]">You can close this window.</p>
        </motion.div>
      </div>
    );
  }

  const STEP_LABELS = ["Your brand", "Products", "References", "Review"];

  return (
    <div className="min-h-screen bg-[#F5F5F7]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" }}>
      <header className="flex items-center gap-2.5 px-8 py-5 border-b border-black/[0.08] bg-white sticky top-0 z-10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1A2E] text-white text-[13px] font-bold">K</div>
        <span className="text-[15px] font-semibold text-[#1D1D1F]">Source[Archive]</span>
        <span className="ml-auto text-[12px] text-[#AEAEB2]">Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <StepIndicator step={step} total={TOTAL_STEPS} />

        <AnimatePresence mode="wait">
          {/* ── Step 1: Brand ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">Tell us about your brand</h1>
              <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed mb-8">We'll use this to understand who you are before we talk.</p>

              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Brand / company name *</label>
                    <input className={inputCls} placeholder="Acme Studio" value={brand.company_name} onChange={(e) => setBrandField("company_name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Website</label>
                    <input type="url" className={inputCls} placeholder="https://yourbrand.com" value={brand.website} onChange={(e) => setBrandField("website", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Your name *</label>
                    <input className={inputCls} placeholder="Jane Smith" value={brand.contact_name} onChange={(e) => setBrandField("contact_name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input type="email" className={inputCls} placeholder="jane@yourbrand.com" value={brand.contact_email} onChange={(e) => setBrandField("contact_email", e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input type="tel" className={inputCls} placeholder="+44 7700 900000" value={brand.phone} onChange={(e) => setBrandField("phone", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Country</label>
                    <input className={inputCls} placeholder="United Kingdom" value={brand.country} onChange={(e) => setBrandField("country", e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Category / industry</label>
                  <select className={selectCls} value={brand.industry} onChange={(e) => setBrandField("industry", e.target.value)}>
                    <option value="">Select…</option>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Where is your brand right now?</label>
                  <ToggleGroup
                    value={brand.brand_stage}
                    onChange={(v) => setBrandField("brand_stage", v)}
                    options={[
                      { value: "startup", label: "Just starting out" },
                      { value: "growing", label: "Growing brand" },
                      { value: "established", label: "Established" },
                    ]}
                  />
                </div>

                <div>
                  <label className={labelCls}>Have you manufactured with a factory before?</label>
                  <ToggleGroup
                    value={brand.manufactured_before}
                    onChange={(v) => setBrandField("manufactured_before", v)}
                    options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No, this is our first time" }]}
                  />
                </div>

                <div>
                  <label className={labelCls}>How did you find us?</label>
                  <select className={selectCls} value={brand.how_found_us} onChange={(e) => setBrandField("how_found_us", e.target.value)}>
                    <option value="">Select…</option>
                    {HOW_FOUND.map((h) => <option key={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Products ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">What are you looking to make?</h1>
              <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed mb-8">Add each product individually — the more detail the better.</p>

              <div className="flex flex-col gap-3">
                {products.map((p, i) => (
                  <ProductForm key={i} index={i} product={p} onChange={(updated) => updateProduct(i, updated)} onRemove={() => removeProduct(i)} />
                ))}
              </div>

              <button
                type="button"
                onClick={addProduct}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D1D1D6] py-4 text-[14px] font-medium text-[#6E6E73] hover:border-[#1A1A2E] hover:text-[#1A1A2E] transition-colors"
              >
                <Plus size={16} /> Add another product
              </button>
            </motion.div>
          )}

          {/* ── Step 3: References ── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">Budget & references</h1>
              <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed mb-8">Help us understand your project scope and share any inspiration.</p>

              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Overall project budget</label>
                    <select className={selectCls} value={refs.estimated_budget} onChange={(e) => setRefsField("estimated_budget", e.target.value)}>
                      <option value="">Select range…</option>
                      <option>Under £5,000</option>
                      <option>£5,000 – £15,000</option>
                      <option>£15,000 – £30,000</option>
                      <option>£30,000 – £75,000</option>
                      <option>£75,000 – £150,000</option>
                      <option>£150,000+</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Target launch / delivery date</label>
                    <input className={inputCls} placeholder="e.g. SS26, August 2026" value={refs.timeline} onChange={(e) => setRefsField("timeline", e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Moodboard & reference links</label>
                  <textarea rows={4} className={`${inputCls} resize-none`} placeholder={"https://pinterest.com/yourboard\nhttps://drive.google.com/…\nhttps://notion.so/…\n\nOne link per line"} value={refs.moodboard_links} onChange={(e) => setRefsField("moodboard_links", e.target.value)} />
                  <p className="mt-1 text-[11px] text-[#AEAEB2]">Paste links to Pinterest boards, Google Drive folders, Notion docs, Dropbox, or anything else. One per line.</p>
                </div>

                <div>
                  <label className={labelCls}>Sustainability & ethical requirements</label>
                  <input className={inputCls} placeholder="e.g. GOTS certified, recycled materials, no animal products" value={refs.sustainability_requirements} onChange={(e) => setRefsField("sustainability_requirements", e.target.value)} />
                </div>

                <div>
                  <label className={labelCls}>Anything else we should know?</label>
                  <textarea rows={4} className={`${inputCls} resize-none`} placeholder="Timeline constraints, existing supplier relationships, specific quality requirements…" value={refs.message} onChange={(e) => setRefsField("message", e.target.value)} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-tight">Review & submit</h1>
              <p className="mt-2 text-[15px] text-[#6E6E73] leading-relaxed mb-8">Check everything looks right before sending.</p>

              <div className="flex flex-col gap-4">
                {/* Brand summary */}
                <div className="rounded-2xl bg-white border border-[#E5E5EA] p-5">
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-[#AEAEB2] mb-3">Brand</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                    {[
                      ["Company", brand.company_name],
                      ["Contact", brand.contact_name],
                      ["Email", brand.contact_email],
                      ["Phone", brand.phone],
                      ["Country", brand.country],
                      ["Website", brand.website],
                      ["Industry", brand.industry],
                      ["Stage", brand.brand_stage],
                      ["Manufactured before", brand.manufactured_before],
                      ["How found us", brand.how_found_us],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[#AEAEB2]">{k}: </span>
                        <span className="text-[#1D1D1F] font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Products summary */}
                <div className="rounded-2xl bg-white border border-[#E5E5EA] p-5">
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-[#AEAEB2] mb-3">Products ({products.filter((p) => p.name).length})</p>
                  <div className="flex flex-col gap-3">
                    {products.filter((p) => p.name).map((p, i) => (
                      <div key={i} className="flex items-start justify-between py-2 border-b border-[#F2F2F7] last:border-0">
                        <div>
                          <p className="text-[13px] font-semibold text-[#1D1D1F]">{p.name}</p>
                          <p className="text-[11px] text-[#6E6E73] mt-0.5">
                            {[p.category, p.target_qty ? `${p.target_qty.toLocaleString()} units` : null, p.target_price_usd ? `$${p.target_price_usd}/unit` : null, p.colorways ? `${p.colorways} colourways` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button type="button" onClick={() => setStep(2)} className="text-[11px] text-[#6E6E73] hover:text-[#1A1A2E] underline">Edit</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* References summary */}
                {(refs.estimated_budget || refs.timeline || refs.moodboard_links) && (
                  <div className="rounded-2xl bg-white border border-[#E5E5EA] p-5">
                    <p className="text-[11px] uppercase tracking-widest font-semibold text-[#AEAEB2] mb-3">References & budget</p>
                    <div className="flex flex-col gap-1.5 text-[13px]">
                      {refs.estimated_budget && <p><span className="text-[#AEAEB2]">Budget: </span><span className="font-medium text-[#1D1D1F]">{refs.estimated_budget}</span></p>}
                      {refs.timeline && <p><span className="text-[#AEAEB2]">Timeline: </span><span className="font-medium text-[#1D1D1F]">{refs.timeline}</span></p>}
                      {refs.moodboard_links && (
                        <div>
                          <p className="text-[#AEAEB2] mb-1">Reference links:</p>
                          {refs.moodboard_links.split("\n").filter(Boolean).map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#1A1A2E] hover:underline text-[12px]">
                              <ExternalLink size={10} /> {link}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium text-[#3A3A3C] border border-[#D1D1D6] bg-white hover:bg-[#F5F5F7] transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
          ) : <div />}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={step === 1 ? !canNext1 : step === 2 ? !canNext2 : false}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[14px] font-semibold text-white bg-[#1A1A2E] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-[14px] font-semibold text-white bg-[#1A1A2E] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Submitting…" : "Submit brief"}
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-[#AEAEB2] mt-6">
          We'll respond within 2 business days. Your information is kept confidential.
        </p>
      </main>
    </div>
  );
}
