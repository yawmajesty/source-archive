"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { submitQuote } from "./actions";
import type { Rfq, RfqInvite, RfqSubmission, RfqQuotedProduct } from "@/lib/data";

const inputCls = "w-full rounded-lg border border-[#D1D1D6] bg-white px-3 py-2 text-[14px] text-[#1D1D1F] placeholder:text-[#AEAEB2] outline-none focus:border-[#1A1A2E] transition-colors";

interface ProductRow {
  name: string;
  description: string;
  moq: string;
  unit_price_usd: string;
  sample_fee_usd: string;
  lead_time_days: string;
  notes: string;
}

const EMPTY_ROW: ProductRow = {
  name: "", description: "", moq: "", unit_price_usd: "",
  sample_fee_usd: "", lead_time_days: "", notes: "",
};

function ProductCard({ row, index, onChange, onRemove, canRemove }: {
  row: ProductRow;
  index: number;
  onChange: (r: ProductRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const set = (k: keyof ProductRow, v: string) => onChange({ ...row, [k]: v });

  return (
    <div className="rounded-xl border border-[#E5E5EA] bg-white overflow-hidden">
      {/* Row header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F5F5F7] border-b border-[#E5E5EA]">
        <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide">
          Product {index + 1} &nbsp;·&nbsp; 产品 {index + 1}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded text-[#AEAEB2] hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Product name */}
        <div>
          <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
            Product name * <span className="text-[#AEAEB2] font-normal">产品名称</span>
          </label>
          <input
            className={inputCls}
            placeholder="e.g. Oversized T-shirt / 宽松T恤"
            value={row.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
            Description / specs <span className="text-[#AEAEB2] font-normal">产品描述/规格</span>
          </label>
          <input
            className={inputCls}
            placeholder="Fabric, construction, finishing… / 面料、工艺、后处理…"
            value={row.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
              MOQ (units) <span className="text-[#AEAEB2] font-normal">最低起订量</span>
            </label>
            <input type="number" min="1" className={inputCls} placeholder="300"
              value={row.moq} onChange={(e) => set("moq", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
              Unit price (USD) <span className="text-[#AEAEB2] font-normal">单价（美元）</span>
            </label>
            <input type="number" min="0" step="0.01" className={inputCls} placeholder="12.50"
              value={row.unit_price_usd} onChange={(e) => set("unit_price_usd", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
              Sample fee (USD) <span className="text-[#AEAEB2] font-normal">打样费（美元）</span>
            </label>
            <input type="number" min="0" step="0.01" className={inputCls} placeholder="80.00"
              value={row.sample_fee_usd} onChange={(e) => set("sample_fee_usd", e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
              Lead time (days) <span className="text-[#AEAEB2] font-normal">生产周期（天）</span>
            </label>
            <input type="number" min="0" className={inputCls} placeholder="45"
              value={row.lead_time_days} onChange={(e) => set("lead_time_days", e.target.value)} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
            Notes <span className="text-[#AEAEB2] font-normal">备注</span>
          </label>
          <input className={inputCls}
            placeholder="Payment terms, certifications, exclusions… / 付款条件、认证、说明…"
            value={row.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

interface Props {
  rfq: Rfq;
  invite: RfqInvite;
  factoryName: string;
  existingSubmission: (RfqSubmission & { products: RfqQuotedProduct[] }) | null;
}

export function FactoryPortalClient({ rfq, invite, factoryName, existingSubmission }: Props) {
  const isClosed = rfq.status === "closed";
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(!existingSubmission);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(existingSubmission?.notes ?? "");

  const [rows, setRows] = useState<ProductRow[]>(() => {
    const existing = existingSubmission?.products;
    if (existing?.length) {
      return existing.map((p) => ({
        name: p.name,
        description: p.description ?? "",
        moq: p.moq != null ? String(p.moq) : "",
        unit_price_usd: p.unit_price_usd != null ? String(p.unit_price_usd) : "",
        sample_fee_usd: p.sample_fee_usd != null ? String(p.sample_fee_usd) : "",
        lead_time_days: p.lead_time_days != null ? String(p.lead_time_days) : "",
        notes: p.notes ?? "",
      }));
    }
    return [{ ...EMPTY_ROW }];
  });

  function addRow() { setRows((prev) => [...prev, { ...EMPTY_ROW }]); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, r: ProductRow) { setRows((prev) => prev.map((x, idx) => idx === i ? r : x)); }

  const canSubmit = rows.some((r) => r.name.trim());

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const result = await submitQuote({
      invite_id: invite.id,
      factory_name: factoryName,
      notes,
      images: [],
      products: rows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          description: r.description,
          moq: r.moq ? parseInt(r.moq) : null,
          unit_price_usd: r.unit_price_usd ? parseFloat(r.unit_price_usd) : null,
          sample_fee_usd: r.sample_fee_usd ? parseFloat(r.sample_fee_usd) : null,
          lead_time_days: r.lead_time_days ? parseInt(r.lead_time_days) : null,
          notes: r.notes,
        })),
    });

    setSubmitting(false);
    if (!result.success) { setError(result.error ?? "Submission failed / 提交失败"); return; }
    setSubmitted(true);
  }

  const deadline = rfq.deadline
    ? new Date(rfq.deadline).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-[#F5F5F7]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif" }}>
      <header className="flex items-center gap-2.5 px-5 py-4 border-b border-black/[0.08] bg-white sticky top-0 z-10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A1A2E] text-white text-[13px] font-bold">K</div>
        <span className="text-[15px] font-semibold text-[#1D1D1F]">Source[Archive]</span>
        <span className="ml-auto text-right leading-tight">
          <span className="block text-[11px] text-[#AEAEB2]">Pricing Portal · 报价门户</span>
        </span>
      </header>

      <main className="mx-auto max-w-xl px-4 py-8">
        {/* Brief */}
        <div className="rounded-2xl bg-white border border-[#E5E5EA] p-5 mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#AEAEB2] mb-2">
            Request for Quotation · 询价单
          </p>
          <h1 className="text-[20px] font-semibold text-[#1D1D1F] leading-snug">{rfq.title}</h1>
          {rfq.description && (
            <p className="text-[13px] text-[#3A3A3C] leading-relaxed whitespace-pre-wrap mt-2">{rfq.description}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#F2F2F7]">
            <div>
              <p className="text-[10px] text-[#AEAEB2] uppercase tracking-wide">To · 收件方</p>
              <p className="text-[13px] font-medium text-[#1D1D1F] mt-0.5">{factoryName}</p>
            </div>
            {deadline && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-[#AEAEB2] uppercase tracking-wide">Deadline · 截止</p>
                <p className="text-[13px] font-medium text-[#1D1D1F] mt-0.5">{deadline}</p>
              </div>
            )}
          </div>
        </div>

        {/* Closed */}
        {isClosed && (
          <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center">
            <AlertCircle size={28} className="mx-auto mb-3 text-[#AEAEB2]" />
            <p className="text-[15px] font-semibold text-[#1D1D1F]">This RFQ is closed · 此询价单已关闭</p>
          </div>
        )}

        {/* Success */}
        {!isClosed && submitted && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-white border border-[#E5E5EA] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 mx-auto mb-4">
              <CheckCircle size={28} strokeWidth={1.5} className="text-emerald-500" />
            </div>
            <h2 className="text-[20px] font-semibold text-[#1D1D1F]">Quote submitted · 报价已提交</h2>
            <p className="mt-2 text-[13px] text-[#6E6E73] leading-relaxed">
              Thank you. We'll be in touch soon.<br />
              <span className="text-[#AEAEB2]">感谢您的报价，我们将尽快联系您。</span>
            </p>
            <button onClick={() => { setSubmitted(false); setShowForm(true); }}
              className="mt-5 text-[12px] text-[#6E6E73] underline hover:text-[#1D1D1F]">
              Update submission · 修改报价
            </button>
          </motion.div>
        )}

        {/* Existing banner */}
        {!isClosed && !submitted && existingSubmission && !showForm && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={17} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-900">Quote submitted · 已提交报价</p>
                <p className="text-[11px] text-emerald-700">
                  {new Date(existingSubmission.submitted_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
            <button onClick={() => setShowForm(true)}
              className="text-[12px] font-medium text-emerald-800 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-100 transition-colors">
              Update · 修改
            </button>
          </div>
        )}

        {/* Form */}
        {!isClosed && showForm && !submitted && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-[17px] font-semibold text-[#1D1D1F]">
                {existingSubmission ? "Update your quote · 修改报价" : "Submit pricing · 提交报价"}
              </h2>
              <p className="text-[12px] text-[#AEAEB2] mt-1">
                Add each product separately with its pricing. · 请逐一填写每个产品的报价信息。
              </p>
            </div>

            {/* Product rows */}
            {rows.map((row, i) => (
              <ProductCard
                key={i}
                index={i}
                row={row}
                onChange={(r) => updateRow(i, r)}
                onRemove={() => removeRow(i)}
                canRemove={rows.length > 1}
              />
            ))}

            <button
              type="button"
              onClick={addRow}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D1D1D6] py-3 text-[13px] font-medium text-[#6E6E73] hover:border-[#1A1A2E] hover:text-[#1A1A2E] transition-colors"
            >
              <Plus size={14} /> Add product · 添加产品
            </button>

            {/* Overall notes */}
            <div>
              <label className="block text-[11px] font-medium text-[#6E6E73] mb-1">
                General notes · 总体备注
              </label>
              <textarea rows={3} className={`${inputCls} resize-none`}
                placeholder="Payment terms, certifications, anything else… / 付款条件、认证、其他说明…"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
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
              <span className="text-[14px] font-semibold">
                {submitting ? "Submitting…" : existingSubmission ? "Update quote" : "Submit quote"}
              </span>
              <span className="text-[12px] opacity-70">
                {submitting ? "提交中…" : existingSubmission ? "更新报价" : "提交报价"}
              </span>
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-[#AEAEB2] mt-8">
          Private link for {factoryName} only · 此链接仅供 {factoryName} 使用
        </p>
      </main>
    </div>
  );
}
