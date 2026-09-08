// ─────────────────────────────────────────────────────────────
// What an invoice comes to.
//
// Totals are not stored — an invoice is its line items, and the sum is
// derived. That means every surface showing an amount has to add it up
// the same way, so the addition lives here and only here. Two places
// doing it separately is how a dashboard and an invoice page come to
// disagree about what a client owes.
//
// The real shape is a flat amount_usd per line: sampling is invoiced as
// a list of things, not a quantity times a unit price. The other keys
// are fallbacks for older rows.
// ─────────────────────────────────────────────────────────────

export function lineAmount(line: unknown): number {
  if (!line || typeof line !== "object") return 0;
  const l = line as Record<string, unknown>;

  const flat = Number(l.amount_usd ?? l.amount ?? 0);
  if (Number.isFinite(flat) && flat !== 0) return flat;

  const qty = Number(l.qty ?? l.quantity ?? 1) || 0;
  const price = Number(l.unit_price ?? l.price ?? 0) || 0;
  return qty * price;
}

export function sumInvoice(lines: unknown): number {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum: number, line) => sum + lineAmount(line), 0);
}

export function money(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
