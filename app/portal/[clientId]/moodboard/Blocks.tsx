"use client";

// ─────────────────────────────────────────────────────────────
// What each kind of board block looks like.
//
// Every block edits in place — click the text and type. A board is
// thought in progress, and making someone open a side panel to change a
// word turns it back into a form.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Check, Plus, X, Play, ExternalLink, LinkIcon } from "lucide-react";
import {
  NOTE_COLOURS, hexToCmyk, cmykToHex, isValidHex, normaliseHex, readableOn,
  type MoodboardItem, type NoteContent, type HeadingContent,
  type ListContent, type ListItem, type SwatchContent, type ListStyle, type LinkContent,
} from "@/lib/moodboard";

/** Grows a textarea to fit, so a note never hides its own last line. */
function useAutoHeight(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

export function NoteBlock({
  item, canEdit, onChange,
}: {
  item: MoodboardItem;
  canEdit: boolean;
  onChange: (c: NoteContent) => void;
}) {
  const content = item.content as NoteContent;
  const colour = NOTE_COLOURS.find((c) => c.id === content.colour) ?? NOTE_COLOURS[0];
  const ref = useAutoHeight(content.text ?? "");

  return (
    <div
      className="rounded-lg p-3 shadow-sm"
      style={{ background: colour.bg, minHeight: item.height ?? 160 }}
    >
      <textarea
        ref={ref}
        readOnly={!canEdit}
        value={content.text ?? ""}
        placeholder="Type a note…"
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        className="w-full resize-none border-0 bg-transparent text-[13px] leading-relaxed outline-none placeholder:opacity-40"
        style={{ color: colour.fg, minHeight: 120 }}
      />
      {canEdit && (
        <div className="mt-1.5 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {NOTE_COLOURS.map((c) => (
            <button
              key={c.id}
              aria-label={c.label}
              onClick={() => onChange({ ...content, colour: c.id })}
              className="h-3.5 w-3.5 rounded-full border"
              style={{
                background: c.bg,
                borderColor: c.id === colour.id ? colour.fg : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HeadingBlock({
  item, canEdit, onChange,
}: {
  item: MoodboardItem;
  canEdit: boolean;
  onChange: (c: HeadingContent) => void;
}) {
  const content = item.content as HeadingContent;
  const big = (content.level ?? 1) === 1;

  return (
    <div className="group/heading">
      <input
        readOnly={!canEdit}
        value={content.text ?? ""}
        placeholder="Section title"
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ ...content, text: e.target.value })}
        className="w-full border-0 bg-transparent p-0 outline-none placeholder:opacity-30"
        style={{
          fontSize: big ? 30 : 20,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: "var(--sa-text-primary)",
        }}
      />
      <div className="mt-1 h-px w-full" style={{ background: "var(--sa-border-strong)" }} />
      {canEdit && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onChange({ ...content, level: big ? 2 : 1 })}
          className="mt-1 text-[10.5px] uppercase tracking-wider opacity-0 transition-opacity group-hover/heading:opacity-100"
          style={{ color: "var(--sa-text-tertiary)" }}
        >
          {big ? "Make smaller" : "Make bigger"}
        </button>
      )}
    </div>
  );
}

export function ListBlock({
  item, canEdit, onChange,
}: {
  item: MoodboardItem;
  canEdit: boolean;
  onChange: (c: ListContent) => void;
}) {
  const content = item.content as ListContent;
  const items = content.items ?? [];
  const style: ListStyle = content.style ?? "bullet";

  function setItem(i: number, patch: Partial<ListItem>) {
    onChange({ ...content, items: items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  }

  return (
    <div
      className="rounded-lg border p-3 shadow-sm"
      style={{ background: "var(--sa-window)", borderColor: "var(--sa-border)" }}
    >
      <input
        readOnly={!canEdit}
        value={content.title ?? ""}
        placeholder="List title"
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ ...content, title: e.target.value })}
        className="w-full border-0 bg-transparent p-0 text-[13px] font-semibold outline-none placeholder:opacity-30"
        style={{ color: "var(--sa-text-primary)" }}
      />

      <div className="mt-2 flex flex-col gap-1">
        {items.map((li, i) => (
          <div key={i} className="group/li flex items-start gap-1.5">
            {style === "checklist" ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => canEdit && setItem(i, { done: !li.done })}
                aria-label={li.done ? "Mark undone" : "Mark done"}
                className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border"
                style={{
                  borderColor: li.done ? "var(--sa-accent)" : "var(--sa-border-strong)",
                  background: li.done ? "var(--sa-accent)" : "transparent",
                }}
              >
                {li.done && <Check size={9} color="#fff" />}
              </button>
            ) : (
              <span
                className="mt-[1px] shrink-0 text-[12px] tabular-nums"
                style={{ color: "var(--sa-text-tertiary)", minWidth: style === "numbered" ? 14 : 8 }}
              >
                {style === "numbered" ? `${i + 1}.` : "•"}
              </span>
            )}

            <input
              readOnly={!canEdit}
              value={li.text}
              placeholder="…"
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => setItem(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (!canEdit) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = [...items];
                  next.splice(i + 1, 0, { text: "" });
                  onChange({ ...content, items: next });
                }
                if (e.key === "Backspace" && li.text === "" && items.length > 1) {
                  e.preventDefault();
                  onChange({ ...content, items: items.filter((_, n) => n !== i) });
                }
              }}
              className="w-full border-0 bg-transparent p-0 text-[12.5px] leading-snug outline-none placeholder:opacity-30"
              style={{
                color: "var(--sa-text-secondary)",
                textDecoration: li.done ? "line-through" : "none",
                opacity: li.done ? 0.55 : 1,
              }}
            />

            {canEdit && items.length > 1 && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onChange({ ...content, items: items.filter((_, n) => n !== i) })}
                aria-label="Remove line"
                className="mt-[2px] shrink-0 opacity-0 transition-opacity group-hover/li:opacity-100"
              >
                <X size={10} style={{ color: "var(--sa-text-tertiary)" }} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-2 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => onChange({ ...content, items: [...items, { text: "" }] })}
            className="flex items-center gap-1 text-[11.5px]"
            style={{ color: "var(--sa-accent)" }}
          >
            <Plus size={10} /> Add
          </button>
          <div className="flex-1" />
          {(["bullet", "numbered", "checklist"] as ListStyle[]).map((sty) => (
            <button
              key={sty}
              onClick={() => onChange({ ...content, style: sty })}
              className="text-[10.5px] capitalize"
              style={{ color: sty === style ? "var(--sa-accent)" : "var(--sa-text-tertiary)" }}
            >
              {sty === "numbered" ? "1." : sty === "checklist" ? "☑" : "•"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SwatchBlock({
  item, canEdit, onChange,
}: {
  item: MoodboardItem;
  canEdit: boolean;
  onChange: (c: SwatchContent) => void;
}) {
  const content = item.content as SwatchContent;
  const hex = isValidHex(content.hex ?? "") ? normaliseHex(content.hex) : "#CCCCCC";
  const cmyk = content.cmyk ?? hexToCmyk(hex);
  const [draft, setDraft] = useState(hex);
  const [open, setOpen] = useState(false);

  useEffect(() => setDraft(hex), [hex]);

  function commitHex(next: string) {
    if (!isValidHex(next)) return;
    const norm = normaliseHex(next);
    onChange({ ...content, hex: norm, cmyk: hexToCmyk(norm) });
  }

  function commitCmyk(part: Partial<{ c: number; m: number; y: number; k: number }>) {
    const next = { ...cmyk, ...part };
    onChange({ ...content, cmyk: next, hex: cmykToHex(next.c, next.m, next.y, next.k) });
  }

  return (
    <div
      className="overflow-hidden rounded-lg border shadow-sm"
      style={{ borderColor: "var(--sa-border)", background: "var(--sa-window)" }}
    >
      <div className="relative h-[92px]" style={{ background: hex }}>
        <input
          readOnly={!canEdit}
          value={content.name ?? ""}
          placeholder="Name it"
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ ...content, name: e.target.value })}
          className="absolute inset-x-0 bottom-0 border-0 bg-transparent px-2.5 pb-2 text-[12.5px] font-medium outline-none placeholder:opacity-40"
          style={{ color: readableOn(hex) }}
        />
        {canEdit && (
          <input
            type="color"
            value={hex}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => commitHex(e.target.value)}
            aria-label="Pick a colour"
            className="absolute right-1.5 top-1.5 h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        )}
      </div>

      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sa-text-tertiary)" }}>
            Hex
          </span>
          <input
            readOnly={!canEdit}
            value={draft}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitHex(draft)}
            onKeyDown={(e) => e.key === "Enter" && commitHex(draft)}
            className="w-full border-0 bg-transparent p-0 font-mono text-[12px] uppercase outline-none"
            style={{ color: "var(--sa-text-primary)" }}
          />
        </div>

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen((o) => !o)}
          className="mt-1 flex w-full items-center gap-1.5 text-left"
        >
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--sa-text-tertiary)" }}>
            CMYK
          </span>
          <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--sa-text-primary)" }}>
            {cmyk.c} {cmyk.m} {cmyk.y} {cmyk.k}
          </span>
        </button>

        {open && canEdit && (
          <div className="mt-1.5 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {(["c", "m", "y", "k"] as const).map((ch) => (
              <label key={ch} className="flex-1">
                <span className="block text-[9px] uppercase" style={{ color: "var(--sa-text-tertiary)" }}>
                  {ch}
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cmyk[ch]}
                  onChange={(e) => commitCmyk({ [ch]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  className="w-full rounded border px-1 py-0.5 text-[11px] tabular-nums outline-none"
                  style={{
                    borderColor: "var(--sa-border)",
                    background: "var(--sa-bg)",
                    color: "var(--sa-text-primary)",
                  }}
                />
              </label>
            ))}
          </div>
        )}

        {open && (
          <p className="mt-1.5 text-[10px] leading-snug" style={{ color: "var(--sa-text-tertiary)" }}>
            A starting point for a printer, not a proof — real CMYK depends on the stock and press.
          </p>
        )}
      </div>
    </div>
  );
}


/**
 * A pasted link.
 *
 * The card is ours — the platform's own embed HTML is never injected.
 * Rendering third-party markup inside a page a client is signed into is
 * a script-execution hole with a preview drawn on top of it, and the
 * thumbnail plus title is what people actually want to see anyway.
 */
export function LinkBlock({ item }: { item: MoodboardItem }) {
  const c = item.content as LinkContent;
  if (!c?.url) return null;

  const isVideo = /youtube|youtu\.be|tiktok|vimeo/i.test(c.provider ?? "");

  return (
    <a
      href={c.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onPointerDown={(e) => e.stopPropagation()}
      className="block overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
      style={{ borderColor: "var(--sa-border)", background: "var(--sa-window)" }}
    >
      {c.thumbnail ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.thumbnail} alt={c.title ?? c.provider} className="block w-full" draggable={false} />
          {isVideo && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60">
                <Play size={15} color="#fff" fill="#fff" />
              </span>
            </span>
          )}
        </div>
      ) : (
        <div
          className="flex h-24 items-center justify-center"
          style={{ background: "var(--sa-hover)" }}
        >
          <LinkIcon size={20} style={{ color: "var(--sa-text-tertiary)" }} />
        </div>
      )}

      <div className="p-2.5">
        <div className="flex items-center gap-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--sa-accent)" }}
          >
            {c.provider}
          </span>
          <ExternalLink size={9} style={{ color: "var(--sa-text-tertiary)" }} />
        </div>
        <p
          className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-snug"
          style={{ color: "var(--sa-text-primary)" }}
        >
          {c.title ?? c.url.replace(/^https?:\/\//, "").slice(0, 60)}
        </p>
        {c.authorName && (
          <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--sa-text-tertiary)" }}>
            {c.authorName}
          </p>
        )}
        {!c.title && !c.thumbnail && (
          <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--sa-text-tertiary)" }}>
            {c.provider} doesn&apos;t allow previews. The link still works.
          </p>
        )}
      </div>
    </a>
  );
}
