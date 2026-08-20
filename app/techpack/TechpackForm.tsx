"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Plus, X, ChevronRight, ChevronLeft, Upload, Link } from "lucide-react";
import { submitTechpack } from "./actions";
import { uploadFile } from "@/lib/storage";

// ── Constants ────────────────────────────────────────

const CATEGORIES = ["T-shirt", "Hoodie", "Sweatshirt", "Jacket", "Trousers", "Shorts", "Dress", "Skirt", "Knitwear", "Headwear", "Bag", "Jewellery", "Swimwear", "Activewear", "Other"];
const AESTHETICS = ["Premium", "Vintage", "Sporty", "Technical", "Luxury", "Streetwear", "Minimalist", "Avant-garde", "Workwear", "Coastal"];
const FIT_TYPES = ["Oversized", "Boxy", "Cropped", "Slim", "Relaxed", "Regular", "Tailored"];
const FABRICS = ["100% Cotton", "Poly blend", "Nylon", "Denim", "Linen", "Wool", "Fleece", "French terry", "Mesh", "Satin", "Unknown"];
const PRINT_TYPES = ["Screen print", "Puff print", "DTG", "Embroidery", "Appliqué", "Heat transfer", "Woven patch", "None", "Unknown"];
const PLACEMENTS = ["Front chest", "Back", "Sleeve", "Hood", "Hem", "All-over", "Inside label", "Multiple"];
const WASH_TYPES = ["Vintage wash", "Acid wash", "Enzyme wash", "Silicone wash", "Garment dye", "Stone wash", "None"];
const HARDWARE_FINISHES = ["Silver", "Gold", "Matte black", "Aged brass", "Antique", "None"];
const NECK_LABELS = ["Printed", "Woven", "Heat transfer", "None"];
const EXTRA_LABELS = ["Hem tag", "Side seam label", "Woven care label", "Hang tag", "Pocket bag label"];
const PACKAGING_OPTS = ["Basic poly bag", "Custom mailer box", "Branded tissue + sticker", "Premium gift box", "No preference"];
const SAMPLING_BUDGETS = ["Under £500", "£500–£1,000", "£1,000–£2,500", "£2,500–£5,000", "£5,000+", "Not sure yet"];
const UNIT_COSTS = ["Under $5", "$5–$10", "$10–$20", "$20–$40", "$40–$80", "$80+", "Not sure yet"];

// ── Styles ────────────────────────────────────────

const inputCls = "w-full rounded-xl border border-[#D1D1D6] bg-white px-4 py-3 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#1A1A2E] transition-colors";
const labelCls = "block text-[12px] font-semibold text-[#6E6E73] mb-1.5 uppercase tracking-wide";
const sectionTitle = "text-[13px] font-semibold text-[#1D1D1F] uppercase tracking-widest border-b border-[#F2F2F7] pb-2 mb-4";

// ── Reusable sub-components ────────────────────────────────────────

function MultiChips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className="rounded-full px-4 py-2 text-[13px] font-medium border transition-colors"
          style={value.includes(o) ? { background: "#1A1A2E", color: "#fff", borderColor: "#1A1A2E" } : { background: "#fff", color: "#3A3A3C", borderColor: "#D1D1D6" }}
        >{o}</button>
      ))}
    </div>
  );
}

function SingleChips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(value === o ? "" : o)}
          className="rounded-full px-4 py-2 text-[13px] font-medium border transition-colors"
          style={value === o ? { background: "#1A1A2E", color: "#fff", borderColor: "#1A1A2E" } : { background: "#fff", color: "#3A3A3C", borderColor: "#D1D1D6" }}
        >{o}</button>
      ))}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-3">
      {([{ label: "Yes", v: true }, { label: "No", v: false }] as const).map(({ label, v }) => (
        <button key={label} type="button" onClick={() => onChange(v)}
          className="flex-1 rounded-xl py-3 text-[14px] font-medium border transition-colors"
          style={value === v ? { background: "#1A1A2E", color: "#fff", borderColor: "#1A1A2E" } : { background: "#fff", color: "#3A3A3C", borderColor: "#D1D1D6" }}
        >{label}</button>
      ))}
    </div>
  );
}

function FileUploadList({
  label, hint, values, onChange,
}: {
  label: string; hint?: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const isImage = (u: string) => /\.(jpe?g|png|webp|gif|avif|svg)(\?|$)/i.test(u);
  const isPdf   = (u: string) => /\.pdf(\?|$)/i.test(u);
  const shortName = (u: string) => {
    try { return decodeURIComponent(u.split("/").pop()?.split("?")[0] ?? u).slice(0, 32); }
    catch { return u.slice(0, 32); }
  };

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    const newUrls: string[] = [];
    for (const file of files) {
      // Direct browser -> storage. Routing the file through a Server Action
      // capped it at 1MB, so any real tech pack PDF failed silently.
      const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "-");
      const path = `techpacks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const { url, error } = await uploadFile("product-media", path, file);
      if (url) newUrls.push(url);
      else if (error) setUploadError(error);
    }
    onChange([...values, ...newUrls]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    const u = urlInput.trim();
    if (!u) return;
    onChange([...values, u]);
    setUrlInput("");
    setShowUrl(false);
  }

  function remove(i: number) { onChange(values.filter((_, j) => j !== i)); }

  return (
    <div>
      <label className={labelCls}>{label}</label>
      {hint && <p className="text-[12px] text-[#AEAEB2] mb-2">{hint}</p>}

      {/* Preview grid */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {values.map((url, i) => (
            <div key={i} className="group relative">
              {isImage(url) ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#D1D1D6] bg-[#F5F5F7]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => remove(i)}
                    className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-[10px]"
                  >✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-xl border border-[#D1D1D6] bg-white pl-2.5 pr-1.5 py-1.5 text-[11px] max-w-[180px]">
                  <span className="text-[14px] shrink-0">{isPdf(url) ? "📄" : "🔗"}</span>
                  <span className="truncate text-[#3A3A3C] flex-1">{shortName(url)}</span>
                  <button type="button" onClick={() => remove(i)} className="text-[#AEAEB2] hover:text-red-500 shrink-0">
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-xl border border-dashed border-[#D1D1D6] px-4 py-2.5 text-[13px] text-[#6E6E73] hover:border-[#1A1A2E] hover:text-[#1A1A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={14} strokeWidth={1.8} />
          {uploading ? "Uploading…" : "Upload photos or PDF"}
        </button>
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-[#D1D1D6] px-4 py-2.5 text-[13px] text-[#6E6E73] hover:border-[#1A1A2E] hover:text-[#1A1A2E] transition-colors"
        >
          <Link size={14} strokeWidth={1.8} /> Paste a link
        </button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFiles} />
      </div>
      {uploadError && (
        <p className="mt-2 text-[12px] text-red-500">Upload failed: {uploadError}</p>
      )}

      {/* URL input */}
      {showUrl && (
        <div className="flex gap-2 mt-2">
          <input
            autoFocus
            type="url"
            placeholder="https://…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
            className={inputCls}
          />
          <button type="button" onClick={addUrl}
            className="shrink-0 rounded-xl border border-[#D1D1D6] px-4 text-[13px] text-[#3A3A3C] hover:bg-[#F5F5F7] transition-colors"
          >Add</button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full transition-colors"
          style={{ background: i < step ? "#1A1A2E" : i === step ? "#1A1A2E66" : "#E5E5EA" }}
        />
      ))}
      <span className="text-[11px] text-[#AEAEB2] ml-1 shrink-0">{step + 1}/{total}</span>
    </div>
  );
}

// ── Initial state ────────────────────────────────────────

const INITIAL = {
  // Step 1: Project Overview
  product_category: "",
  collection_name: "",
  launch_date: "",
  target_quantity: "",
  retail_price_point: "",
  // Step 2: Creative Direction
  product_description: "",
  aesthetic_feeling: [] as string[],
  reference_urls: [""],
  competitor_urls: [""],
  // Step 3: Construction
  fit_type: [] as string[],
  measurements_known: null as boolean | null,
  measurements_notes: "",
  fabric_preference: [] as string[],
  fabric_gsm: "",
  suggest_fabric: false,
  // Step 4: Surface & Details
  print_type: [] as string[],
  print_placement: [] as string[],
  artwork_urls: [""],
  wash_type: [] as string[],
  wash_effect: "",
  zip_type: "",
  button_type: "",
  drawstring_type: "",
  hardware_finish: "",
  neck_label: "",
  additional_labels: [] as string[],
  packaging: "",
  // Step 5: Technical Complexity
  custom_pattern: null as boolean | null,
  multiple_panels: null as boolean | null,
  special_construction: null as boolean | null,
  custom_hardware: null as boolean | null,
  // Step 6: Budget & Expectations
  sampling_budget: "",
  target_unit_cost: "",
  quality_priority: "",
  // Step 7: Contact & Agreement
  contact_name: "",
  company_name: "",
  contact_email: "",
  phone: "",
  understands_revisions: false,
  produced_before: null as boolean | null,
  ready_for_sampling: null as boolean | null,
  deposit_agreed: false,
};

type Form = typeof INITIAL;

const TOTAL_STEPS = 7;

// ── Step validation ────────────────────────────────────────

function validate(step: number, form: Form): string | null {
  if (step === 0 && !form.product_category) return "Please select a product category.";
  if (step === 1 && !form.product_description) return "Please add a brief product description.";
  if (step === 6) {
    if (!form.contact_name) return "Please enter your name.";
    if (!form.company_name) return "Please enter your brand name.";
    if (!form.contact_email) return "Please enter your email.";
    if (!form.understands_revisions) return "Please confirm you understand the revision policy.";
    if (!form.deposit_agreed) return "Please confirm the deposit agreement.";
  }
  return null;
}

// ── Main component ────────────────────────────────────────

export function TechpackForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(INITIAL);

  useEffect(() => {
    const prev = { htmlOverflow: document.documentElement.style.overflow, bodyOverflow: document.body.style.overflow };
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = prev.htmlOverflow;
      document.body.style.overflow = prev.bodyOverflow;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [direction, setDirection] = useState(1);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));
  const setStr = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    set(k, e.target.value as any);

  function next() {
    const err = validate(step, form);
    if (err) { setError(err); return; }
    setError(null);
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setError(null);
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(step, form);
    if (err) { setError(err); return; }
    setSaving(true);
    await submitTechpack({
      contact_name: form.contact_name,
      company_name: form.company_name,
      contact_email: form.contact_email,
      phone: form.phone || null,
      product_category: form.product_category,
      collection_name: form.collection_name || null,
      launch_date: form.launch_date || null,
      target_quantity: form.target_quantity ? parseInt(form.target_quantity, 10) : null,
      retail_price_point: form.retail_price_point || null,
      product_description: form.product_description || null,
      aesthetic_feeling: form.aesthetic_feeling,
      reference_urls: form.reference_urls.filter(Boolean),
      competitor_urls: form.competitor_urls.filter(Boolean),
      fit_type: form.fit_type,
      measurements_known: form.measurements_known,
      measurements_notes: form.measurements_notes || null,
      fabric_preference: form.fabric_preference,
      fabric_gsm: form.fabric_gsm || null,
      suggest_fabric: form.suggest_fabric,
      print_type: form.print_type,
      print_placement: form.print_placement,
      artwork_urls: form.artwork_urls.filter(Boolean),
      wash_type: form.wash_type,
      wash_effect: form.wash_effect || null,
      zip_type: form.zip_type || null,
      button_type: form.button_type || null,
      drawstring_type: form.drawstring_type || null,
      hardware_finish: form.hardware_finish || null,
      neck_label: form.neck_label || null,
      additional_labels: form.additional_labels,
      packaging: form.packaging || null,
      custom_pattern: form.custom_pattern ?? false,
      multiple_panels: form.multiple_panels ?? false,
      special_construction: form.special_construction ?? false,
      custom_hardware: form.custom_hardware ?? false,
      sampling_budget: form.sampling_budget || null,
      target_unit_cost: form.target_unit_cost || null,
      quality_priority: form.quality_priority || null,
      understands_revisions: form.understands_revisions,
      produced_before: form.produced_before,
      ready_for_sampling: form.ready_for_sampling,
      deposit_agreed: form.deposit_agreed,
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
          <h1 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">Tech pack request received.</h1>
          <p className="text-[14px] text-[#6E6E73] leading-relaxed">
            We'll review your brief and get back to you within 1–2 business days to confirm the next steps.
          </p>
        </div>
      </div>
    );
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 32 : -32 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -32 : 32 }),
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A2E] text-white text-[16px] font-bold mb-4">S</div>
          <h1 className="text-[26px] font-semibold text-[#1D1D1F] tracking-tight">Tech Pack Request</h1>
          <p className="mt-1.5 text-[14px] text-[#6E6E73]">Fill in the details below so we can build an accurate brief for your designer.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-3xl shadow-sm border border-[#E5E5EA] px-8 py-8 overflow-hidden">
            <StepIndicator step={step} total={TOTAL_STEPS} />

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
              >

                {/* ── Step 1: Project Overview ── */}
                {step === 0 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Project overview</h2>
                      <p className="text-[13px] text-[#6E6E73]">Start with the basics — what are we making?</p>
                    </div>
                    <div>
                      <label className={labelCls}>Product category *</label>
                      <SingleChips options={CATEGORIES} value={form.product_category} onChange={(v) => set("product_category", v)} />
                    </div>
                    <div>
                      <label className={labelCls}>Collection / Project name</label>
                      <input className={inputCls} placeholder="e.g. SS26 Capsule" value={form.collection_name} onChange={setStr("collection_name")} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Intended launch date</label>
                        <input type="date" className={inputCls} value={form.launch_date} onChange={setStr("launch_date")} />
                      </div>
                      <div>
                        <label className={labelCls}>Target quantity</label>
                        <input type="number" min="1" className={inputCls} placeholder="e.g. 200" value={form.target_quantity} onChange={setStr("target_quantity")} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Target retail price point</label>
                      <input className={inputCls} placeholder="e.g. £120–£150" value={form.retail_price_point} onChange={setStr("retail_price_point")} />
                      <p className="text-[11px] text-[#AEAEB2] mt-1.5">Forces you to think commercially — we use this to calibrate the brief.</p>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Creative Direction ── */}
                {step === 1 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Creative direction</h2>
                      <p className="text-[13px] text-[#6E6E73]">Help us see what you see.</p>
                    </div>
                    <div>
                      <label className={labelCls}>Describe the product in 1–3 sentences *</label>
                      <textarea
                        required
                        rows={3}
                        maxLength={300}
                        className={inputCls}
                        placeholder="e.g. A heavyweight oversized hoodie with a dropped shoulder, raglan sleeve and a boxy hem. Inspired by 90s collegiate sportswear."
                        value={form.product_description}
                        onChange={setStr("product_description")}
                      />
                      <p className="text-[11px] text-[#AEAEB2] mt-1">{form.product_description.length}/300</p>
                    </div>
                    <div>
                      <label className={labelCls}>What is the feeling of the product?</label>
                      <p className="text-[12px] text-[#AEAEB2] mb-2">Select all that apply.</p>
                      <MultiChips options={AESTHETICS} value={form.aesthetic_feeling} onChange={(v) => set("aesthetic_feeling", v)} />
                    </div>
                    <FileUploadList
                      label="Reference images / moodboard"
                      hint="Upload photos, PDFs, or paste links (Google Drive, Dropbox, Pinterest, Figma)."
                      values={form.reference_urls}
                      onChange={(v) => set("reference_urls", v)}
                    />
                    <FileUploadList
                      label="Competitor / inspiration products"
                      hint="Upload images or paste links to existing products you want to reference."
                      values={form.competitor_urls}
                      onChange={(v) => set("competitor_urls", v)}
                    />
                  </div>
                )}

                {/* ── Step 3: Garment Construction ── */}
                {step === 2 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Garment construction</h2>
                      <p className="text-[13px] text-[#6E6E73]">This is where most briefs fall short — be as specific as you can.</p>
                    </div>
                    <div>
                      <label className={labelCls}>Fit type</label>
                      <p className="text-[12px] text-[#AEAEB2] mb-2">Select all that apply.</p>
                      <MultiChips options={FIT_TYPES} value={form.fit_type} onChange={(v) => set("fit_type", v)} />
                    </div>
                    <div>
                      <label className={labelCls}>Do you have key measurements?</label>
                      <YesNo value={form.measurements_known} onChange={(v) => set("measurements_known", v)} />
                      {form.measurements_known && (
                        <textarea
                          rows={3}
                          className={`${inputCls} mt-3`}
                          placeholder="e.g. Chest: 60cm, Length: 75cm, Sleeve: 65cm. Or describe your sizing approach."
                          value={form.measurements_notes}
                          onChange={setStr("measurements_notes")}
                        />
                      )}
                      {form.measurements_known === false && (
                        <p className="text-[12px] text-[#6E6E73] mt-2 bg-[#F5F5F7] rounded-xl px-4 py-3">
                          No problem — we'll define measurements together as part of the tech pack process.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Fabric preference</label>
                      <p className="text-[12px] text-[#AEAEB2] mb-2">Select all that apply.</p>
                      <MultiChips options={FABRICS} value={form.fabric_preference} onChange={(v) => set("fabric_preference", v)} />
                      <div className="flex items-center gap-2.5 mt-3">
                        <input
                          type="checkbox"
                          id="suggest_fabric"
                          checked={form.suggest_fabric}
                          onChange={(e) => set("suggest_fabric", e.target.checked)}
                          className="h-4 w-4 rounded accent-[#1A1A2E]"
                        />
                        <label htmlFor="suggest_fabric" className="text-[13px] text-[#3A3A3C]">Suggest an appropriate fabric for me</label>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Fabric weight (GSM)</label>
                      <input className={inputCls} placeholder="e.g. 400 GSM — or leave blank if unsure" value={form.fabric_gsm} onChange={setStr("fabric_gsm")} />
                    </div>
                  </div>
                )}

                {/* ── Step 4: Surface & Details ── */}
                {step === 3 && (
                  <div className="flex flex-col gap-7">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Surface & details</h2>
                      <p className="text-[13px] text-[#6E6E73]">This is where you differentiate. Be specific.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>Prints & Graphics</p>
                      <div>
                        <label className={labelCls}>Print type</label>
                        <MultiChips options={PRINT_TYPES} value={form.print_type} onChange={(v) => set("print_type", v)} />
                      </div>
                      {!form.print_type.includes("None") && (
                        <>
                          <div>
                            <label className={labelCls}>Placement(s)</label>
                            <MultiChips options={PLACEMENTS} value={form.print_placement} onChange={(v) => set("print_placement", v)} />
                          </div>
                          <FileUploadList
                            label="Artwork / graphic files"
                            hint="Upload files or paste links (Google Drive, Dropbox, WeTransfer, etc.)"
                            values={form.artwork_urls}
                            onChange={(v) => set("artwork_urls", v)}
                          />
                        </>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>Washes & Finishes</p>
                      <div>
                        <label className={labelCls}>Wash type</label>
                        <MultiChips options={WASH_TYPES} value={form.wash_type} onChange={(v) => set("wash_type", v)} />
                      </div>
                      {form.wash_type.length > 0 && !form.wash_type.includes("None") && (
                        <div>
                          <label className={labelCls}>Desired effect</label>
                          <input className={inputCls} placeholder="e.g. Faded indigo with cracked texture, soft hand feel" value={form.wash_effect} onChange={setStr("wash_effect")} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>Trims & Hardware</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Zips</label>
                          <SingleChips options={["YKK", "Metal", "Plastic", "None"]} value={form.zip_type} onChange={(v) => set("zip_type", v)} />
                        </div>
                        <div>
                          <label className={labelCls}>Buttons</label>
                          <SingleChips options={["Snap", "Branded", "Custom", "None"]} value={form.button_type} onChange={(v) => set("button_type", v)} />
                        </div>
                        <div>
                          <label className={labelCls}>Drawstrings</label>
                          <SingleChips options={["Flat", "Round", "Custom tips", "None"]} value={form.drawstring_type} onChange={(v) => set("drawstring_type", v)} />
                        </div>
                        <div>
                          <label className={labelCls}>Hardware finish</label>
                          <SingleChips options={HARDWARE_FINISHES} value={form.hardware_finish} onChange={(v) => set("hardware_finish", v)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>Labels & Branding</p>
                      <div>
                        <label className={labelCls}>Neck label</label>
                        <SingleChips options={NECK_LABELS} value={form.neck_label} onChange={(v) => set("neck_label", v)} />
                      </div>
                      <div>
                        <label className={labelCls}>Additional labels</label>
                        <MultiChips options={EXTRA_LABELS} value={form.additional_labels} onChange={(v) => set("additional_labels", v)} />
                      </div>
                      <div>
                        <label className={labelCls}>Packaging</label>
                        <SingleChips options={PACKAGING_OPTS} value={form.packaging} onChange={(v) => set("packaging", v)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Step 5: Technical Complexity ── */}
                {step === 4 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Technical complexity</h2>
                      <p className="text-[13px] text-[#6E6E73]">Your answers help us scope the brief accurately and price fairly.</p>
                    </div>
                    {([
                      { key: "custom_pattern" as const, label: "Does this product require a custom pattern?", hint: "As opposed to a standard/block pattern." },
                      { key: "multiple_panels" as const, label: "Does it involve multiple panels or complex seaming?", hint: "e.g. 6-panel construction, yoke seams, panelled sleeves." },
                      { key: "special_construction" as const, label: "Any special construction techniques?", hint: "e.g. flatlock stitching, bonded seams, double-needle detailing." },
                      { key: "custom_hardware" as const, label: "Unique trims or custom hardware?", hint: "e.g. branded zippers, custom aglets, proprietary buckles." },
                    ]).map(({ key, label, hint }) => (
                      <div key={key} className="flex flex-col gap-2">
                        <label className={labelCls}>{label}</label>
                        {hint && <p className="text-[12px] text-[#AEAEB2] -mt-1">{hint}</p>}
                        <YesNo value={form[key]} onChange={(v) => set(key, v)} />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Step 6: Budget & Expectations ── */}
                {step === 5 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Budget & expectations</h2>
                      <p className="text-[13px] text-[#6E6E73]">Honest answers mean better decisions for everyone.</p>
                    </div>
                    <div>
                      <label className={labelCls}>Sampling budget</label>
                      <SingleChips options={SAMPLING_BUDGETS} value={form.sampling_budget} onChange={(v) => set("sampling_budget", v)} />
                    </div>
                    <div>
                      <label className={labelCls}>Target cost per unit (production)</label>
                      <SingleChips options={UNIT_COSTS} value={form.target_unit_cost} onChange={(v) => set("target_unit_cost", v)} />
                    </div>
                    <div>
                      <label className={labelCls}>What matters most to you?</label>
                      <SingleChips
                        options={["Premium quality — cost follows", "Balanced cost / quality", "Cost-first — quality can flex"]}
                        value={form.quality_priority}
                        onChange={(v) => set("quality_priority", v)}
                      />
                    </div>
                  </div>
                )}

                {/* ── Step 7: Contact & Agreement ── */}
                {step === 6 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-[20px] font-semibold text-[#1D1D1F] mb-1">Almost done</h2>
                      <p className="text-[13px] text-[#6E6E73]">Your details + a few quick confirmations.</p>
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>Contact</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Your name *</label>
                          <input required className={inputCls} placeholder="Jane Smith" value={form.contact_name} onChange={setStr("contact_name")} />
                        </div>
                        <div>
                          <label className={labelCls}>Brand name *</label>
                          <input required className={inputCls} placeholder="Acme Studio" value={form.company_name} onChange={setStr("company_name")} />
                        </div>
                        <div>
                          <label className={labelCls}>Email *</label>
                          <input required type="email" className={inputCls} placeholder="jane@brand.com" value={form.contact_email} onChange={setStr("contact_email")} />
                        </div>
                        <div>
                          <label className={labelCls}>Phone</label>
                          <input className={inputCls} placeholder="+44 7700…" value={form.phone} onChange={setStr("phone")} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>A bit about you</p>
                      <div>
                        <label className={labelCls}>Have you produced garments before?</label>
                        <YesNo value={form.produced_before} onChange={(v) => set("produced_before", v)} />
                      </div>
                      <div>
                        <label className={labelCls}>Are you ready to move to sampling after the tech pack?</label>
                        <YesNo value={form.ready_for_sampling} onChange={(v) => set("ready_for_sampling", v)} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <p className={sectionTitle}>Workflow agreement</p>
                      <div className="rounded-2xl bg-[#F5F5F7] px-5 py-4 flex flex-col gap-4 text-[13px] text-[#3A3A3C]">
                        {([
                          {
                            key: "understands_revisions" as const,
                            label: "I understand that 1 revision round is included. Additional revisions are charged separately.",
                          },
                          {
                            key: "deposit_agreed" as const,
                            label: "I understand that a deposit is required to confirm the project and begin work.",
                          },
                        ]).map(({ key, label }) => (
                          <label key={key} className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form[key] as boolean}
                              onChange={(e) => set(key, e.target.checked as any)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#1A1A2E]"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Error */}
            {error && (
              <p className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {step > 0 && (
                <button type="button" onClick={back}
                  className="flex items-center gap-1.5 rounded-xl border border-[#D1D1D6] px-5 py-3 text-[14px] text-[#3A3A3C] hover:bg-[#F5F5F7] transition-colors"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              {step < TOTAL_STEPS - 1 ? (
                <button type="button" onClick={next}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-[14px] font-semibold text-white transition-opacity"
                  style={{ background: "#1A1A2E" }}
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={saving}
                  className="flex-1 rounded-xl py-3 text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ background: "#1A1A2E" }}
                >
                  {saving ? "Submitting…" : "Submit tech pack request"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
