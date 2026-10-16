"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Check, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listPriorities, addPriority, setPriorityDone, updatePriority, deletePriority, clearDonePriorities,
  assignPriority, getPriorityOptions,
  type Priority, type PriorityOptions,
} from "@/app/(app)/dashboard/priorities-actions";

// ─────────────────────────────────────────────────────────────
// What we're on.
//
// Sits above the queues because it is the only part of the dashboard that
// says what you decided, rather than what the data noticed. Everything
// below it is a list of things that are wrong; this is the answer to them.
//
// Ticking off is optimistic — the line moves the moment you click it and
// only reverts if the server disagrees. A checklist that pauses on every
// tick is one you stop using.
// ─────────────────────────────────────────────────────────────

// A select that reads as a chip: the same control whether it is set or not,
// so changing it is one click rather than a mode.
const CHIP =
  "max-w-[9rem] shrink-0 cursor-pointer truncate rounded-full border px-2 py-[3px] text-[10.5px] outline-none transition-colors";
const CHIP_ON = "border-[var(--sa-accent)] bg-[var(--sa-accent-light)] text-[var(--sa-accent)]";
const CHIP_OFF =
  "border-[var(--sa-border)] bg-transparent text-[var(--sa-text-tertiary)] hover:text-[var(--sa-text-secondary)]";

export function Priorities() {
  const [items, setItems] = useState<Priority[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Who and what a task can be pinned to. Loaded alongside the list so the
  // first picker opens filled rather than empty.
  const [options, setOptions] = useState<PriorityOptions>({ people: [], clients: [], products: [] });
  // What the next task will be pinned to. Sticky on purpose: adding four
  // tasks for one client should not mean choosing them four times.
  const [pinTo, setPinTo] = useState<{ person: string; client: string; product: string }>({
    person: "", client: "", product: "",
  });
  const [filterBy, setFilterBy] = useState<{ person: string; client: string }>({ person: "", client: "" });

  useEffect(() => {
    let live = true;
    Promise.all([listPriorities(), getPriorityOptions()]).then(([res, opts]) => {
      if (!live) return;
      setItems(res.items);
      setSetupNeeded(res.setupNeeded);
      setOptions(opts);
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const visible = items.filter(
    (i) =>
      (!filterBy.person || i.assignee_user_id === filterBy.person) &&
      (!filterBy.client || i.client_id === filterBy.client),
  );
  const open = visible.filter((i) => !i.done);
  const done = visible.filter((i) => i.done);

  const nameOf = (id: string | null, from: Array<{ id: string; name: string }>) =>
    id ? from.find((x) => x.id === id)?.name ?? null : null;
  const productsForClient = (clientId: string) =>
    options.products.filter((p) => p.client_id === clientId);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setError(null);
    const person = options.people.find((p) => p.id === pinTo.person);
    const res = await addPriority(text, {
      assigneeUserId: pinTo.person || null,
      assigneeName: person?.name ?? null,
      clientId: pinTo.client || null,
      productId: pinTo.product || null,
    });
    if (!res.success) { setError(res.error); setDraft(text); return; }
    setItems((prev) => [...prev, res.item]);
    inputRef.current?.focus();
  }

  async function toggle(item: Priority) {
    const next = !item.done;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)));
    const res = await setPriorityDone(item.id, next);
    if (!res.success) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !next } : i)));
      setError(res.error);
    }
  }

  async function remove(id: string) {
    const before = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const res = await deletePriority(id);
    if (!res.success) { setItems(before); setError(res.error); }
  }

  async function rename(id: string, body: string) {
    setEditing(null);
    const before = items;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, body } : i)));
    const res = await updatePriority(id, body);
    if (!res.success) { setItems(before); setError(res.error); }
  }

  async function repin(item: Priority, patch: Partial<{ person: string; client: string; product: string }>) {
    const before = items;
    const person = patch.person !== undefined ? options.people.find((p) => p.id === patch.person) : undefined;
    setItems((prev) =>
      prev.map((i) =>
        i.id !== item.id
          ? i
          : {
              ...i,
              ...(patch.person !== undefined
                ? { assignee_user_id: patch.person || null, assignee_name: person?.name ?? null }
                : {}),
              ...(patch.client !== undefined
                ? { client_id: patch.client || null, product_id: patch.client ? i.product_id : null }
                : {}),
              ...(patch.product !== undefined ? { product_id: patch.product || null } : {}),
            },
      ),
    );
    const res = await assignPriority(item.id, {
      ...(patch.person !== undefined
        ? { assigneeUserId: patch.person || null, assigneeName: person?.name ?? null }
        : {}),
      ...(patch.client !== undefined ? { clientId: patch.client || null } : {}),
      ...(patch.product !== undefined ? { productId: patch.product || null } : {}),
    });
    if (!res.success) { setItems(before); setError(res.error); }
  }

  async function clearDone() {
    const before = items;
    setItems((prev) => prev.filter((i) => !i.done));
    const res = await clearDonePriorities();
    if (!res.success) { setItems(before); setError(res.error); }
  }

  if (setupNeeded) {
    return (
      <div className="border-b border-[var(--sa-border)] bg-[var(--sa-bg)] px-4 py-3 sm:px-6">
        <p className="text-[12.5px] text-[var(--sa-text-secondary)]">
          <span className="font-medium text-[var(--sa-text-primary)]">Priorities</span> need a one-time
          database step — run <code className="text-[11.5px]">migrations/040_priorities_and_rfq.sql</code> in
          the Supabase SQL editor and reload.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--sa-border)] bg-[var(--sa-window)] px-4 py-3.5 sm:px-6">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">What we&apos;re on</h2>
        {open.length > 0 && (
          <span className="tnum text-[11px] text-[var(--sa-text-tertiary)]">
            {open.length} open
          </span>
        )}
        {items.length > 3 && (
          <>
            <select
              value={filterBy.person}
              onChange={(e) => setFilterBy((v) => ({ ...v, person: e.target.value }))}
              className={cn(CHIP, filterBy.person ? CHIP_ON : CHIP_OFF)}
            >
              <option value="">Everyone</option>
              {options.people.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
            </select>
            <select
              value={filterBy.client}
              onChange={(e) => setFilterBy((v) => ({ ...v, client: e.target.value }))}
              className={cn(CHIP, filterBy.client ? CHIP_ON : CHIP_OFF)}
            >
              <option value="">All clients</option>
              {options.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}
        <div className="flex-1" />
        {done.length > 0 && (
          <button
            onClick={clearDone}
            className="text-[11px] text-[var(--sa-text-tertiary)] transition-colors hover:text-[var(--sa-text-secondary)]"
          >
            Clear {done.length} done
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[12px] text-[var(--sa-text-tertiary)]">Loading…</p>
      ) : (
        <>
          <div className="flex flex-col">
            {[...open, ...done].map((item) => (
              <div key={item.id} className="group flex items-start gap-2 py-1">
                <button
                  onClick={() => toggle(item)}
                  aria-label={item.done ? "Mark as not done" : "Mark as done"}
                  className={cn(
                    "mt-[1px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                    item.done
                      ? "border-[var(--sa-accent)] bg-[var(--sa-accent)] text-white"
                      : "border-[var(--sa-border-strong)] hover:border-[var(--sa-accent)]",
                  )}
                >
                  {item.done && <Check size={10} strokeWidth={3} />}
                </button>

                {editing === item.id ? (
                  <input
                    autoFocus
                    defaultValue={item.body}
                    onBlur={(e) => rename(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="min-w-0 flex-1 border-b border-[var(--sa-accent)] bg-transparent text-[13px] text-[var(--sa-text-primary)] outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditing(item.id)}
                    className={cn(
                      "min-w-0 flex-1 text-left text-[13px] leading-snug transition-colors",
                      item.done
                        ? "text-[var(--sa-text-tertiary)] line-through"
                        : "text-[var(--sa-text-primary)]",
                    )}
                  >
                    {item.body}
                  </button>
                )}

                {/* Pinned to whom and what. Selects rather than a modal: one
                    click to change, and the row stays a row. */}
                <span className="flex shrink-0 items-center gap-1">
                  <select
                    value={item.assignee_user_id ?? ""}
                    onChange={(e) => repin(item, { person: e.target.value })}
                    title="Who's doing this"
                    className={cn(CHIP, item.assignee_user_id ? CHIP_ON : CHIP_OFF)}
                  >
                    <option value="">Nobody</option>
                    {options.people.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
                  </select>

                  <select
                    value={item.client_id ?? ""}
                    onChange={(e) => repin(item, { client: e.target.value })}
                    title="Which client"
                    className={cn(CHIP, item.client_id ? CHIP_ON : CHIP_OFF)}
                  >
                    <option value="">No client</option>
                    {options.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {item.client_id && productsForClient(item.client_id).length > 0 && (
                    <select
                      value={item.product_id ?? ""}
                      onChange={(e) => repin(item, { product: e.target.value })}
                      title="Which product"
                      className={cn(CHIP, item.product_id ? CHIP_ON : CHIP_OFF)}
                    >
                      <option value="">Any product</option>
                      {productsForClient(item.client_id).map((pr) => (
                        <option key={pr.id} value={pr.id}>{pr.name}</option>
                      ))}
                    </select>
                  )}
                </span>

                <button
                  onClick={() => remove(item.id)}
                  aria-label="Remove"
                  className="shrink-0 rounded p-0.5 text-[var(--sa-text-tertiary)] opacity-0 transition-opacity hover:text-[var(--sa-danger)] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Plus size={13} className="shrink-0 text-[var(--sa-text-tertiary)]" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder={items.length === 0 ? "Type a priority and press Enter" : "Add another"}
              className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-[13px] text-[var(--sa-text-primary)] outline-none placeholder:text-[var(--sa-text-tertiary)]"
            />
            {/* Sticky between adds: four tasks for one client should not mean
                choosing that client four times. Typing and pressing Enter with
                all three left blank still works, which is the common case. */}
            <select
              value={pinTo.person}
              onChange={(e) => setPinTo((v) => ({ ...v, person: e.target.value }))}
              title="Assign the next task to"
              className={cn(CHIP, pinTo.person ? CHIP_ON : CHIP_OFF)}
            >
              <option value="">Who</option>
              {options.people.map((pp) => <option key={pp.id} value={pp.id}>{pp.name}</option>)}
            </select>
            <select
              value={pinTo.client}
              onChange={(e) => setPinTo((v) => ({ ...v, client: e.target.value, product: "" }))}
              title="For which client"
              className={cn(CHIP, pinTo.client ? CHIP_ON : CHIP_OFF)}
            >
              <option value="">Client</option>
              {options.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {pinTo.client && productsForClient(pinTo.client).length > 0 && (
              <select
                value={pinTo.product}
                onChange={(e) => setPinTo((v) => ({ ...v, product: e.target.value }))}
                title="And which product"
                className={cn(CHIP, pinTo.product ? CHIP_ON : CHIP_OFF)}
              >
                <option value="">Product</option>
                {productsForClient(pinTo.client).map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
