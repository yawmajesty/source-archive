// Shared invoice HTML builder + PDF download helper used by both the
// client portal and the backend quote builder.

import type { Client, SavedInvoice, AgencySettings } from "./data";

export function buildSavedInvoiceHTML(invoice: SavedInvoice, client: Client, agencySettings: AgencySettings): string {
  const date = new Date(invoice.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const projectTotal = invoice.line_items.reduce((s, li) => s + li.amount_usd, 0);
  const isProduction = invoice.invoice_kind === "production";
  const deposit = invoice.deposit_percent ?? 100;
  const dueNow = projectTotal * (deposit / 100);
  const balanceLater = projectTotal - dueNow;
  const grandTotal = isProduction ? dueNow : projectTotal;
  const escAttr = (s: string) => s.replace(/"/g, "&quot;").replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const rows = invoice.line_items.map((li, i) => {
    if (isProduction) {
      const photoCell = li.image_url
        ? `<img src="${escAttr(li.image_url)}" crossorigin="anonymous" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #eee;display:block" />`
        : `<div style="width:56px;height:56px;border-radius:6px;border:1px dashed #ddd;background:#fafaf7;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:18px">·</div>`;
      const qty = li.qty != null ? li.qty.toLocaleString() : "—";
      const unit = li.unit_price_usd != null ? `$${li.unit_price_usd.toFixed(2)}` : "—";
      return `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f7"}">
      <td style="padding:10px 12px;font-size:11px;color:#888;text-align:right;vertical-align:middle">${i + 1}</td>
      <td style="padding:10px 12px;vertical-align:middle;width:64px">${photoCell}</td>
      <td style="padding:10px 12px;vertical-align:middle">
        <div style="font-size:12px;font-weight:600;color:#1d1d1f">${li.name}</div>
        <div style="font-size:10px;color:#888;margin-top:2px">${[li.category, li.project_name].filter(Boolean).join(" · ")}</div>
      </td>
      <td style="padding:10px 12px;font-size:12px;font-family:monospace;text-align:right;white-space:nowrap;vertical-align:middle;color:#1d1d1f">${qty}</td>
      <td style="padding:10px 12px;font-size:12px;font-family:monospace;text-align:right;white-space:nowrap;vertical-align:middle;color:#1d1d1f">${unit}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:700;font-family:monospace;white-space:nowrap;text-align:right;vertical-align:middle">$${li.amount_usd.toFixed(2)}</td>
    </tr>`;
    }
    return `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f7"}">
      <td style="padding:10px 16px;font-size:11px;color:#888;text-align:right">${i + 1}</td>
      <td style="padding:10px 16px">
        <div style="font-size:12px;font-weight:500;color:#1d1d1f">${li.name}</div>
        <div style="font-size:10px;color:#888;margin-top:2px">${[li.category, li.project_name].filter(Boolean).join(" · ")}</div>
        ${li.qty != null && li.unit_price_usd != null ? `<div style="font-size:10px;color:#888;margin-top:1px">${li.qty.toLocaleString()} × $${li.unit_price_usd.toFixed(2)}</div>` : ""}
      </td>
      <td style="padding:10px 16px;font-size:11px;color:#555;white-space:nowrap">${li.expected_date ? new Date(li.expected_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;font-family:monospace;white-space:nowrap;text-align:right">$${li.amount_usd.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const bRow = (label: string, val: string) => val ? `<tr><td style="padding:4px 0;font-size:10px;color:#aaa;white-space:nowrap;width:140px">${label}</td><td style="padding:4px 0 4px 12px;font-size:11px;color:#333;font-weight:500">${esc(val)}</td></tr>` : "";
  const hasBankDetails = [agencySettings.account_name, agencySettings.bank_name, agencySettings.account_number, agencySettings.sort_code, agencySettings.iban, agencySettings.swift_code, agencySettings.account_location, agencySettings.bank_address].some(Boolean);
  const bankBlock = hasBankDetails ? `<div style="border:1px solid #eee;border-radius:10px;padding:16px;flex:1">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:10px">Bank details</div>
  <table style="border-collapse:collapse;width:100%">
    ${bRow("Account name", agencySettings.account_name)}
    ${bRow("Bank name", agencySettings.bank_name)}
    ${bRow("Account number", agencySettings.account_number)}
    ${bRow("Sort code", agencySettings.sort_code)}
    ${bRow("IBAN", agencySettings.iban)}
    ${bRow("SWIFT / BIC", agencySettings.swift_code)}
    ${bRow("Account location", agencySettings.account_location)}
    ${bRow("Bank address", agencySettings.bank_address)}
  </table>
</div>` : "";
  const termsBlock = agencySettings.invoice_terms ? `<div style="border:1px solid #eee;border-radius:10px;padding:16px;flex:1">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:10px">Terms &amp; conditions</div>
  <p style="font-size:11px;color:#333;line-height:1.7">${esc(agencySettings.invoice_terms)}</p>
</div>` : "";

  const defaultTitle = isProduction ? `Production Invoice` : `Sampling Invoice – Round ${invoice.round}`;
  const titleStr = invoice.title ?? defaultTitle;
  const dueLabel = isProduction && deposit < 100 ? `Due now (${deposit}% deposit)` : "Total due";
  const totalsBreakdown = isProduction ? `
<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid #eee;background:#fafaf7">
  <span style="font-size:12px;color:#555">Project total</span>
  <span style="font-size:14px;font-weight:700;font-family:monospace">$${projectTotal.toFixed(2)}</span>
</div>
${deposit < 100 ? `
<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid #eee;background:#fff8e6">
  <span style="font-size:12px;color:#3a2900;font-weight:600">Due now (${deposit}% deposit)</span>
  <span style="font-size:16px;font-weight:800;font-family:monospace;color:#3a2900">$${dueNow.toFixed(2)}</span>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid #eee">
  <span style="font-size:12px;color:#555">Balance (${100 - deposit}%) — invoiced later</span>
  <span style="font-size:14px;font-weight:600;font-family:monospace;color:#555">$${balanceLater.toFixed(2)}</span>
</div>
` : `
<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-top:2px solid #eee">
  <span style="font-size:13px;font-weight:600">Total due</span>
  <span style="font-size:16px;font-weight:800;font-family:monospace">$${projectTotal.toFixed(2)}</span>
</div>
`}` : `
<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-top:2px solid #eee">
  <span style="font-size:13px;font-weight:600">Total</span>
  <span style="font-size:16px;font-weight:800;font-family:monospace">$${grandTotal.toFixed(2)}</span>
</div>`;

  // All styles are scoped to .koru-invoice so they don't leak when this HTML is
  // injected into a host page (the off-screen container used by the PDF renderer).
  // For the standalone print-preview fallback the wrapper is still rendered inside
  // a normal <body>, so everything keeps working there too.
  const scopedStyles = `
    .koru-invoice, .koru-invoice *{box-sizing:border-box;margin:0;padding:0}
    .koru-invoice{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;background:#fff;color:#1d1d1f;padding:40px;width:100%}
    .koru-invoice table{width:100%;border-collapse:collapse}
    .koru-invoice th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#aaa;padding:8px 16px;text-align:left;border-bottom:1px solid #eee}
    .koru-invoice th:last-child{text-align:right}
    .koru-invoice tr{border-bottom:1px solid #eee}
    @media print{.koru-invoice{padding:20px}@page{margin:20mm}}
  `;

  const bodyContent = `<div class="koru-invoice">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
  <div>
    <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">${titleStr}</div>
    <div style="font-size:13px;color:#888;margin-top:4px">${client.name} · ${date}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#aaa">${dueLabel}</div>
    <div style="font-size:28px;font-weight:800;font-family:monospace;margin-top:2px">$${grandTotal.toFixed(2)}</div>
    ${isProduction && deposit < 100 ? `<div style="font-size:10px;color:#888;margin-top:2px">of $${projectTotal.toFixed(2)} project total</div>` : ""}
  </div>
</div>
${invoice.notes ? `<p style="font-size:12px;color:#555;margin-bottom:20px;line-height:1.6">${esc(invoice.notes)}</p>` : `<div style="margin-bottom:20px"></div>`}
<div style="border:1px solid #eee;border-radius:10px;overflow:hidden">
<table>
  <thead>
    ${isProduction
      ? `<tr><th style="width:2rem">#</th><th style="width:64px">Photo</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Line total</th></tr>`
      : `<tr><th style="width:2rem">#</th><th>Item</th><th>Expected Date</th><th style="text-align:right">Amount</th></tr>`}
  </thead>
  <tbody>${rows}</tbody>
</table>
${totalsBreakdown}
</div>
${(bankBlock || termsBlock) ? `<div style="margin-top:24px;display:flex;gap:16px;align-items:flex-start">${bankBlock}${termsBlock}</div>` : ""}
<div style="margin-top:16px;font-size:10px;color:#aaa;text-align:center">Generated by Kōru · ${date}</div>
</div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titleStr} – ${client.name}</title>
<style>body{margin:0;background:#fff}${scopedStyles}</style></head><body>
${bodyContent}
</body></html>`;
}

// Fetch a remote image and convert to a data URL so it embeds in the PDF
// without depending on CORS / image-load timing.
async function imageToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) ?? null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadInvoicePDF(invoice: SavedInvoice, client: Client, agencySettings: AgencySettings): Promise<void> {
  // Pre-resolve every line-item image to a data URL so the PDF renderer
  // doesn't depend on cross-origin loading at capture time.
  const inlinedItems = await Promise.all(
    invoice.line_items.map(async (li) => {
      if (!li.image_url) return li;
      const dataUrl = await imageToDataUrl(li.image_url);
      return dataUrl ? { ...li, image_url: dataUrl } : li;
    })
  );
  const localInvoice: SavedInvoice = { ...invoice, line_items: inlinedItems };

  const html = buildSavedInvoiceHTML(localInvoice, client, agencySettings);

  // Render inside the viewport (off-screen positioning trips html2canvas) but
  // invisible to the user.
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "794px"; // A4 width @ 96dpi
  container.style.background = "#ffffff";
  container.style.opacity = "0";
  container.style.zIndex = "-1";
  container.style.pointerEvents = "none";
  container.innerHTML = html;
  document.body.appendChild(container);

  const isProduction = invoice.invoice_kind === "production";
  const baseName = isProduction
    ? `Production-Invoice-Round-${invoice.round}`
    : `Sampling-Invoice-Round-${invoice.round}`;
  const safeClient = client.name.replace(/[^\w-]+/g, "_");
  const filename = `${safeClient}-${baseName}.pdf`;

  try {
    const mod = await import("html2pdf.js");
    const html2pdf = (mod as any).default ?? mod;
    await html2pdf()
      .set({
        margin: 12,
        filename,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(container)
      .save();
  } catch {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  } finally {
    document.body.removeChild(container);
  }
}
