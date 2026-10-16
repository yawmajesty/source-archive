"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Check, X } from "lucide-react";
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

/**
 * A chip you can change.
 *
 * Third attempt, and the lesson from the first two is in the markup.
 *
 * A bare <select> cannot be styled: the browser draws its own arrow and
 * will not size to content. So the chip is a span with the real select
 * invisible on top — still native, still keyboard-navigable, still the
 * system picker on a phone.
 *
 * The second attempt put an icon in each chip and the icons pushed past the
 * pill. A 10px glyph has its own line box, and inside a span with two pixels
 * of vertical padding there is nowhere for it to go. There are no icons now:
 * a fixed height, overflow hidden, and text that cannot escape its own
 * border. Short muted words when nothing is chosen, the name when something
 * is, and the chip never changes height between the two.
 */
function ChipSelect({
  value, options, onChange, empty, title,
}: {
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (next: string) => void;
  /** Shown, muted, when nothing is chosen. Kept to one short word. */
  empty: string;
  title: string;
}) {
  const chosen = options.find((o) => o.id === value);

  return (
    <span
      title={title}
      className={cn(
        // A fixed height and hidden overflow are what keep the contents
        // inside the border, whatever the text or the font does.
        "relative inline-flex h-[18px] max-w-[6.5rem] shrink-0 items-center overflow-hidden rounded-[5px] px-1.5 transition-colors",
        chosen
          ? "bg-[var(--sa-accent-light)] text-[var(--sa-accent)]"
          : "text-[var(--sa-text-tertiary)] hover:bg-[var(--sa-hover)] hover:text-[var(--sa-text-secondary)]",
      )}
    >
      <span className="truncate text-[10.5px] font-medium leading-none">
        {chosen ? chosen.name : empty}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={title}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 opacity-0"
      >
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </span>
  );
}

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
            <ChipSelect
              value={filterBy.person}
              options={options.people}
              onChange={(v) => setFilterBy((x) => ({ ...x, person: v }))}
              empty="Everyone"
              title="Show one person's tasks"
            />
            <ChipSelect
              value={filterBy.client}
              options={options.clients}
              onChange={(v) => setFilterBy((x) => ({ ...x, client: v }))}
              empty="All clients"
              title="Show one client's tasks"
            />
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
              <div key={item.id} className="group flex items-center gap-2 py-[3px]">
                <button
                  onClick={() => toggle(item)}
                  aria-label={item.done ? "Mark as not done" : "Mark as done"}
                  className={cn(
                    "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
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
                      "min-w-0 flex-1 truncate text-left text-[13px] leading-none transition-colors",
                      item.done
                        ? "text-[var(--sa-text-tertiary)] line-through"
                        : "text-[var(--sa-text-primary)]",
                    )}
                  >
                    {item.body}
                  </button>
                )}

                {/* One row. The task text is what shrinks when space runs
                    out — the chips are short and fixed, so truncating the
                    line is better than wrapping the whole thing. */}
                <span className="flex shrink-0 items-center gap-0.5">
                  <ChipSelect
                    value={item.assignee_user_id ?? ""}
                    options={options.people}
                    onChange={(v) => repin(item, { person: v })}
                    empty="Assign"
                    title="Who's doing this"
                  />
                  <ChipSelect
                    value={item.client_id ?? ""}
                    options={options.clients}
                    onChange={(v) => repin(item, { client: v })}
                    empty="Client"
                    title="Which client"
                  />
                  {item.client_id && productsForClient(item.client_id).length > 0 && (
                    <ChipSelect
                      value={item.product_id ?? ""}
                      options={productsForClient(item.client_id)}
                      onChange={(v) => repin(item, { product: v })}
                      empty="Product"
                      title="Which product"
                    />
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

          <div className="mt-1 flex items-center gap-2">
            <Plus size={13} className="shrink-0 text-[var(--sa-text-tertiary)]" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder={items.length === 0 ? "Type a priority and press Enter" : "Add another"}
              className="min-w-0 flex-1 bg-transparent text-[13px] leading-none text-[var(--sa-text-primary)] outline-none placeholder:text-[var(--sa-text-tertiary)]"
            />
            {/* Sticky between adds: four tasks for one client should not mean
                choosing that client four times. Typing and pressing Enter with
                all three left blank still works, which is the common case. */}
            <ChipSelect
              value={pinTo.person}
              options={options.people}
              onChange={(v) => setPinTo((x) => ({ ...x, person: v }))}
              empty="Assign"
              title="Assign the next task to"
            />
            <ChipSelect
              value={pinTo.client}
              options={options.clients}
              onChange={(v) => setPinTo((x) => ({ ...x, client: v, product: "" }))}
              empty="Client"
              title="For which client"
            />
            {pinTo.client && productsForClient(pinTo.client).length > 0 && (
              <ChipSelect
                value={pinTo.product}
                options={productsForClient(pinTo.client)}
                onChange={(v) => setPinTo((x) => ({ ...x, product: v }))}
                empty="Product"
                title="And which product"
              />
            )}
          </div>

          {error && <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--sa-danger)" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
