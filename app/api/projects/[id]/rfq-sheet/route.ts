import { NextResponse } from "next/server";
import { getAgencyContext } from "@/lib/agency-data";
import { getAgencySupabase } from "@/lib/supabase-agency";
import { can } from "@/lib/permissions";
import {
  buildRfqWorkbook, rfqFileName, SAMPLE_TRIGGERS, BULK_TRIGGERS,
  type RfqStyle, type RfqHeader,
} from "@/lib/rfq-sheet";

// ─────────────────────────────────────────────────────────────
// Generate an RFQ sheet for a project, and keep a copy of what was asked.
//
// A POST rather than a GET, because it writes: every generation takes the
// next version number and archives the parameters alongside it. The point
// of a version is comparing what came back, and that only works if the
// sheet it came back against is still on record.
// ─────────────────────────────────────────────────────────────

interface Body {
  rfqNo?: string;
  enquiryDate?: string | null;
  validUntil?: string | null;
  sampleLeadTimeDays?: number | null;
  sampleTrigger?: string | null;
  bulkLeadTimeDays?: number | null;
  bulkTrigger?: string | null;
  /** Style ids to include; all of the project's styles when omitted. */
  productIds?: string[];
}

function firstColourway(colorways: unknown): string {
  if (!Array.isArray(colorways)) return "";
  return colorways
    .map((c) => (typeof c === "string" ? c : (c as { name?: string } | null)?.name))
    .filter(Boolean)
    .join(", ");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const ctx = await getAgencyContext();
  if (!ctx) return new NextResponse("Not a member of any agency", { status: 401 });
  if (!can(ctx.role, ctx.permissions, "product.edit")) {
    return new NextResponse("You don't have permission to generate an RFQ", { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const supabase = await getAgencySupabase();

  const { data: projectRow } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("id", projectId)
    .maybeSingle();
  const project = projectRow as { id: string; name: string; client_id: string } | null;
  if (!project) return new NextResponse("Project not found", { status: 404 });

  const { data: clientRow } = await supabase
    .from("clients")
    .select("name")
    .eq("id", project.client_id)
    .maybeSingle();
  const clientName = (clientRow as { name: string } | null)?.name ?? "Client";

  let query = supabase
    .from("products")
    .select("id, name, style_no, size_range, colour:colorways, fabric, composition_gsm, notes, notes_zh, images, created_at")
    .eq("project_id", projectId)
    .order("created_at");
  if (body.productIds?.length) query = query.in("id", body.productIds);

  const { data: productRows, error: productErr } = await query;
  if (productErr) {
    // The RFQ columns arrive with migration 040. Saying so beats a 500.
    if (/style_no|size_range|composition_gsm|notes_zh|fabric/.test(productErr.message)) {
      return NextResponse.json(
        { error: "RFQ sheets need a one-time database step — run migrations/040_priorities_and_rfq.sql." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: productErr.message }, { status: 500 });
  }

  const rows = (productRows ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return NextResponse.json({ error: "This project has no styles to quote yet." }, { status: 400 });
  }

  const styles: RfqStyle[] = rows.map((r) => ({
    styleName: String(r.name ?? "Unnamed style"),
    styleNo: (r.style_no as string) ?? null,
    size: (r.size_range as string) ?? null,
    colour: firstColourway(r.colour) || null,
    fabric: (r.fabric as string) ?? null,
    compositionGsm: (r.composition_gsm as string) ?? null,
    notesEn: (r.notes as string) ?? null,
    notesZh: (r.notes_zh as string) ?? null,
    imageUrl: Array.isArray(r.images) ? ((r.images as string[])[0] ?? null) : null,
  }));

  // ── The RFQ number, and the next version of it ──
  const rfqNo = body.rfqNo?.trim() || `RFQ-${project.name.replace(/[^\w]+/g, "-").slice(0, 18).toUpperCase()}`;
  const { data: previous } = await supabase
    .from("rfq_sheets")
    .select("version")
    .eq("rfq_no", rfqNo)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((previous as { version: number } | null)?.version ?? 0) + 1;

  const sampleTrigger = SAMPLE_TRIGGERS.includes(body.sampleTrigger as never)
    ? (body.sampleTrigger as string)
    : SAMPLE_TRIGGERS[0];
  const bulkTrigger = BULK_TRIGGERS.includes(body.bulkTrigger as never)
    ? (body.bulkTrigger as string)
    : BULK_TRIGGERS[0];

  const header: RfqHeader = {
    clientName,
    projectName: project.name,
    rfqNo,
    version,
    enquiryDate: body.enquiryDate ?? new Date().toISOString().slice(0, 10),
    validUntil: body.validUntil ?? null,
    sampleLeadTimeDays: body.sampleLeadTimeDays ?? null,
    sampleTrigger,
    bulkLeadTimeDays: body.bulkLeadTimeDays ?? null,
    bulkTrigger,
  };

  const wb = await buildRfqWorkbook(header, styles);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  // ── Archive it ──
  // After the file is built, so a generation that fails leaves no version
  // number burned. Before the response, so the record exists by the time
  // anyone has the file in their hands.
  const { error: archiveErr } = await supabase.from("rfq_sheets").insert({
    agency_id: ctx.agency.id,
    project_id: projectId,
    client_id: project.client_id,
    rfq_no: rfqNo,
    version,
    enquiry_date: header.enquiryDate,
    valid_until: header.validUntil,
    sample_lead_time_days: header.sampleLeadTimeDays,
    sample_trigger: sampleTrigger,
    bulk_lead_time_days: header.bulkLeadTimeDays,
    bulk_trigger: bulkTrigger,
    style_count: styles.length,
    snapshot: { header, styles },
    created_by: ctx.currentUserId,
  });
  if (archiveErr) {
    if (/rfq_sheets/.test(archiveErr.message)) {
      return NextResponse.json(
        { error: "RFQ sheets need a one-time database step — run migrations/040_priorities_and_rfq.sql." },
        { status: 400 },
      );
    }
    console.error("[rfq] could not archive the sheet:", archiveErr.message);
    // The file is still handed over — an unrecorded sheet is better than no
    // sheet, and the log says which one went out unrecorded.
  }

  const filename = rfqFileName(header);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "X-Rfq-No": rfqNo,
      "X-Rfq-Version": String(version),
    },
  });
}
