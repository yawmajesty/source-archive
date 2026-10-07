#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// Catch layouts that cannot fit a phone.
//
// Written after fixing the same bug five times in a row: a table grid with
// fixed pixel columns, laid out for a desktop, rendered on a 390px screen.
// The first column collapses toward nothing, the last ones run off the
// right edge, and a header row keeps claiming they are there.
//
// The rule is simple. A 390px phone minus a 16px gutter each side leaves
// 358px. Anything demanding more than that has to do one of two things:
//
//   · stack        a different layout below a breakpoint
//   · scroll       sit in overflow-x-auto with an explicit min-width
//
// What it cannot do is nothing, which is what this looks for.
//
//   node scripts/check-responsive.mjs
//
// Exits non-zero when it finds something, so it can gate a commit.
// ─────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const BUDGET = 358;
const ROOTS = ["app", "components"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** Pixels a column spec demands before any flexible column gets a share. */
function fixedWidth(spec) {
  let px = 0;
  for (const m of spec.matchAll(/(\d+)px/g)) px += Number(m[1]);
  for (const m of spec.matchAll(/([\d.]+)rem/g)) px += Number(m[1]) * 16;
  return Math.round(px);
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const at = `${file}:${i + 1}`;

      // Tailwind arbitrary grid templates.
      for (const m of line.matchAll(/grid-cols-\[([^\]]+)\]/g)) {
        const px = fixedWidth(m[1]);
        if (px <= BUDGET) continue;
        // Guarded when the grid itself only switches on at a breakpoint.
        if (/(sm|md|lg|xl):grid/.test(line)) continue;
        findings.push({ at, px, detail: m[1], why: "fixed grid with no mobile layout" });
      }

      // Inline grid templates, which the className scan cannot see.
      for (const m of line.matchAll(/gridTemplateColumns:\s*"([^"]+)"/g)) {
        const px = fixedWidth(m[1]);
        if (px <= BUDGET) continue;
        // minWidth means it is meant to scroll rather than fit.
        if (line.includes("minWidth")) continue;
        findings.push({ at, px, detail: m[1], why: "inline grid, no minWidth to scroll against" });
      }

      // A w-full element used directly as a flex child next to a
      // fixed-width sibling. w-full means width:100%, and a flex item
      // defaults to min-width:auto, so it refuses to shrink to make room —
      // the row bursts its container instead. min-w-0 or flex-1 fixes it.
      // Narrow on purpose: both a w-full and a fixed-width class on the
      // same row, and no shrink guard anywhere on it.
      //
      // Limited, and worth knowing how: it only sees literal classNames on
      // one line. The instance that prompted it put w-full in a shared
      // `inputCls` variable across several lines, and this would not have
      // caught it. Reviewing a form at the width it is actually rendered in
      // remains the only reliable check.
      if (/\bflex\b/.test(line) || /className="flex/.test(line)) {
        // Only meaningful when the row's children are on this same line.
        const hasFull = /className="[^"]*\bw-full\b/.test(line);
        const hasFixed = /className="[^"]*\bw-(?:\d+|\[\d+px\])\b/.test(line);
        const guarded = /min-w-0|flex-1|shrink/.test(line);
        if (hasFull && hasFixed && !guarded) {
          findings.push({ at, px: 0, detail: line.trim().slice(0, 70), why: "w-full beside a fixed width in a flex row, nothing allowed to shrink" });
        }
      }

      // Fixed widths wide enough to crowd a phone on their own.
      if (!line.includes("className")) return;
      for (const m of line.matchAll(/(?<![\w:-])w-(?:(\d+)|\[(\d+)px\])(?![\w-])/g)) {
        const px = m[1] ? Number(m[1]) * 4 : Number(m[2]);
        if (px < 320) continue;
        if (/(sm|md|lg|xl):w-/.test(line)) continue;
        const before = line.slice(Math.max(0, m.index - 4), m.index);
        if (/(sm|md|lg|xl):$/.test(before)) continue;
        // A horizontal scroller or a fixed overlay is allowed to be wide.
        if (line.includes("overflow-x-auto") || line.includes("fixed")) continue;
        findings.push({ at, px, detail: m[0], why: "fixed width, never collapses" });
      }
    });
  }
}

if (findings.length === 0) {
  console.log(`\n  No layout demands more than ${BUDGET}px without stacking or scrolling.\n`);
  process.exit(0);
}

console.log(`\n  ${findings.length} layout(s) cannot fit a ${BUDGET}px screen:\n`);
for (const f of findings) {
  console.log(`  ${f.at}`);
  console.log(`      needs ${f.px}px — ${f.why}`);
  console.log(`      ${f.detail.slice(0, 70)}\n`);
}
console.log("  Either add a stacked layout below md, or put it in overflow-x-auto with a min-width.\n");
process.exit(1);
