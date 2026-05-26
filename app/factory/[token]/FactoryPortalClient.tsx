"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, CheckCircle, Upload, FileText, X, AlertCircle } from "lucide-react";
import { submitQuote } from "./actions";
import { uploadFile } from "@/lib/storage";
import type { Rfq, RfqInvite, RfqSubmission, RfqTier } from "@/lib/data";

const inputCls = "w-full rounded-xl border border-[#D1D1D6] bg-white px-3.5 py-2.5 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#1A1A2E] transition-colors";

function BiLabel({ en, zh }: { en: string; zh: string }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className="text-[12px] font-medium text-[#6E6E73] uppercase tracking-wide">{en}</span>
      <span className="text-[12px] text-[#AEAEB2]">{zh}</span>
    </div>
  );
}

interface Tier {
  moq: string;
  unit_price_usd: string;
  lead_time_days: string;
  sample_fee_usd: string;
  notes: string;
}

const EMPTY_TIER: Tier = { moq: "", unit_price_usd: "", lead_time_days: "", sample_fee_usd: "", notes: "" };

function TierRow({ tier, index, onChange, onRemove, canRemove }: {
  tier: Tier;
  index: number;
  onChange: (t: Tier) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const set = (k: keyof Tier, v: string) => onChange({ ...tier, [k]: v });

  return (
    <div className="rounded-xl border border-[#E5E5EA] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold text-[#1D1D1F]">
          Tier {index + 1} <span className="font-normal text-[#AEAEB2] ml-1">第{["一","二","三","四","五"][index] ?? index + 1}档</span>
        </p>
        {canRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded-lg text-[#AEAEB2] hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <BiLabel en="MOQ (units)" zh="最低起订量（件）" />
          <input type="number" min="1" className={inputCls} placeholder="e.g. 300" value={tier.moq} onChange={(e) => set("moq", e.target.value)} />
        </div>
        <div>
          <BiLabel en="Unit price (USD)" zh="单价（美元）" />
          <input type="number" min="0" step="0.01" className={inputCls} placeholder="e.g. 12.50" value={tier.unit_price_usd} onChange={(e) => set("unit_price_usd", e.target.value)} />
        </div>
        <div>
          <BiLabel en="Lead time (days)" zh="生产周期（天）" />
          <input type="number" min="0" className={inputCls} placeholder="e.g. 45" value={tier.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} />
        </div>
        <div>
          <BiLabel en="Sample fee (USD)" zh="打样费（美元）" />
          <input type="number" min="0" step="0.01" className={inputCls} placeholder="e.g. 80.00" value={tier.sample_fee_usd} onChange={(e) => set("sample_fee_usd", e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <BiLabel en="Notes for this tier" zh="备注" />
        <input className={inputCls} placeholder="e.g. Price includes labelling / 包含贴标" value={tier.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
    </div>
  );
}

function ImageUploadZone({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploading(true);
    const results = await Promise.all(
      Array.from(fileList).map(async (file) => {
        const path = `rfq/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const { url } = await uploadFile("rfq-media", path, file);
        return url;
      })
    );
    onChange([...urls, ...(results.filter(Boolean) as string[])]);
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer ${dragging ? "border-[#1A1A2E] bg-[#F0F0F8]" : "border-[#D1D1D6] bg-white hover:border-[#AEAEB2]"} p-5 text-center`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden" accept="image/*,application/pdf" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        <Upload size={20} className="mx-auto mb-2 text-[#AEAEB2]" />
        {uploading ? (
          <p className="text-[13px] text-[#6E6E73]">Uploading… / 上传中…</p>
        ) : (
          <>
            <p className="text-[13px] text-[#6E6E73]">Drop images or tech packs here</p>
            <p className="text-[12px] text-[#AEAEB2] mt-0.5">拖放图片或技术文件至此处，或点击浏览</p>
          </>
        )}
      </div>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => {
            const isImg = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);
            return (
              <div key={url} className="relative group">
                {isImg ? (
                  <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-[#E5E5EA]" />
                ) : (
                  <div className="h-16 w-16 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] flex flex-col items-center justify-center gap-1 px-1">
                    <FileText size={18} className="text-[#6E6E73]" />
                    <span className="text-[9px] text-[#AEAEB2] truncate max-w-[56px] text-center leading-tight">
                      {decodeURIComponent(url.split("/").pop() ?? "file").replace(/^\d+-/, "")}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(urls.filter((u) => u !== url)); }}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-white border border-[#D1D1D6] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-[#6E6E73] hover:text-red-500"
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  rfq: Rfq;
  invite: RfqInvite;
  factoryName: string;
  existingSubmission: (RfqSubmission & { tiers: RfqTier[] }) | null;
}

export function FactoryPortalClient({ rfq, invite, factoryName, existingSubmission }: Props) {
  const isClosed = rfq.status === "closed";
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(!existingSubmission);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState(existingSubmission?.notes ?? "");
  const [images, setImages] = useState<string[]>(existingSubmission?.images ?? []);
  const [tiers, setTiers] = useState<Tier[]>(
    existingSubmission?.tiers.length
      ? existingSubmission.tiers.map((t) => ({
          moq: String(t.moq),
          unit_price_usd: String(t.unit_price_usd),
          lead_time_days: t.lead_time_days != null ? String(t.lead_time_days) : "",
          sample_fee_usd: t.sample_fee_usd != null ? String(t.sample_fee_usd) : "",
          notes: t.notes ?? "",
        }))
      : [{ ...EMPTY_TIER }]
  );

  function addTier() { setTiers((prev) => [...prev, { ...EMPTY_TIER }]); }
  function removeTier(i: number) { setTiers((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateTier(i: number, t: Tier) { setTiers((prev) => prev.map((x, idx) => idx === i ? t : x)); }

  const canSubmit = tiers.some((t) => t.moq && t.unit_price_usd);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await submitQuote({
      invite_id: invite.id,
      factory_name: factoryName,
      notes,
      images,
      tiers: tiers
        .filter((t) => t.moq && t.unit_price_usd)
        .map((t) => ({
          moq: parseInt(t.moq),
          unit_price_usd: parseFloat(t.unit_price_usd),
          lead_time_days: t.lead_time_days ? parseInt(t.lead_time_days) : null,
          sample_fee_usd: t.sample_fee_usd ? parseFloat(t.sample_fee_usd) : null,
          notes: t.notes,
        })),
    });
    setSubmitting(false);
    if (!result.success) { setError(result.error ?? "Submission failed. / 提交失败。"); return; }
    setSubmitted(true);
  }

  const deadline = rfq.deadline
    ? new Date(rfq.deadline).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#F5F5F7]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center gap-2.5 px-6 py-4 border-b border-black/[0.08] bg-white sticky top-0 z-10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1A2E] text-white text-[13px] font-bold">K</div>
        <span className="text-[15px] font-semibold text-[#1D1D1F]">Source[Archive]</span>
        <span className="ml-auto text-right">
          <span className="block text-[11px] text-[#AEAEB2]">Factory Pricing Portal</span>
          <span className="block text-[11px] text-[#AEAEB2]">工厂报价门户</span>
        </span>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* RFQ brief */}
        <div className="rounded-2xl bg-white border border-[#E5E5EA] p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#AEAEB2]">Request for Quotation</span>
            <span className="text-[10px] text-[#AEAEB2]">·</span>
            <span className="text-[10px] text-[#AEAEB2]">询价单</span>
          </div>
          <h1 className="text-[22px] font-semibold text-[#1D1D1F] leading-snug mb-2">{rfq.title}</h1>
          {rfq.description && (
            <p className="text-[14px] text-[#3A3A3C] leading-relaxed whitespace-pre-wrap mb-4">{rfq.description}</p>
          )}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-[#F2F2F7]">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#AEAEB2]">Addressed to / 收件方</p>
              <p className="text-[13px] font-medium text-[#1D1D1F] mt-0.5">{factoryName}</p>
            </div>
            {deadline && (
              <div className="ml-auto text-right">
                <p className="text-[10px] uppercase tracking-wide text-[#AEAEB2]">Response deadline / 截止日期</p>
                <p className="text-[13px] font-medium text-[#1D1D1F] mt-0.5">{deadline}</p>
              </div>
            )}
          </div>
          {rfq.images?.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {rfq.images.map((url) => (
                <img key={url} src={url} alt="" className="rounded-lg w-full aspect-square object-cover border border-[#E5E5EA]" />
              ))}
            </div>
          )}
        </div>

        {/* Closed */}
        {isClosed && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center">
            <AlertCircle size={28} className="mx-auto mb-3 text-[#AEAEB2]" />
            <p className="text-[15px] font-semibold text-[#1D1D1F]">This RFQ is closed</p>
            <p className="text-[13px] text-[#6E6E73] mt-1">此询价单已关闭，不再接受报价。</p>
          </div>
        )}

        {/* Success */}
        {!isClosed && submitted && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-white border border-[#E5E5EA] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-4">
              <CheckCircle size={28} strokeWidth={1.5} className="text-emerald-500" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#1D1D1F]">Quote submitted</h2>
            <p className="text-[15px] text-[#6E6E73] mt-1">报价已提交</p>
            <p className="mt-3 text-[13px] text-[#6E6E73] leading-relaxed">
              Thank you. We've received your pricing and will be in touch soon.<br />
              <span className="text-[#AEAEB2]">感谢您的报价，我们已收到并将尽快与您联系。</span>
            </p>
            <button
              onClick={() => { setSubmitted(false); setShowForm(true); }}
              className="mt-5 text-[13px] text-[#6E6E73] underline hover:text-[#1D1D1F] transition-colors"
            >
              Update my submission / 修改报价
            </button>
          </motion.div>
        )}

        {/* Existing submission banner */}
        {!isClosed && !submitted && existingSubmission && !showForm && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-900">Quote already submitted / 已提交报价</p>
                <p className="text-[12px] text-emerald-700">
                  {new Date(existingSubmission.submitted_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="text-[12px] font-medium text-emerald-800 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition-colors"
            >
              Update / 修改
            </button>
          </div>
        )}

        {/* Submission form */}
        {!isClosed && showForm && !submitted && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1D1D1F]">
                {existingSubmission ? "Update your quote" : "Submit your pricing"}
              </h2>
              <p className="text-[13px] text-[#6E6E73] mt-0.5">
                {existingSubmission ? "修改您的报价" : "请填写报价信息"}
              </p>
            </div>

            {/* Tiers */}
            <div>
              <div className="mb-3">
                <p className="text-[13px] font-medium text-[#1D1D1F]">Pricing tiers / 价格档次</p>
                <p className="text-[12px] text-[#AEAEB2] mt-0.5">Add a tier for each quantity break / 请为每个起订量档次填写报价</p>
              </div>
              <div className="flex flex-col gap-3">
                {tiers.map((tier, i) => (
                  <TierRow key={i} index={i} tier={tier} onChange={(t) => updateTier(i, t)} onRemove={() => removeTier(i)} canRemove={tiers.length > 1} />
                ))}
              </div>
              <button
                type="button"
                onClick={addTier}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D1D1D6] py-3 text-[13px] font-medium text-[#6E6E73] hover:border-[#1A1A2E] hover:text-[#1A1A2E] transition-colors"
              >
                <Plus size={14} /> Add another tier / 添加价格档次
              </button>
            </div>

            {/* Attachments */}
            <div>
              <div className="mb-2">
                <p className="text-[12px] font-medium text-[#6E6E73] uppercase tracking-wide">Images &amp; attachments / 图片及附件</p>
                <p className="text-[11px] text-[#AEAEB2] mt-0.5">Upload product images, tech packs or spec sheets / 上传产品图片、技术文件或规格说明</p>
              </div>
              <ImageUploadZone urls={images} onChange={setImages} />
            </div>

            {/* Notes */}
            <div>
              <BiLabel en="Additional notes" zh="补充说明" />
              <textarea
                rows={4}
                className={`${inputCls} resize-none`}
                placeholder="Payment terms, certifications, exclusions… / 付款条件、认证信息、免责说明…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-[13px] text-red-700">{error}</p>
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-6 py-3.5 text-white bg-[#1A1A2E] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <span className="text-[14px] font-semibold">{submitting ? "Submitting…" : existingSubmission ? "Update quote" : "Submit quote"}</span>
              <span className="text-[12px] opacity-70">{submitting ? "提交中…" : existingSubmission ? "更新报价" : "提交报价"}</span>
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-[#AEAEB2] mt-8">
          This link is private to {factoryName}. Pricing is kept confidential.<br />
          此链接仅供 {factoryName} 使用，报价信息严格保密。
        </p>
      </main>
    </div>
  );
}
