import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseData as supabase } from "@/lib/supabase-data";
import type { ProductionVariant, Stage } from "@/lib/mock-data";

const STAGE_ORDER: Stage[] = ["brief", "sourcing", "sampling", "approved", "production", "qc", "shipped"];

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; ext: "png" | "jpeg" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    const ext: "png" | "jpeg" = /\.png(\?|$)/i.test(url) ? "png" : "jpeg";
    return { buffer: buf, ext };
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, client_id, season")
    .eq("id", projectId)
    .single();
  if (projErr || !project) {
    return new NextResponse("Project not found", { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", project.client_id)
    .maybeSingle();

  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, stage, colorways, images, production_breakdown, production_status_note, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const approvedIdx = STAGE_ORDER.indexOf("approved");
  const products = (rawProducts ?? []).filter((p: any) =>
    STAGE_ORDER.indexOf(p.stage as Stage) >= approvedIdx
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "Source[Archive]";
  wb.created = new Date();
  const ws = wb.addWorksheet("Production Invoice", {
    properties: { defaultRowHeight: 20 },
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { key: "image",    width: 18 },
    { key: "name",     width: 38 },
    { key: "color",    width: 22 },
    { key: "totalQty", width: 14 },
    { key: "size",     width: 12 },
    { key: "qty",      width: 12 },
    { key: "status",   width: 28 },
  ];

  const header = ws.addRow({
    image: "IMAGE (参考图像)",
    name: "PRODUCT NAME (产品名称)",
    color: "GARMENT COLOR (服装颜色)",
    totalQty: "TOTAL QTY (总数量)",
    size: "SIZE (尺寸)",
    qty: "QTY (数量)",
    status: "生产进度",
  });
  header.height = 28;
  header.eachCell((c) => {
    c.font = { bold: true, size: 11 };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F1F1" } };
    c.border = {
      top: { style: "thin", color: { argb: "FF999999" } },
      bottom: { style: "thin", color: { argb: "FF999999" } },
      left: { style: "thin", color: { argb: "FF999999" } },
      right: { style: "thin", color: { argb: "FF999999" } },
    };
  });

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    bottom: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    left: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    right: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
  };

  for (const product of products as any[]) {
    const images = (product.images ?? []) as string[];
    const heroImage = images[0] ?? null;
    const breakdown = (product.production_breakdown ?? []) as ProductionVariant[];
    // Fallback: if no breakdown saved, fall back to one variant per colorway with a single empty size row
    const variants: ProductionVariant[] = breakdown.length > 0
      ? breakdown
      : ((product.colorways ?? []) as string[]).map((c) => ({ color: c, sizes: [] }));
    const safeVariants = variants.length > 0 ? variants : [{ color: "—", sizes: [] }];

    // Status note: free text if set, otherwise the stage name
    const statusText: string = product.production_status_note?.trim() || String(product.stage ?? "").toUpperCase();

    const productStartRow = ws.rowCount + 1;
    let productRowsAdded = 0;

    for (const variant of safeVariants) {
      const sizeRows = variant.sizes.length > 0 ? variant.sizes : [{ size: "—", qty: 0 }];
      const variantTotal = variant.sizes.reduce((s, sz) => s + (sz.qty || 0), 0);
      const variantStartRow = ws.rowCount + 1;

      for (let i = 0; i < sizeRows.length; i++) {
        const sz = sizeRows[i];
        const row = ws.addRow({
          image: "",
          name: i === 0 ? product.name : "",
          color: i === 0 ? variant.color : "",
          totalQty: i === 0 ? variantTotal : "",
          size: sz.size,
          qty: sz.qty || "",
          status: "",
        });
        row.height = 22;
        row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        row.getCell("name").alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        row.getCell("name").font = { size: 11, bold: i === 0 };
        row.getCell("color").font = { bold: i === 0 };
        row.getCell("totalQty").font = { bold: i === 0 };
        row.eachCell((c) => { c.border = thinBorder; });
        productRowsAdded += 1;
      }

      // Merge name/color/totalQty across the sizes for this variant for a cleaner look
      if (sizeRows.length > 1) {
        ws.mergeCells(variantStartRow, 2, variantStartRow + sizeRows.length - 1, 2); // name
        ws.mergeCells(variantStartRow, 3, variantStartRow + sizeRows.length - 1, 3); // color
        ws.mergeCells(variantStartRow, 4, variantStartRow + sizeRows.length - 1, 4); // totalQty
      }
    }

    const productEndRow = productStartRow + productRowsAdded - 1;

    // Merge the image column down for this product
    if (productRowsAdded > 1) {
      ws.mergeCells(productStartRow, 1, productEndRow, 1);
    }
    // Merge the status column down for this product
    if (productRowsAdded > 1) {
      ws.mergeCells(productStartRow, 7, productEndRow, 7);
    }
    // Write the status into the (merged) cell
    const statusCell = ws.getCell(productStartRow, 7);
    statusCell.value = statusText;
    statusCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    statusCell.font = { size: 11 };
    statusCell.border = thinBorder;

    // Set image cell height & embed image if available
    if (heroImage) {
      const fetched = await fetchImageBuffer(heroImage);
      if (fetched) {
        const imageId = wb.addImage({ buffer: fetched.buffer as any, extension: fetched.ext });
        const heightPx = Math.max(productRowsAdded * 22, 90);
        ws.getRow(productStartRow).height = heightPx;
        ws.addImage(imageId, {
          tl: { col: 0.1, row: productStartRow - 1 + 0.1 } as any,
          ext: { width: 110, height: heightPx - 6 } as any,
          editAs: "oneCell",
        });
      }
    }
  }

  if (products.length === 0) {
    const row = ws.addRow({ image: "", name: "No approved products yet.", color: "", totalQty: "", size: "", qty: "", status: "" });
    row.font = { italic: true, color: { argb: "FF888888" } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `Production-Invoice-${(client?.name ?? "Client").replace(/\s+/g, "-")}-${(project.season || project.name || "Collection").replace(/\s+/g, "-")}.xlsx`;

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
