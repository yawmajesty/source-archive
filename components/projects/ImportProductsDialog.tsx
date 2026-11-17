"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, FileSpreadsheet, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  IMPORT_FIELDS, autoMap, findHeaderRow, extractProducts, validateProducts,
  skipReason, isBlankRow,
} from "@/lib/product-import";
import { importProducts } from "@/app/(app)/projects/[id]/import-actions";

// ─────────────────────────────────────────────────────────────
// Bringing a collection in from a spreadsheet.
//
// The file is read in the browser. It never leaves the machine until the
// person has seen what was understood and pressed the button, which also
// means a forty-column sheet full of images is not uploaded just to find
// out that the headings were wrong.
//
// The whole design rests on one idea: guess the columns, then show the
// guess. Automatic mapping that cannot be corrected is worse than no
// automatic mapping, because the mistake is silent and ends up in the
// database.
// ─────────────────────────────────────────────────────────────

interface SheetData {
  name: string;
  grid: unknown[][];
}

const PREVIEW_ROWS = 6;

export function ImportProductsDialog({
  projectId,
  existing,
  onClose,
}: {
  projectId: string;
  /** Styles already in the collection, to show what would be updated. */
  existing: Array<{ name: string; style_no?: string | null }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(-1);
  const [mapping, setMapping] = useState<Array<string | null>>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; updated: number } | null>(null);

  const grid = sheets[sheetIndex]?.grid ?? [];
  const headings: unknown[] = headerRow >= 0 ? grid[headerRow] ?? [] : [];

  const products = useMemo(
    () => (headerRow < 0 ? [] : extractProducts(grid, headerRow, mapping)),
    [grid, headerRow, mapping],
  );

  const problems = useMemo(() => validateProducts(products), [products]);

  // Which of these the collection already has, by the same rule the
  // server uses, so the counts shown match what happens.
  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of existing) {
      if (e.style_no) set.add(e.style_no.trim().toLowerCase());
      if (e.name) set.add(e.name.trim().toLowerCase());
    }
    return set;
  }, [existing]);

  const updateCount = products.filter(
    (p) => existingKeys.has((p.styleNo ?? p.name).trim().toLowerCase()) || existingKeys.has(p.name.trim().toLowerCase()),
  ).length;
  const createCount = products.length - updateCount;

  async function readFile(file: File) {
    setReading(true);
    setError(null);
    setDone(null);
    try {
      // Loaded only when a file is chosen — it is a large library and
      // most visits to this page never open this dialog.
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const buf = await file.arrayBuffer();
      if (/\.csv$/i.test(file.name)) {
        const text = new TextDecoder().decode(buf);
        const rows = text.split(/\r?\n/).map((line) => splitCsvLine(line));
        setSheets([{ name: file.name, grid: rows }]);
      } else {
        await wb.xlsx.load(buf);
        const read: SheetData[] = wb.worksheets.map((ws) => {
          const g: unknown[][] = [];
          ws.eachRow({ includeEmpty: true }, (row) => {
            const cells: unknown[] = [];
            row.eachCell({ includeEmpty: true }, (c) => cells.push(c.value));
            g.push(cells);
          });
          return { name: ws.name, grid: g };
        });
        if (read.length === 0) throw new Error("That file has no sheets in it.");
        setSheets(read);
      }
      setFileName(file.name);
      setSheetIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be read.");
      setSheets([]);
      setFileName(null);
    } finally {
      setReading(false);
    }
  }

  // Re-read the headings whenever the chosen sheet changes. The guess is
  // made once per sheet rather than on every render, so a correction made
  // by hand is not undone the moment anything else changes.
  useEffect(() => {
    const g = sheets[sheetIndex]?.grid ?? [];
    const h = findHeaderRow(g);
    setHeaderRow(h);
    setMapping(h >= 0 ? autoMap(g[h]) : []);
  }, [sheets, sheetIndex]);

  function setColumn(index: number, key: string | null) {
    setMapping((prev) => {
      const next = [...prev];
      // A field belongs to one column, so taking it releases it elsewhere.
      if (key) for (let i = 0; i < next.length; i++) if (next[i] === key) next[i] = null;
      next[index] = key;
      return next;
    });
  }

  async function handleImport() {
    setImporting(true);
    setError(null);
    const res = await importProducts({ project_id: projectId, products });
    setImporting(false);
    if (!res.success) { setError(res.error); return; }
    setDone({ created: res.created, updated: res.updated });
    startTransition(() => router.refresh());
  }

  const mappedCount = mapping.filter(Boolean).length;
  const hasName = mapping.includes("name");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="my-auto w-full max-w-3xl min-w-0 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] shadow-xl">
        <div className="flex items-center gap-2 border-b border-[var(--sa-border)] px-5 py-3">
          <FileSpreadsheet size={15} className="shrink-0 text-[var(--sa-text-tertiary)]" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-[var(--sa-text-primary)]">Import styles from a spreadsheet</h2>
            <p className="truncate text-[11.5px] text-[var(--sa-text-tertiary)]">
              {fileName ?? "Excel or CSV. The columns are worked out for you and shown before anything is saved."}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)]">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {done ? (
            <div className="py-8 text-center">
              <Check size={28} className="mx-auto mb-2 text-emerald-600" />
              <p className="text-[14px] font-medium text-[var(--sa-text-primary)]">
                {done.created > 0 && `${done.created} style${done.created === 1 ? "" : "s"} added`}
                {done.created > 0 && done.updated > 0 && ", "}
                {done.updated > 0 && `${done.updated} updated`}
              </p>
              <p className="mt-1 text-[12px] text-[var(--sa-text-tertiary)]">They are in the collection now.</p>
              <button
                onClick={onClose}
                className="mt-4 rounded-lg bg-[var(--sa-accent)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
              >
                Done
              </button>
            </div>
          ) : sheets.length === 0 ? (
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--sa-border)] px-6 py-12 text-center transition-colors hover:border-[var(--sa-accent)]",
                reading && "opacity-60",
              )}
            >
              <Upload size={20} className="text-[var(--sa-text-tertiary)]" />
              <span className="text-[13px] font-medium text-[var(--sa-text-primary)]">
                {reading ? "Reading…" : "Choose a spreadsheet"}
              </span>
              <span className="max-w-sm text-[11.5px] leading-relaxed text-[var(--sa-text-tertiary)]">
                .xlsx or .csv. Headings in English or Chinese both work, and the sheet does not need to start at the
                first row — an RFQ sheet sent back by a factory imports as it is.
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-4">
              {sheets.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--sa-text-tertiary)]">Sheet</span>
                  {sheets.map((s, i) => (
                    <button
                      key={s.name + i}
                      onClick={() => setSheetIndex(i)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        i === sheetIndex
                          ? "border-[var(--sa-accent)] bg-[var(--sa-accent)] text-white"
                          : "border-[var(--sa-border)] text-[var(--sa-text-secondary)] hover:border-[var(--sa-accent)]",
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {headerRow < 0 ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                  No column headings were recognised on this sheet. Check it has a row naming the columns — Style name,
                  MOQ, Fabric and so on — or pick a different sheet.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                    <span className="text-[var(--sa-text-secondary)]">
                      Headings found on row <span className="font-medium text-[var(--sa-text-primary)]">{headerRow + 1}</span>
                      {" · "}
                      <span className="font-medium text-[var(--sa-text-primary)]">{mappedCount}</span> of {headings.length} columns matched
                    </span>
                    <span className="text-[var(--sa-text-tertiary)]">
                      {createCount > 0 && `${createCount} new`}
                      {createCount > 0 && updateCount > 0 && " · "}
                      {updateCount > 0 && `${updateCount} already in the collection, will be updated`}
                    </span>
                  </div>

                  {/* Column mapping */}
                  <div className="overflow-x-auto rounded-lg border border-[var(--sa-border)]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
                          {headings.map((h, i) => (
                            <th key={i} className="min-w-[130px] px-2 py-2 align-top">
                              <p className="truncate text-[11px] font-medium text-[var(--sa-text-primary)]" title={String(h ?? "")}>
                                {String(h ?? "") || <span className="text-[var(--sa-text-tertiary)]">(no heading)</span>}
                              </p>
                              <select
                                value={mapping[i] ?? ""}
                                onChange={(e) => setColumn(i, e.target.value || null)}
                                className={cn(
                                  "mt-1 w-full rounded border bg-[var(--sa-window)] px-1.5 py-1 text-[11px] outline-none",
                                  mapping[i]
                                    ? "border-[var(--sa-accent)] text-[var(--sa-text-primary)]"
                                    : "border-[var(--sa-border)] text-[var(--sa-text-tertiary)]",
                                )}
                              >
                                <option value="">Ignore</option>
                                {IMPORT_FIELDS.map((f) => (
                                  <option key={f.key} value={f.key}>{f.label}</option>
                                ))}
                              </select>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grid
                          .slice(headerRow + 1)
                          .filter((r) => !isBlankRow(r))
                          .slice(0, PREVIEW_ROWS)
                          .map((row, r) => {
                            // Rows that will not be imported are shown
                            // struck through rather than quietly left
                            // out, so the count in the footer and the
                            // rows on screen never disagree.
                            const skipped = skipReason(mapping, row, { allowHeaderLike: r > 0 });
                            return (
                              <tr key={r} className={cn("border-b border-[var(--sa-border)] last:border-0", skipped && "opacity-50")}>
                                {headings.map((_, i) => (
                                  <td key={i} className={cn(
                                    "max-w-[200px] truncate px-2 py-1.5 text-[11.5px] text-[var(--sa-text-secondary)]",
                                    skipped && "line-through",
                                  )}>
                                    {i === 0 && skipped
                                      ? <span className="not-italic no-underline" title={`Skipped — ${skipped}`}>{cellText(row[i]) || "—"}</span>
                                      : cellText(row[i])}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {!hasName && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>No column is set to <strong>Style name</strong>. Pick one above — it is the only thing a style cannot be imported without.</span>
                    </div>
                  )}

                  {problems.length > 0 && (
                    <div className="rounded-lg border border-[var(--sa-border)] bg-[var(--sa-bg)] px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--sa-text-tertiary)]">
                        {problems.length} thing{problems.length === 1 ? "" : "s"} to know
                      </p>
                      {problems.slice(0, 5).map((p, i) => (
                        <p key={i} className="text-[11.5px] text-[var(--sa-text-secondary)]">
                          Row {p.row + 1}: {p.message}
                        </p>
                      ))}
                      {problems.length > 5 && (
                        <p className="text-[11.5px] text-[var(--sa-text-tertiary)]">and {problems.length - 5} more</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {error && <p className="text-[12px] text-red-600">{error}</p>}
            </div>
          )}
        </div>

        {!done && sheets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sa-border)] bg-[var(--sa-bg)] px-5 py-3">
            <span className="text-[11.5px] text-[var(--sa-text-tertiary)]">
              {products.length} style{products.length === 1 ? "" : "s"} ready to import
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => { setSheets([]); setFileName(null); setError(null); }}
                className="rounded-lg border border-[var(--sa-border)] px-3 py-1.5 text-[12px] text-[var(--sa-text-secondary)] hover:bg-[var(--sa-hover)]"
              >
                Choose another file
              </button>
              <button
                onClick={handleImport}
                disabled={importing || products.length === 0 || !hasName}
                className="rounded-lg bg-[var(--sa-accent)] px-4 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {importing ? "Importing…" : `Import ${products.length} style${products.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** ExcelJS hands back objects for formulas, links and rich text. */
function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const v = value as { result?: unknown; text?: unknown; richText?: Array<{ text?: string }>; hyperlink?: string };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text ?? "").join("");
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.hyperlink) return String(v.hyperlink);
    return "";
  }
  return String(value);
}

/** Enough CSV for the sheets people actually paste out of Excel. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
