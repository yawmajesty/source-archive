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

// Page constants (A4 portrait, mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

function detectImageFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

export async function downloadInvoicePDF(invoice: SavedInvoice, client: Client, agencySettings: AgencySettings): Promise<void> {
  // Pre-fetch every line-item image as a data URL so jsPDF can embed it without
  // any cross-origin / load-timing race.
  const inlinedItems = await Promise.all(
    invoice.line_items.map(async (li) => {
      if (!li.image_url) return li;
      const dataUrl = await imageToDataUrl(li.image_url);
      return dataUrl ? { ...li, image_url: dataUrl } : { ...li, image_url: null };
    })
  );

  // Resolve jsPDF defensively — different jspdf releases (v2/v3/v4) ship it as a
  // named export, a default export, or wrapped under `.default`.
  const jspdfModule: any = await import("jspdf");
  const jsPDFCtor = jspdfModule.jsPDF ?? jspdfModule.default?.jsPDF ?? jspdfModule.default;
  if (typeof jsPDFCtor !== "function") {
    throw new Error("jsPDF could not be loaded. Re-run npm install and try again.");
  }
  const doc = new jsPDFCtor({ unit: "mm", format: "a4", orientation: "portrait" });

  const isProduction = invoice.invoice_kind === "production";
  const projectTotal = inlinedItems.reduce((s, li) => s + li.amount_usd, 0);
  const deposit = invoice.deposit_percent ?? 100;
  const dueNow = projectTotal * (deposit / 100);
  const balanceLater = projectTotal - dueNow;
  const grandTotal = isProduction ? dueNow : projectTotal;
  const date = new Date(invoice.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const titleStr = invoice.title ?? (isProduction ? `Production Invoice` : `Sampling Invoice – Round ${invoice.round}`);
  const dueLabel = isProduction && deposit < 100 ? `DUE NOW (${deposit}% DEPOSIT)` : "TOTAL DUE";

  const rightEdge = MARGIN + CONTENT_W;
  let y = MARGIN + 5;

  // ── Title + meta (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(29, 29, 31);
  doc.text(titleStr, MARGIN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(136, 136, 136);
  doc.text(`${client.name} · ${date}`, MARGIN, y + 6);

  // ── Total due (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text(dueLabel, rightEdge, y - 4, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(29, 29, 31);
  doc.text(`$${grandTotal.toFixed(2)}`, rightEdge, y + 3, { align: "right" });

  if (isProduction && deposit < 100) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text(`of $${projectTotal.toFixed(2)} project total`, rightEdge, y + 8, { align: "right" });
  }

  y += 18;

  // ── Notes
  if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);
    const noteLines = doc.splitTextToSize(invoice.notes, CONTENT_W);
    doc.text(noteLines, MARGIN, y);
    y += noteLines.length * 4 + 4;
  }

  // ── Items table
  // Column layout
  const cols = isProduction
    ? [
        { label: "#",          x: MARGIN,           w: 8,   align: "left"  as const },
        { label: "PHOTO",      x: MARGIN + 8,       w: 22,  align: "left"  as const },
        { label: "ITEM",       x: MARGIN + 30,      w: 80,  align: "left"  as const },
        { label: "QTY",        x: MARGIN + 110,     w: 22,  align: "right" as const },
        { label: "UNIT PRICE", x: MARGIN + 132,     w: 22,  align: "right" as const },
        { label: "LINE TOTAL", x: MARGIN + 154,     w: 26,  align: "right" as const },
      ]
    : [
        { label: "#",      x: MARGIN,         w: 8,   align: "left"  as const },
        { label: "ITEM",   x: MARGIN + 8,     w: 110, align: "left"  as const },
        { label: "DATE",   x: MARGIN + 118,   w: 32,  align: "left"  as const },
        { label: "AMOUNT", x: MARGIN + 150,   w: 30,  align: "right" as const },
      ];

  // Header bar
  doc.setFillColor(245, 245, 247);
  doc.rect(MARGIN, y, CONTENT_W, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(136, 136, 136);
  cols.forEach((c) => {
    const tx = c.align === "right" ? c.x + c.w - 2 : c.x + 2;
    doc.text(c.label, tx, y + 5, { align: c.align });
  });
  y += 7;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setDrawColor(238, 238, 238);

  const ROW_PADDING = 3;
  for (let i = 0; i < inlinedItems.length; i++) {
    const li = inlinedItems[i];
    const photoSize = 16;
    const baseRowH = isProduction ? photoSize + ROW_PADDING * 2 : 11;

    // Pre-measure the name + subtitle to allow taller rows when needed.
    const nameCol = isProduction ? cols[2] : cols[1];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nameLines = doc.splitTextToSize(li.name, nameCol.w - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const subtitleText = [li.category, li.project_name].filter(Boolean).join(" · ");
    const subtitleLines = subtitleText ? doc.splitTextToSize(subtitleText, nameCol.w - 4) : [];
    const measuredTextH = nameLines.length * 4.5 + subtitleLines.length * 3.5 + 2;
    const rowH = Math.max(baseRowH, measuredTextH + ROW_PADDING * 2);

    // Page break check
    if (y + rowH > PAGE_H - MARGIN - 50) {
      doc.addPage();
      y = MARGIN + 5;
    }

    // Row background (alternating)
    if (i % 2 === 1) {
      doc.setFillColor(249, 249, 247);
      doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
    }

    // Index
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    doc.text(String(i + 1), cols[0].x + cols[0].w - 2, y + rowH / 2 + 1, { align: "right" });

    // Photo (production only)
    if (isProduction) {
      const photoX = cols[1].x + 2;
      const photoY = y + (rowH - photoSize) / 2;
      if (li.image_url) {
        try {
          doc.addImage(li.image_url, detectImageFormat(li.image_url), photoX, photoY, photoSize, photoSize);
          doc.setDrawColor(229, 229, 229);
          doc.rect(photoX, photoY, photoSize, photoSize);
        } catch {
          // Image failed to decode — fall through to placeholder
          doc.setDrawColor(221, 221, 221);
          doc.setLineDashPattern([1, 1], 0);
          doc.rect(photoX, photoY, photoSize, photoSize);
          doc.setLineDashPattern([], 0);
        }
      } else {
        doc.setDrawColor(221, 221, 221);
        doc.setLineDashPattern([1, 1], 0);
        doc.rect(photoX, photoY, photoSize, photoSize);
        doc.setLineDashPattern([], 0);
      }
    }

    // Name + subtitle
    const textTop = y + ROW_PADDING + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(29, 29, 31);
    doc.text(nameLines, nameCol.x + 2, textTop);

    if (subtitleLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(136, 136, 136);
      doc.text(subtitleLines, nameCol.x + 2, textTop + nameLines.length * 4.5 + 0.5);
    }

    // Numeric columns
    if (isProduction) {
      const midY = y + rowH / 2 + 1;
      const qtyStr = li.qty != null ? li.qty.toLocaleString() : "—";
      const unitStr = li.unit_price_usd != null ? `$${li.unit_price_usd.toFixed(2)}` : "—";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(29, 29, 31);
      doc.text(qtyStr, cols[3].x + cols[3].w - 2, midY, { align: "right" });
      doc.text(unitStr, cols[4].x + cols[4].w - 2, midY, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(`$${li.amount_usd.toFixed(2)}`, cols[5].x + cols[5].w - 2, midY, { align: "right" });
    } else {
      const midY = y + rowH / 2 + 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(85, 85, 85);
      const dateStr = li.expected_date ? new Date(li.expected_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
      doc.text(dateStr, cols[2].x + 2, midY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(29, 29, 31);
      doc.text(`$${li.amount_usd.toFixed(2)}`, cols[3].x + cols[3].w - 2, midY, { align: "right" });
    }

    // Row separator
    doc.setDrawColor(238, 238, 238);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    y += rowH;
  }

  y += 3;

  // ── Totals breakdown
  function totalsLine(label: string, value: string, opts: { highlight?: boolean; bold?: boolean; small?: boolean } = {}) {
    const h = opts.small ? 8 : 9;
    if (opts.highlight) {
      doc.setFillColor(255, 248, 230);
      doc.rect(MARGIN, y, CONTENT_W, h, "F");
    }
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.small ? 8 : 10);
    doc.setTextColor(opts.highlight ? 58 : (opts.bold ? 29 : 85), opts.highlight ? 41 : (opts.bold ? 29 : 85), opts.highlight ? 0 : (opts.bold ? 31 : 85));
    doc.text(label, MARGIN + 3, y + h - 2.5);
    doc.setFont("helvetica", "bold");
    doc.text(value, MARGIN + CONTENT_W - 3, y + h - 2.5, { align: "right" });
    doc.setDrawColor(238, 238, 238);
    doc.line(MARGIN, y + h, MARGIN + CONTENT_W, y + h);
    y += h;
  }

  if (isProduction) {
    totalsLine("Project total", `$${projectTotal.toFixed(2)}`);
    if (deposit < 100) {
      totalsLine(`Due now (${deposit}% deposit)`, `$${dueNow.toFixed(2)}`, { highlight: true, bold: true });
      totalsLine(`Balance (${100 - deposit}%) — invoiced later`, `$${balanceLater.toFixed(2)}`, { small: true });
    } else {
      totalsLine("Total due", `$${projectTotal.toFixed(2)}`, { bold: true });
    }
  } else {
    totalsLine("Total", `$${grandTotal.toFixed(2)}`, { bold: true });
  }

  y += 4;

  // ── Bank details + Terms (side by side)
  const hasBank = [agencySettings.account_name, agencySettings.bank_name, agencySettings.account_number, agencySettings.sort_code, agencySettings.iban, agencySettings.swift_code, agencySettings.account_location, agencySettings.bank_address].some(Boolean);
  const hasTerms = !!agencySettings.invoice_terms;

  if (hasBank || hasTerms) {
    const colCount = (hasBank ? 1 : 0) + (hasTerms ? 1 : 0);
    const colW = (CONTENT_W - (colCount - 1) * 4) / colCount;
    let colX = MARGIN;

    const drawBox = (title: string, contentFn: (boxY: number) => number, x: number) => {
      const boxYStart = y;
      const innerY = contentFn(boxYStart + 8);
      const boxH = innerY - boxYStart + 4;
      doc.setDrawColor(229, 229, 229);
      doc.rect(x, boxYStart, colW, boxH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(170, 170, 170);
      doc.text(title.toUpperCase(), x + 4, boxYStart + 5);
      return boxH;
    };

    let bankH = 0, termsH = 0;
    if (hasBank) {
      bankH = drawBox("BANK DETAILS", (boxY) => {
        let yy = boxY;
        const fields: Array<[string, string | null]> = [
          ["Account name", agencySettings.account_name],
          ["Bank name", agencySettings.bank_name],
          ["Account number", agencySettings.account_number],
          ["Sort code", agencySettings.sort_code],
          ["IBAN", agencySettings.iban],
          ["SWIFT / BIC", agencySettings.swift_code],
          ["Account location", agencySettings.account_location],
          ["Bank address", agencySettings.bank_address],
        ];
        for (const [label, val] of fields) {
          if (!val) continue;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(170, 170, 170);
          doc.text(label, colX + 4, yy);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(51, 51, 51);
          const valLines = doc.splitTextToSize(String(val), colW - 30);
          doc.text(valLines, colX + 30, yy);
          yy += Math.max(4.5, valLines.length * 3.5 + 1);
        }
        return yy;
      }, colX);
      colX += colW + 4;
    }
    if (hasTerms) {
      termsH = drawBox("TERMS & CONDITIONS", (boxY) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(51, 51, 51);
        const termsLines = doc.splitTextToSize(agencySettings.invoice_terms, colW - 8);
        doc.text(termsLines, colX + 4, boxY);
        return boxY + termsLines.length * 4 + 2;
      }, colX);
    }
    y += Math.max(bankH, termsH) + 6;
  }

  // ── Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(170, 170, 170);
  doc.text(`Generated by Kōru · ${date}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });

  // Build a real blob and trigger an anchor download — more reliable than
  // doc.save() across browsers and Safari in particular.
  const baseName = isProduction
    ? `Production-Invoice-Round-${invoice.round}`
    : `Sampling-Invoice-Round-${invoice.round}`;
  const safeClient = client.name.replace(/[^\w-]+/g, "_");
  const filename = `${safeClient}-${baseName}.pdf`;

  const blob: Blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Give the browser a moment to register the download before we clean up.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
