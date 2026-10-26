// ─────────────────────────────────────────────────────────────
// Put pdf.js's worker where the browser can fetch it.
//
// pdf.js runs its parser in a web worker and refuses to start if the
// worker's version differs from the API's — so the file in public/ cannot
// be committed once and forgotten. This copies it out of node_modules on
// every build, which keeps the two in lockstep through any upgrade.
//
// The alternative, letting the bundler resolve the worker through
// `new URL(..., import.meta.url)`, works in some bundlers and silently
// produces a broken path in others. A real file at a known URL does not.
// ─────────────────────────────────────────────────────────────

import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "node_modules/pdfjs-dist/package.json");

if (!existsSync(pkg)) {
  console.log("pdfjs-dist not installed — skipping worker sync.");
  process.exit(0);
}

const version = JSON.parse(readFileSync(pkg, "utf8")).version;
const from = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const to = join(root, "public/pdf.worker.min.mjs");

mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log(`pdf.js worker ${version} → public/pdf.worker.min.mjs`);
