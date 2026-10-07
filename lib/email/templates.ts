// ─────────────────────────────────────────────────────────────
// The emails themselves.
//
// Plain HTML with inline styles — email clients strip <style> blocks,
// ignore most of CSS, and Outlook renders through Word. Anything clever
// here breaks somewhere, so the layout is a single centred column of
// tables-free block elements, which is the subset everything agrees on.
//
// Every message ships a text/plain twin. It is what accessibility tools
// read aloud, what a watch shows, and what keeps a message out of spam.
// ─────────────────────────────────────────────────────────────

import { STAGE_LABEL } from "@/lib/stages";
import { imageUrl } from "@/lib/image-url";

const INK = "#1D1D1F";
const MUTED = "#6E6E73";
const RULE = "#E5E5E7";
const ACCENT = "#0058B0";

function shell(bodyHtml: string, footerNote?: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F5F5F7;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${INK};padding-bottom:18px;">
    Source<span style="color:${MUTED};">[</span>Archive<span style="color:${MUTED};">]</span>
  </div>
  <div style="background:#FFFFFF;border:1px solid ${RULE};border-radius:12px;padding:26px;">
    ${bodyHtml}
  </div>
  <div style="padding-top:16px;font-size:12px;line-height:1.6;color:${MUTED};">
    ${footerNote ?? "Source Archive — sourcing and product development."}
  </div>
</div>
</body></html>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 12px;font-size:19px;font-weight:600;letter-spacing:-0.01em;color:${INK};">${esc(t)}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${MUTED};">${t}</p>`;
const bullets = (items: string[]) =>
  items
    .map(
      (t) =>
        `<div style="margin:0 0 9px;padding-left:16px;position:relative;font-size:14px;line-height:1.6;color:${MUTED};">` +
        `<span style="position:absolute;left:0;color:${MUTED};">&bull;</span>${t}</div>`,
    )
    .join("");

/** How every message to a client ends. */
const signoff = () =>
  `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">Best,<br />Source Archive team</p>`;

const SIGNOFF_TEXT = "\n\nBest,\nSource Archive team";

const button = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;margin-top:6px;background:${ACCENT};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:6px;">${esc(label)}</a>`;

/** Everything interpolated into an email is user-supplied. */
export function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detailRows(rows: Array<[string, string | null | undefined]>): string {
  const present = rows.filter(([, v]) => v && String(v).trim());
  if (present.length === 0) return "";
  return (
    `<div style="border-top:1px solid ${RULE};margin-top:16px;padding-top:14px;">` +
    present
      .map(
        ([label, value]) =>
          `<div style="margin-bottom:9px;">
             <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};">${esc(label)}</div>
             <div style="font-size:14px;color:${INK};line-height:1.5;">${esc(value)}</div>
           </div>`,
      )
      .join("") +
    `</div>`
  );
}

function textRows(rows: Array<[string, string | null | undefined]>): string {
  return rows
    .filter(([, v]) => v && String(v).trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

// ── Blocks used by the forwardable brief alert ────────────────

/** A titled run of detail, with a rule above it to separate sections. */
function section(title: string, inner: string): string {
  if (!inner) return "";
  return (
    `<div style="border-top:1px solid ${RULE};margin-top:18px;padding-top:14px;">` +
    `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${MUTED};margin-bottom:10px;">${esc(title)}</div>` +
    inner +
    `</div>`
  );
}

/**
 * The name the brand's file was uploaded under.
 *
 * Storage keys are prefixed with a timestamp to keep them unique, which is
 * right for storage and useless in an email — "File 1" tells a factory
 * nothing, "kani_travel_uniform_001_tech_pack.pdf" tells them everything.
 */
function fileNameOf(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return last.replace(/^\d{10,}-/, "") || "Attachment";
  } catch {
    return "Attachment";
  }
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|bmp|tiff?)(\?|$)/i;

/**
 * Uploads, as something you can actually look at in the email.
 *
 * Thumbnails go through the resize endpoint — the originals are around a
 * megabyte each and a brief with eight of them would be an email nobody's
 * client wants to open. Each one links to the full-size file, and anything
 * that isn't an image becomes a plain link rather than a broken box.
 */
function attachments(urls: string[]): string {
  if (urls.length === 0) return "";
  const images = urls.filter((u) => IMAGE_EXT.test(u));
  const others = urls.filter((u) => !IMAGE_EXT.test(u));

  const thumbs = images
    .map(
      (u) =>
        `<a href="${esc(u)}" style="text-decoration:none;display:inline-block;margin:0 6px 6px 0;">` +
        `<img src="${esc(imageUrl(u, 104))}" width="104" alt="" ` +
        `style="display:block;width:104px;height:104px;object-fit:cover;border:1px solid ${RULE};border-radius:8px;" /></a>`,
    )
    .join("");

  const links = others
    .map(
      (u) =>
        `<div style="margin:0 0 6px;font-size:13px;"><a href="${esc(u)}" style="color:${ACCENT};">${esc(fileNameOf(u))}</a></div>`,
    )
    .join("");

  return thumbs + links;
}

function attachmentsText(urls: string[]): string {
  return urls.map((u) => `  ${fileNameOf(u)}\n    ${u}`).join("\n");
}

/** One product from the brief, with everything the brand told us about it. */
function briefProductBlock(prod: BriefProductLike, index: number): string {
  const facts = [
    prod.target_qty != null ? `${prod.target_qty.toLocaleString()} units` : null,
    prod.colorways != null ? `${prod.colorways} colourway${prod.colorways === 1 ? "" : "s"}` : null,
    prod.target_price_usd != null ? `target $${prod.target_price_usd.toFixed(2)}` : null,
  ].filter(Boolean).join(" &middot; ");

  return (
    `<div style="border:1px solid ${RULE};border-radius:10px;padding:14px;margin-bottom:10px;">` +
    `<div style="font-size:15px;font-weight:600;color:${INK};">${index + 1}. ${esc(prod.name || "Unnamed product")}</div>` +
    (prod.category ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(prod.category)}</div>` : "") +
    (facts ? `<div style="font-size:13px;color:${INK};margin-top:8px;">${facts}</div>` : "") +
    (prod.description
      ? `<div style="font-size:13px;line-height:1.6;color:${MUTED};margin-top:8px;">${esc(prod.description).replace(/\n/g, "<br />")}</div>`
      : "") +
    (prod.sustainability
      ? `<div style="font-size:13px;line-height:1.6;color:${MUTED};margin-top:8px;"><strong style="color:${INK};font-weight:600;">Sustainability:</strong> ${esc(prod.sustainability)}</div>`
      : "") +
    (prod.moodboard_link
      ? `<div style="font-size:13px;margin-top:8px;"><a href="${esc(prod.moodboard_link)}" style="color:${ACCENT};">Moodboard link</a></div>`
      : "") +
    (prod.moodboard_files && prod.moodboard_files.length
      ? `<div style="margin-top:10px;">${attachments(prod.moodboard_files)}</div>`
      : "") +
    `</div>`
  );
}

function briefProductText(prod: BriefProductLike, index: number): string {
  const lines = [`${index + 1}. ${prod.name || "Unnamed product"}${prod.category ? ` (${prod.category})` : ""}`];
  const facts = [
    prod.target_qty != null ? `${prod.target_qty} units` : null,
    prod.colorways != null ? `${prod.colorways} colourways` : null,
    prod.target_price_usd != null ? `target $${prod.target_price_usd.toFixed(2)}` : null,
  ].filter(Boolean).join(" · ");
  if (facts) lines.push(`   ${facts}`);
  if (prod.description) lines.push(`   ${prod.description}`);
  if (prod.sustainability) lines.push(`   Sustainability: ${prod.sustainability}`);
  if (prod.moodboard_link) lines.push(`   Moodboard: ${prod.moodboard_link}`);
  if (prod.moodboard_files?.length) lines.push(attachmentsText(prod.moodboard_files));
  return lines.join("\n");
}

/** Structurally what BriefProduct is, without importing the mock-data module. */
export interface BriefProductLike {
  name: string;
  category?: string | null;
  description?: string | null;
  target_qty?: number | null;
  target_price_usd?: number | null;
  colorways?: number | null;
  moodboard_link?: string | null;
  moodboard_files?: string[];
  sustainability?: string | null;
}

export interface Built {
  subject: string;
  html: string;
  text: string;
}

// ── Intake: the confirmation the submitter gets ──────────────

export function briefReceivedClient(input: {
  contactName: string;
  companyName: string;
  productSummary?: string | null;
}): Built {
  const first = input.contactName.trim().split(/\s+/)[0] || "there";
  return {
    subject: "We've got your brief",
    html: shell(
      h1(`Thanks, ${esc(first)} — we've got it`) +
        p("Your brief has landed with us and someone will read it properly rather than skim it. Expect to hear back within two working days.") +
        p("If you think of anything else in the meantime — a reference, a sketch, a change of mind — just reply to this email and it'll reach us.") +
        detailRows([
          ["Brand", input.companyName],
          ["What you're making", input.productSummary],
        ]) +
        signoff(),
      "You're getting this because you submitted a brief at Source Archive.",
    ),
    text:
      `Thanks, ${first} — we've got it.\n\n` +
      `Your brief has landed with us and someone will read it properly rather than skim it. ` +
      `Expect to hear back within two working days.\n\n` +
      `If you think of anything else in the meantime, just reply to this email.\n\n` +
      textRows([["Brand", input.companyName], ["What you're making", input.productSummary]]) +
      SIGNOFF_TEXT,
  };
}

/**
 * The brief alert, written to be forwarded.
 *
 * It used to carry six fields and a link, which meant the only way to see
 * what someone had actually asked for was to log in — and the only way to
 * show it to anyone else was to describe it to them. Everything the form
 * collected is in here now, products laid out one by one with their
 * reference images, so this email can go straight to whoever needs to
 * quote it without a word of explanation.
 *
 * Contact details sit at the top for the same reason: a forwarded brief is
 * no use to a factory or a freelancer if reaching the brand means coming
 * back to ask.
 */
export function briefReceivedAdmin(input: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone?: string | null;
  website?: string | null;
  country?: string | null;
  industry?: string | null;
  brandStage?: string | null;
  manufacturedBefore?: boolean | null;
  howFoundUs?: string | null;
  budget?: string | null;
  timeline?: string | null;
  message?: string | null;
  moodboardLinks?: string | null;
  sustainability?: string | null;
  briefFiles?: string[];
  products?: BriefProductLike[];
  leadsUrl: string;
  bookingUrl?: string | null;
}): Built {
  const products = input.products ?? [];
  const files = input.briefFiles ?? [];
  const made =
    input.manufacturedBefore == null ? null : input.manufacturedBefore ? "Yes" : "No — first time";

  const contact: Array<[string, string | null | undefined]> = [
    ["Name", input.contactName],
    ["Email", input.contactEmail],
    ["Phone", input.phone],
    ["Website", input.website],
    ["Country", input.country],
  ];
  const about: Array<[string, string | null | undefined]> = [
    ["Industry", input.industry],
    ["Brand stage", input.brandStage],
    ["Manufactured before", made],
    ["Budget", input.budget],
    ["Timeline", input.timeline],
    ["Found us via", input.howFoundUs],
  ];

  return {
    subject: `New brief — ${input.companyName}${products.length ? ` · ${products.length} product${products.length === 1 ? "" : "s"}` : ""}`,
    html: shell(
      h1(`New brief from ${input.companyName}`) +
        p(`${esc(input.contactName)} submitted the brief form. Everything they sent is below — forward this as it is.`) +
        section("Contact", detailRows(contact)) +
        section("About them", detailRows(about)) +
        (products.length
          ? section(
              `Products (${products.length})`,
              products.map((prod, i) => briefProductBlock(prod, i)).join(""),
            )
          : "") +
        section("Attachments", attachments(files)) +
        section(
          "In their words",
          detailRows([
            ["Message", input.message],
            ["Moodboard links", input.moodboardLinks],
            ["Sustainability requirements", input.sustainability],
          ]),
        ) +
        `<div style="margin-top:20px;">${button(input.leadsUrl, "Open in Leads")}` +
        (input.bookingUrl
          ? `<a href="${esc(input.bookingUrl)}" style="display:inline-block;margin:6px 0 0 8px;font-size:14px;color:${ACCENT};text-decoration:none;padding:10px 4px;">Booking link</a>`
          : "") +
        `</div>`,
      "Sent to you because you're an admin on Source Archive. Reply to reach the brand directly.",
    ),
    text:
      `New brief from ${input.companyName}\n\n` +
      `CONTACT\n` + textRows(contact) + `\n\n` +
      `ABOUT THEM\n` + textRows(about) + `\n\n` +
      (products.length
        ? `PRODUCTS (${products.length})\n` + products.map((prod, i) => briefProductText(prod, i)).join("\n\n") + `\n\n`
        : "") +
      (files.length ? `ATTACHMENTS\n${attachmentsText(files)}\n\n` : "") +
      textRows([
        ["Message", input.message],
        ["Moodboard links", input.moodboardLinks],
        ["Sustainability requirements", input.sustainability],
      ]) +
      `\n\nOpen in Leads: ${input.leadsUrl}` +
      (input.bookingUrl ? `\nBooking link: ${input.bookingUrl}` : ""),
  };
}

export function enquiryReceivedClient(input: { contactName: string }): Built {
  const first = input.contactName.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Thanks for getting in touch",
    html: shell(
      h1(`Thanks, ${esc(first)}`) +
        p("We've got your message and someone will come back to you shortly. Reply to this email if you want to add anything.") +
        signoff(),
      "You're getting this because you contacted Source Archive.",
    ),
    text:
      `Thanks, ${first}.\n\nWe've got your message and someone will come back to you shortly. ` +
      `Reply to this email if you want to add anything.` +
      SIGNOFF_TEXT,
  };
}

export function enquiryReceivedAdmin(input: {
  name: string;
  email: string;
  company?: string | null;
  message?: string | null;
  leadsUrl: string;
}): Built {
  return {
    subject: `New enquiry — ${input.company || input.name}`,
    html: shell(
      h1("New enquiry") +
        detailRows([
          ["From", `${input.name} · ${input.email}`],
          ["Company", input.company],
          ["Message", input.message],
        ]) +
        `<div style="margin-top:16px;">${button(input.leadsUrl, "Open in Leads")}</div>`,
    ),
    text:
      `New enquiry\n\n` +
      textRows([["From", `${input.name} · ${input.email}`], ["Company", input.company], ["Message", input.message]]) +
      `\n\nOpen in Leads: ${input.leadsUrl}`,
  };
}

export function techpackReceivedClient(input: { contactName: string; garment?: string | null }): Built {
  const first = input.contactName.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Your tech pack request",
    html: shell(
      h1(`Thanks, ${esc(first)}`) +
        p("We've got your tech pack request. We'll review the details and come back to you with next steps and a quote.") +
        detailRows([["Garment", input.garment]]) +
        signoff(),
      "You're getting this because you requested a tech pack from Source Archive.",
    ),
    text:
      `Thanks, ${first}.\n\nWe've got your tech pack request. We'll review the details and come back ` +
      `to you with next steps and a quote.\n\n${textRows([["Garment", input.garment]])}` +
      SIGNOFF_TEXT,
  };
}

export function techpackReceivedAdmin(input: {
  contactName: string;
  contactEmail: string;
  garment?: string | null;
  url: string;
}): Built {
  return {
    subject: `New tech pack request — ${input.contactName}`,
    html: shell(
      h1("New tech pack request") +
        detailRows([["From", `${input.contactName} · ${input.contactEmail}`], ["Garment", input.garment]]) +
        `<div style="margin-top:16px;">${button(input.url, "Open in Tech Packs")}</div>`,
    ),
    text:
      `New tech pack request\n\n` +
      textRows([["From", `${input.contactName} · ${input.contactEmail}`], ["Garment", input.garment]]) +
      `\n\nOpen: ${input.url}`,
  };
}

// ── Stage updates ────────────────────────────────────────────

/** What a client should read when a garment moves. Written from their
 *  side: what has happened to their product, not what our field changed to. */
const STAGE_SENTENCE: Record<string, string> = {
  brief: "We've started working out the design.",
  pattern: "The pattern is being drafted.",
  sourcing: "We're finding the right manufacturer for it.",
  sampling: "Your first sample is being made.",
  review: "Your sample is ready and waiting for your comments.",
  approved: "The sample is approved.",
  revision: "We're making a second sample with your feedback applied.",
  production: "It's gone into production.",
  qc: "It's being checked against the spec.",
  shipped: "It's finished and on its way to you.",
};

export function stageUpdateClient(input: {
  productName: string;
  clientName: string;
  toStage: string;
  note?: string | null;
  portalUrl: string;
}): Built {
  const label = STAGE_LABEL[input.toStage] ?? input.toStage;
  const sentence = STAGE_SENTENCE[input.toStage] ?? `It's moved to ${label.toLowerCase()}.`;

  return {
    subject: `${input.productName} — ${label}`,
    html: shell(
      h1(esc(input.productName)) +
        p(`<strong style="color:${INK};">${esc(label)}</strong> — ${esc(sentence)}`) +
        (input.note
          ? `<div style="border-left:2px solid ${RULE};padding:2px 0 2px 12px;margin:14px 0;font-size:14px;line-height:1.6;color:${MUTED};">${esc(input.note)}</div>`
          : "") +
        `<div style="margin-top:16px;">${button(input.portalUrl, "See it in your portal")}</div>` +
        signoff(),
      "You're getting this because you're working with Source Archive. Tell us any time if you'd rather not.",
    ),
    text:
      `${input.productName} — ${label}\n\n${sentence}\n` +
      (input.note ? `\n${input.note}\n` : "") +
      `\nSee it in your portal: ${input.portalUrl}` +
      SIGNOFF_TEXT,
  };
}

// ── Written by hand from the CRM ─────────────────────────────

/**
 * A message someone typed themselves, wrapped in the same shell as the
 * automated ones so a client's inbox looks consistent.
 *
 * The body is plain text from a textarea, escaped and then given
 * paragraph breaks — never interpolated as markup. It is typed by our
 * own team, but "trusted author" is not a reason to build an HTML
 * injection into an email that goes to a client's inbox.
 */
export function crmMessage(input: { subject: string; body: string }): Built {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => p(esc(block).replace(/\n/g, "<br />")))
    .join("");

  return {
    subject: input.subject,
    html: shell(paragraphs || p(esc(input.body))),
    text: input.body,
  };
}


// ── Planner notifications ────────────────────────────────────

export function crewCallSheet(input: {
  role: string;
  shootTitle: string;
  date: string | null;
  callTime: string | null;
  location: string | null;
  shotCount: number;
  notes: string | null;
}): Built {
  const when = input.date
    ? new Date(`${input.date}T12:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
      })
    : "Date to confirm";

  return {
    subject: `Call sheet — ${input.shootTitle}${input.date ? ` · ${when}` : ""}`,
    html: shell(
      h1(esc(input.shootTitle)) +
        p(`You're booked as <strong style="color:${INK};">${esc(input.role)}</strong>.`) +
        detailRows([
          ["When", `${when}${input.callTime ? `, call ${input.callTime}` : ""}`],
          ["Where", input.location],
          ["Shot list", `${input.shotCount} shot${input.shotCount === 1 ? "" : "s"}`],
          ["Notes", input.notes],
        ]) +
        p("Reply to this email if anything doesn't work."),
      "You're getting this because you're booked on this shoot.",
    ),
    text:
      `${input.shootTitle}\n\nYou're booked as ${input.role}.\n\n` +
      textRows([
        ["When", `${when}${input.callTime ? `, call ${input.callTime}` : ""}`],
        ["Where", input.location],
        ["Shot list", `${input.shotCount} shots`],
        ["Notes", input.notes],
      ]) +
      `\n\nReply to this email if anything doesn't work.`,
  };
}

export function shootBriefShared(input: {
  shootTitle: string;
  date: string | null;
  portalUrl: string;
}): Built {
  return {
    subject: `${input.shootTitle} — the shoot brief`,
    html: shell(
      h1("Your shoot brief is ready to look over") +
        p(`We've written up <strong style="color:${INK};">${esc(input.shootTitle)}</strong> — the shot list, the references, the styling and hair. Have a read and tell us what you'd change before we book it.`) +
        detailRows([["Planned for", input.date]]) +
        `<div style="margin-top:16px;">${button(input.portalUrl, "Read the brief")}</div>`,
      "You're getting this because you're working with Source Archive.",
    ),
    text:
      `Your shoot brief is ready to look over.\n\n` +
      `We've written up ${input.shootTitle} — the shot list, the references, the styling and hair. ` +
      `Have a read and tell us what you'd change before we book it.\n\n` +
      `Read the brief: ${input.portalUrl}`,
  };
}

export function campaignItemDue(input: {
  ownerName: string;
  items: Array<{ title: string; campaign: string; due: string | null }>;
  url: string;
}): Built {
  const rows = input.items
    .map(
      (i) =>
        `<div style="margin-bottom:9px;">
           <div style="font-size:14px;color:${INK};">${esc(i.title)}</div>
           <div style="font-size:12px;color:${MUTED};">${esc(i.campaign)}${i.due ? ` · due ${esc(i.due)}` : ""}</div>
         </div>`,
    )
    .join("");

  return {
    subject:
      input.items.length === 1
        ? `Due: ${input.items[0].title}`
        : `${input.items.length} things due on your campaigns`,
    html: shell(
      h1("Waiting on you") +
        p("These are past their date and haven't gone out yet.") +
        `<div style="border-top:1px solid ${RULE};margin-top:16px;padding-top:14px;">${rows}</div>` +
        `<div style="margin-top:16px;">${button(input.url, "Open the plan")}</div>`,
      "You're getting this because you're named on these items.",
    ),
    text:
      `Waiting on you — these are past their date and haven't gone out yet.\n\n` +
      input.items.map((i) => `- ${i.title} (${i.campaign})${i.due ? ` — due ${i.due}` : ""}`).join("\n") +
      `\n\nOpen the plan: ${input.url}`,
  };
}


// ── Answering a brief ────────────────────────────────────────

/**
 * The default wording for turning a brief down.
 *
 * Offered as editable text rather than sent as-is: a decline is a
 * relationship moment, and the difference between a form letter and one
 * sentence about their actual product is whether they come back. The
 * helpful links are the part that makes "no" worth reading.
 */
export function declineDefaultBody(input: { name: string; productName: string; calculatorUrl?: string }): string {
  const first = input.name.trim().split(/\s+/)[0] || "there";
  return (
    `Hi ${first},\n\n` +
    `Thanks for sending over ${input.productName} — genuinely good to see what you're working on.\n\n` +
    `We can't take this one on right now. Our sampling calendar is full and we'd rather say so than ` +
    `hold you up.\n\n` +
    `A few things that might help in the meantime:\n` +
    `— Our free pricing calculator, for working out what to charge: ${input.calculatorUrl ?? "[link]"}\n` +
    `— A tech pack template you can send to any factory: [link]\n` +
    `— If you need an introduction to a manufacturer, reply and we'll point you somewhere good.\n\n` +
    `Do keep us in mind for the next one — we'd like to work together when the timing lands better.\n\n` +
    `Best,\nSource Archive team`
  );
}

export function briefDecision(input: {
  productName: string;
  body: string;
  portalUrl: string;
  accepted: boolean;
}): Built {
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => p(esc(b).replace(/\n/g, "<br />")))
    .join("");

  return {
    subject: input.accepted
      ? `${input.productName} — we're on it`
      : `${input.productName} — thanks for sending this over`,
    html: shell(
      paragraphs +
        (input.accepted
          ? `<div style="margin-top:16px;">${button(input.portalUrl, "Follow it in your portal")}</div>`
          : ""),
      "You're getting this because you sent us a product brief.",
    ),
    text: input.body + (input.accepted ? `\n\nFollow it in your portal: ${input.portalUrl}` : ""),
  };
}


// ── Acknowledging an enquiry ─────────────────────────────────

/**
 * When we'll realistically come back to them.
 *
 * The Friday problem is real: a brief arriving Friday afternoon gets
 * looked at Monday, and saying "24–48 hours" on a Friday is a promise
 * that breaks itself over the weekend. Working it out from the actual
 * day is more honest than one fixed sentence, and it costs nothing.
 */
export function replyWindowFor(date = new Date()): string {
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  if (day === 5) return "early next week — anything arriving on a Friday tends to get looked at properly on Monday";
  if (day === 6 || day === 0) return "early next week";
  if (day === 4) return "within 24 to 48 hours — by early next week at the latest";
  return "within 24 to 48 hours";
}

// ── Quick replies to a lead ───────────────────────────────────
//
// These are drafts, not finished messages. Every one of them goes in front
// of whoever is sending it first, because the sentence that makes a reply
// land is the one about their actual product, and no template can write it.
// The same shape as the brief decision email: plain text the sender edits,
// rendered through the shell on the way out.

export interface Draft {
  subject: string;
  body: string;
}

export type LeadReplyKind = "acknowledge" | "more_info" | "book_call" | "decline";

/**
 * "We've got it, here's when we'll come back."
 *
 * The one reply that should never be late. Someone who sends a brief and
 * hears nothing for two days assumes it went nowhere, and by the time a
 * real answer arrives they have already asked someone else.
 */
export function acknowledgeDraft(input: {
  contactName: string;
  companyName?: string | null;
  isBrief: boolean;
  window: string;
}): Draft {
  const first = input.contactName.trim().split(/\s+/)[0];
  const what = input.isBrief ? "your brief" : "your enquiry";
  const forCompany = input.companyName ? ` for ${input.companyName}` : "";

  return {
    subject: input.isBrief ? "Thanks for your brief" : "Thanks for getting in touch",
    body:
      `${first ? `Hi ${first},` : "Hello,"}\n\n` +
      `Thanks for sending ${what}${forCompany} over — we've got it.\n\n` +
      `We read these properly rather than skimming them, so we'll come back to you ${input.window}. ` +
      `Either way: what the next steps look like, or an honest no if it isn't something we can take ` +
      `on right now.\n\n` +
      `If anything changes in the meantime, or you think of something you forgot to mention, just ` +
      `reply to this email.\n\n` +
      `Best,\nSource Archive team`,
  };
}

/**
 * "Tell us enough to make a call worth having."
 *
 * For a brief too thin to act on. A call with someone who hasn't decided
 * what they are making costs an hour and produces nothing; the polite
 * version of that is to say what we need and why, before booking it.
 *
 * Names the three things rather than asking them to tell us more — a vague
 * ask gets a vague answer or none — and says rough notes are fine, because
 * the usual reason a brief arrives thin is that someone thinks it has to be
 * polished first.
 */
export function moreInfoDraft(input: {
  contactName: string;
  companyName?: string | null;
  isBrief: boolean;
  /** A link back to the brief they already sent, when we have one. */
  editUrl?: string | null;
}): Draft {
  const first = input.contactName.trim().split(/\s+/)[0];
  const what = input.isBrief ? "your brief" : "your enquiry";
  const forCompany = input.companyName ? ` for ${input.companyName}` : "";

  return {
    subject: "A few more details before we set up a call",
    body:
      `${first ? `Hi ${first},` : "Hello,"}\n\n` +
      `Thanks for sending ${what}${forCompany} over.\n\n` +
      `Before we put a call in, it would help to understand a bit more about what you're planning. ` +
      `What we've got so far doesn't quite give us enough to work with, and we've found these ` +
      `conversations are far more useful when we've had a chance to think properly about your ` +
      `project beforehand — otherwise we spend the call gathering information rather than giving ` +
      `you anything worth having.\n\n` +
      (input.editUrl
        ? `You can open what you already sent and add to it here — nothing is lost, and you can ` +
          `come back to it:\n${input.editUrl}\n\n` +
          `The three things that would help most:\n`
        : `If you could reply with:\n`) +
      `— Photographs or references for each piece. Even a phone photo of something similar, or a ` +
      `screenshot, tells us more than a paragraph can.\n` +
      `— One entry per product. If you're making a hoodie and a tee, they need to be two separate ` +
      `products rather than one — they take different fabric, different patterns and different ` +
      `prices, and a factory cannot quote them together.\n` +
      `— The specifics you do have: fabric, colours, sizing, finishes, rough quantities, a target ` +
      `price. Anything concrete.\n\n` +
      `It really doesn't need to be polished. Rough notes are genuinely fine — we just need enough ` +
      `to come back to you with something useful.\n\n` +
      `Once we've got that, we'll get a call in the diary.\n\n` +
      `Best,\nSource Archive team`,
  };
}

/**
 * "Let's get a call in."
 *
 * The reply that should follow a brief with enough in it to talk about.
 * Leads the booking link with a reason to click it — a bare link reads as
 * admin, a line about what the call will cover reads as interest — and
 * says what we'll have looked at beforehand, which is the difference
 * between a sales call and a useful one.
 */
export function bookCallDraft(input: {
  contactName: string;
  companyName?: string | null;
  isBrief: boolean;
  bookingUrl: string;
}): Draft {
  const first = input.contactName.trim().split(/\s+/)[0];
  const what = input.isBrief ? "your brief" : "your enquiry";
  const forCompany = input.companyName ? ` for ${input.companyName}` : "";

  return {
    subject: input.companyName ? `${input.companyName} — let's set up a call` : "Let's set up a call",
    body:
      `${first ? `Hi ${first},` : "Hello,"}\n\n` +
      `Thanks for sending ${what}${forCompany} over — we've read through it and we'd like to talk ` +
      `it through properly.\n\n` +
      `You can pick a time that suits you here:\n` +
      `${input.bookingUrl}\n\n` +
      `We'll have gone through what you've sent before we speak, so we can use the time to get into ` +
      `the details — where it's best made, what's realistic on timing, and what we'd need from you ` +
      `to put costs together. If there's anything else you want us to look at first, just reply and ` +
      `send it over.\n\n` +
      `Looking forward to it.\n\n` +
      `Best,\nSource Archive team`,
  };
}

/**
 * Make bare URLs clickable.
 *
 * Runs on already-escaped text, so there is nothing left to inject — and
 * it has to, because a booking link the recipient cannot click is the one
 * thing the call invitation exists to deliver. Some clients auto-link and
 * some do not; this stops it being their decision. Trailing punctuation is
 * left outside the link so a sentence-ending full stop does not become
 * part of the address.
 */
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+/g, (match) => {
    const trailing = match.match(/[.,;:!?)\]]+$/);
    const href = trailing ? match.slice(0, -trailing[0].length) : match;
    return `<a href="${href}" style="color:${ACCENT};">${href}</a>${trailing ? trailing[0] : ""}`;
  });
}

/**
 * Why we are saying no.
 *
 * Three, because three is what actually happens, and because a no that
 * explains itself is the one that gets a second enquiry later. "Not right
 * now" with no reason reads as "not you", and a brand that thinks it was
 * rejected does not come back when it is ready.
 */
export type DeclineReason = "too_early" | "at_capacity" | "not_a_fit";

export const DECLINE_REASONS: Array<{ id: DeclineReason; label: string; detail: string }> = [
  {
    id: "at_capacity",
    label: "Not right now",
    detail: "A small team already committed. Leaves the door open without naming a date.",
  },
  {
    id: "not_a_fit",
    label: "Not right for us",
    detail: "Not one for us at this time. Says so without saying why.",
  },
  {
    id: "too_early",
    label: "Not the right moment for them",
    detail: "Better suited to a later stage of their brand. No advice attached.",
  },
];

/**
 * The decline itself, as a draft.
 *
 * Deliberately vague. An earlier version explained what the brand should do
 * first, which reads as a lecture from someone who has just said no and
 * invites an argument about whether the advice is right. Saying less is both
 * kinder and more honest: the real reason is usually capacity, and a brand
 * that is told plainly and warmly comes back.
 *
 * All three keep the same shape — thank them, decline, leave it open — and
 * differ only in the middle sentence. None of them gives a reason beyond
 * the one the sender picked.
 */
export function declineDraft(input: {
  contactName: string;
  companyName?: string | null;
  isBrief: boolean;
  reason: DeclineReason;
}): Draft {
  const first = input.contactName.trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${first},` : "Hello,";
  const what = input.isBrief ? "your brief" : "your enquiry";
  const forCompany = input.companyName ? ` for ${input.companyName}` : "";

  const MIDDLE: Record<DeclineReason, { subject: string; lines: string }> = {
    at_capacity: {
      subject: input.companyName ? `${input.companyName} — not one we can take on right now` : "Not one we can take on right now",
      lines:
        `We don't believe we can take this on at the moment. We're a small team and we'd rather give ` +
        `the clients we have the right amount of time than spread ourselves across more than we can ` +
        `do properly.\n\n` +
        `Do keep us in mind — if things change on your side, or ours, we'd be glad to hear from you ` +
        `again.`,
    },
    not_a_fit: {
      subject: input.companyName ? `${input.companyName} — not one for us` : "Not one for us",
      lines:
        `Having looked through it, we don't think this one is right for us at this time. We're a ` +
        `small team and we take on a limited amount so that each project gets the attention it needs.\n\n` +
        `That's no reflection on what you're building, and we'd be glad to hear from you again down ` +
        `the line.`,
    },
    too_early: {
      subject: input.companyName ? `${input.companyName} — not the right moment` : "Not the right moment",
      lines:
        `We don't think this is the right moment for us to work together. We're a small team and the ` +
        `projects we take on need to be at a stage where we can give them the time they deserve.\n\n` +
        `That may well change, and we'd genuinely welcome another conversation when it does.`,
    },
  };

  const body = MIDDLE[input.reason];

  return {
    subject: body.subject,
    body:
      `${greeting}\n\n` +
      `Thanks for sending ${what}${forCompany} over, and for thinking of us.\n\n` +
      `${body.lines}\n\n` +
      `Best,\nSource Archive team`,
  };
}

/**
 * Render an edited draft.
 *
 * Blank lines separate paragraphs, single newlines become line breaks, so
 * the list in the more-information draft survives editing without anyone
 * having to think about markup. Everything is escaped: the sender is
 * trusted, the lead's own name and company in the draft are not.
 */
export function leadReply(draft: Draft): Built {
  const paragraphs = draft.body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => p(linkify(esc(b)).replace(/\n/g, "<br />")))
    .join("");

  return {
    subject: draft.subject,
    html: shell(paragraphs, "You're getting this because you contacted Source Archive."),
    text: draft.body,
  };
}

/**
 * "Something changed in your portal."
 *
 * A client should not have to check a website to find out an invoice is
 * waiting. This says what happened in one line, and links straight to it —
 * the point is the link, so the email stays short enough that the link is
 * the only thing to do with it.
 *
 * Used for anything the client can see: invoices going out, payments
 * landing, files arriving. The headline is written by the caller because
 * "there's been an update" on its own is the kind of notification people
 * learn to ignore.
 */
export function portalUpdate(input: {
  headline: string;
  detail?: string | null;
  portalUrl: string;
  linkLabel?: string;
}): Built {
  return {
    // The headline alone: it already reads as a subject line, and appending
    // the sender gave "New invoice — Round 2 sampling — Source Archive",
    // which is two dashes and a word the From field already says.
    subject: input.headline,
    html: shell(
      h1("There's been an update in your portal") +
        p(`<strong style="color:${INK};font-weight:600;">${esc(input.headline)}</strong>`) +
        (input.detail ? p(esc(input.detail)) : "") +
        `<div style="margin-top:16px;">${button(input.portalUrl, input.linkLabel ?? "Open your portal")}</div>` +
        signoff(),
      "You're getting this because you're working with Source Archive. Tell us any time if you'd rather not.",
    ),
    text:
      `There's been an update in your portal.\n\n` +
      `${input.headline}\n` +
      (input.detail ? `${input.detail}\n` : "") +
      `\n${input.linkLabel ?? "Open your portal"}: ${input.portalUrl}` +
      SIGNOFF_TEXT,
  };
}

// ── Alerts to the team ────────────────────────────────────────

/**
 * Something happened on the client's side that you'd want to know about.
 *
 * The portal told clients "your agency will be notified" and then notified
 * nobody. These are the messages that make that sentence true. Deliberately
 * plain — they exist to get you to the thing, not to be read for their own
 * sake, so the quote from the client is the body and everything else is a
 * link.
 */
export function agencyAlert(input: {
  headline: string;
  who: string;
  quote?: string | null;
  url: string;
  linkLabel?: string;
}): Built {
  return {
    subject: input.headline,
    html: shell(
      h1(input.headline) +
        p(`From <strong style="color:${INK};font-weight:600;">${esc(input.who)}</strong>.`) +
        (input.quote
          ? `<div style="border-left:2px solid ${RULE};padding:2px 0 2px 12px;margin:14px 0;font-size:14px;line-height:1.6;color:${MUTED};white-space:pre-line;">${esc(input.quote)}</div>`
          : "") +
        `<div style="margin-top:16px;">${button(input.url, input.linkLabel ?? "Open it")}</div>`,
      "Sent to you because you're an admin on Source Archive.",
    ),
    text:
      `${input.headline}\n\nFrom ${input.who}.\n` +
      (input.quote ? `\n${input.quote}\n` : "") +
      `\n${input.linkLabel ?? "Open it"}: ${input.url}`,
  };
}

// ── To the client ─────────────────────────────────────────────

/**
 * "Your portal is ready."
 *
 * Turning a portal on used to flip a flag and tell nobody, so the client
 * only found out if someone remembered to send the link by hand. Says what
 * the portal is for before it says how to reach it — a bare link to a
 * website nobody mentioned reads like phishing.
 */
export function portalInvite(input: {
  contactName: string;
  clientName: string;
  portalUrl: string;
}): Built {
  const first = input.contactName.trim().split(/\s+/)[0];
  return {
    subject: `Your ${input.clientName} portal is ready`,
    html: shell(
      h1(first ? `Hi ${first} — your portal is ready` : "Your portal is ready") +
        p("We've set up a space for your work with us. It's where you'll find your products as they move through development, samples to approve, invoices, and anywhere we need something from you.") +
        p("Nothing to install and no password to remember — the link below is yours, so keep it somewhere you'll find it again.") +
        `<div style="margin-top:16px;">${button(input.portalUrl, "Open your portal")}</div>` +
        signoff(),
      "You're getting this because you're working with Source Archive.",
    ),
    text:
      `${first ? `Hi ${first} — your portal is ready.` : "Your portal is ready."}\n\n` +
      `We've set up a space for your work with us. It's where you'll find your products as they ` +
      `move through development, samples to approve, invoices, and anywhere we need something from ` +
      `you.\n\n` +
      `Nothing to install and no password to remember — the link below is yours, so keep it ` +
      `somewhere you'll find it again.\n\n` +
      `Open your portal: ${input.portalUrl}` +
      SIGNOFF_TEXT,
  };
}

/**
 * "A sample is waiting for you."
 *
 * Unapproved samples are the single most common thing holding a run up,
 * and the portal only showed it to people who happened to look. Says what
 * happens next if they approve, because "please review" without a
 * consequence is easy to leave until tomorrow.
 */
export function approvalRequested(input: {
  productName: string;
  clientName: string;
  note?: string | null;
  portalUrl: string;
}): Built {
  return {
    subject: `${input.productName} — ready for your approval`,
    html: shell(
      h1(`${input.productName} is ready for you to look at`) +
        p("The sample is in your portal. Once you approve it we can move into production; if something isn't right, leave a note instead and we'll pick it up from there.") +
        (input.note
          ? `<div style="border-left:2px solid ${RULE};padding:2px 0 2px 12px;margin:14px 0;font-size:14px;line-height:1.6;color:${MUTED};">${esc(input.note)}</div>`
          : "") +
        `<div style="margin-top:16px;">${button(input.portalUrl, "Review the sample")}</div>` +
        signoff(),
      "You're getting this because you're working with Source Archive.",
    ),
    text:
      `${input.productName} is ready for you to look at.\n\n` +
      `The sample is in your portal. Once you approve it we can move into production; if something ` +
      `isn't right, leave a note instead and we'll pick it up from there.\n` +
      (input.note ? `\n${input.note}\n` : "") +
      `\nReview the sample: ${input.portalUrl}` +
      SIGNOFF_TEXT,
  };
}

// ── The morning digest ────────────────────────────────────────

export interface DigestQueue {
  label: string;
  tone: string;
  stake: string;
  total: number;
  items: Array<{
    title: string;
    subtitle: string | null;
    age: string | null;
    urgency: string;
    href: string;
    /** Where to go to put the whole project aside, when it has one. */
    parkUrl?: string | null;
  }>;
}

export interface DigestInvoice {
  id: string;
  /** The raw figure, so the digest can total its own list. */
  amountValue: number;
  title: string;
  clientName: string;
  amount: string;
  age: string | null;
  chaseUrl: string;
  /** Where to go to set it aside, for when chasing is not the answer. */
  parkUrl?: string | null;
}

const URGENCY_TONE: Record<string, string> = {
  overdue: "#B4453C",
  today: "#B07A17",
  soon: "#0058B0",
  waiting: "#6E6E73",
};

/**
 * One email a day with everything on it.
 *
 * The dashboard already worked out what needs doing; the problem was that
 * it only existed if somebody opened it, and eighteen unanswered leads is
 * what that costs. So this is the same queues, pushed rather than pulled.
 *
 * One email, not one per queue — the fastest way to make a daily message
 * ignorable is to send four of them. Queues with nothing in them are left
 * out entirely, so a quiet day produces a short email rather than a wall
 * of zeros, and the day it gets long is the day it earns attention.
 *
 * Invoices get their own section with a chase link each, because chasing
 * is a judgement call: someone who said they'd pay Friday should not be
 * chased on Wednesday, and an automatic reminder cannot know that.
 */
export function dailyDigest(input: {
  greeting: string;
  needsYou: number;
  owed: string;
  queues: DigestQueue[];
  invoices: DigestInvoice[];
  shootsTomorrow: number;
  dashboardUrl: string;
}): Built {
  const quiet = input.needsYou === 0 && input.invoices.length === 0;

  const queueHtml = input.queues
    .map(
      (q) =>
        section(
          `${q.label} (${q.total})`,
          q.items
            .map(
              (it) =>
                `<div style="margin:0 0 9px;">` +
                `<a href="${esc(it.href)}" style="font-size:14px;color:${INK};text-decoration:none;font-weight:500;">${esc(it.title)}</a>` +
                `<span style="font-size:12px;color:${URGENCY_TONE[it.urgency] ?? MUTED};"> &middot; ${esc(it.urgency)}</span>` +
                (it.subtitle ? `<div style="font-size:12.5px;color:${MUTED};">${esc(it.subtitle)}${it.age ? ` &middot; ${esc(it.age)}` : ""}</div>` : "") +
                (it.parkUrl
                  ? `<a href="${esc(it.parkUrl)}" style="font-size:11.5px;color:${MUTED};text-decoration:none;">Park this project &rarr;</a>`
                  : "") +
                `</div>`,
            )
            .join("") +
            (q.total > q.items.length
              ? `<div style="font-size:12px;color:${MUTED};margin-top:6px;">and ${q.total - q.items.length} more</div>`
              : ""),
        ),
    )
    .join("");

  const invoiceHtml = input.invoices.length
    ? section(
        `Unpaid invoices (${input.invoices.length})`,
        input.invoices
          .map(
            (inv) =>
              `<div style="border:1px solid ${RULE};border-radius:10px;padding:12px;margin-bottom:8px;">` +
              `<div style="font-size:14px;font-weight:600;color:${INK};">${esc(inv.clientName)} &middot; ${esc(inv.amount)}</div>` +
              `<div style="font-size:12.5px;color:${MUTED};margin-top:2px;">${esc(inv.title)}${inv.age ? ` &middot; sent ${esc(inv.age)}` : ""}</div>` +
              `<a href="${esc(inv.chaseUrl)}" style="display:inline-block;margin-top:9px;font-size:13px;color:${ACCENT};text-decoration:none;">Chase this invoice &rarr;</a>` +
              (inv.parkUrl
                ? `<a href="${esc(inv.parkUrl)}" style="display:inline-block;margin:9px 0 0 14px;font-size:13px;color:${MUTED};text-decoration:none;">Stop chasing &rarr;</a>`
                : "") +
              `</div>`,
          )
          .join("") +
          `<div style="font-size:12px;color:${MUTED};margin-top:4px;">Every link here opens the app and asks first — nothing sends or changes from this email.</div>`,
      )
    : "";

  return {
    subject: quiet
      ? "Nothing waiting on you today"
      : `${input.needsYou} thing${input.needsYou === 1 ? "" : "s"} need you${input.invoices.length ? ` · ${input.owed} owed` : ""}`,
    html: shell(
      h1(input.greeting) +
        (quiet
          ? p("Nothing is waiting on you and no invoices are outstanding. Enjoy it.")
          : p(
              `<strong style="color:${INK};font-weight:600;">${input.needsYou}</strong> thing${input.needsYou === 1 ? "" : "s"} need you today` +
                (input.invoices.length ? `, and <strong style="color:${INK};font-weight:600;">${esc(input.owed)}</strong> is outstanding.` : "."),
            )) +
        (input.shootsTomorrow > 0
          ? p(`<strong style="color:${INK};font-weight:600;">${input.shootsTomorrow} shoot${input.shootsTomorrow === 1 ? "" : "s"} tomorrow.</strong>`)
          : "") +
        invoiceHtml +
        queueHtml +
        `<div style="margin-top:20px;">${button(input.dashboardUrl, "Open the dashboard")}</div>`,
      "Your daily summary from Source Archive.",
    ),
    text:
      `${input.greeting}\n\n` +
      (quiet
        ? "Nothing is waiting on you and no invoices are outstanding.\n"
        : `${input.needsYou} thing${input.needsYou === 1 ? "" : "s"} need you today` +
          (input.invoices.length ? `, and ${input.owed} is outstanding.\n` : ".\n")) +
      (input.shootsTomorrow > 0 ? `${input.shootsTomorrow} shoot(s) tomorrow.\n` : "") +
      (input.invoices.length
        ? `\nUNPAID INVOICES (${input.invoices.length})\n` +
          input.invoices
            .map(
              (inv) =>
                `  ${inv.clientName} · ${inv.amount} — ${inv.title}${inv.age ? ` (sent ${inv.age})` : ""}\n` +
                `    Chase: ${inv.chaseUrl}` +
                (inv.parkUrl ? `\n    Stop chasing: ${inv.parkUrl}` : ""),
            )
            .join("\n") +
          `\n`
        : "") +
      input.queues
        .map(
          (q) =>
            `\n${q.label.toUpperCase()} (${q.total})\n` +
            q.items
              .map(
                (it) =>
                  `  · ${it.title}${it.subtitle ? ` — ${it.subtitle}` : ""} [${it.urgency}]` +
                  (it.parkUrl ? `\n      Park the project: ${it.parkUrl}` : ""),
              )
              .join("\n") +
            (q.total > q.items.length ? `\n  and ${q.total - q.items.length} more` : ""),
        )
        .join("\n") +
      `\n\nOpen the dashboard: ${input.dashboardUrl}`,
  };
}

/**
 * The chase itself — a draft, like every other reply we send by hand.
 *
 * Firm without being a solicitor's letter: it states the fact, gives the
 * link to pay, and asks for a date if a date is the problem. Asking is
 * what turns an ignored reminder into a reply.
 */
export function invoiceChaseDraft(input: {
  contactName: string;
  clientName: string;
  invoiceTitle: string;
  amount: string;
  age: string | null;
  portalUrl: string;
}): Draft {
  const first = input.contactName.trim().split(/\s+/)[0];
  return {
    subject: `${input.invoiceTitle} — still outstanding`,
    body:
      `${first ? `Hi ${first},` : "Hello,"}\n\n` +
      `Just a note that ${input.invoiceTitle} for ${input.amount} is still showing as unpaid` +
      (input.age ? ` — it went out ${input.age}` : "") +
      `.\n\n` +
      `You can settle it in your portal here:\n${input.portalUrl}\n\n` +
      `If it's already gone out at your end, ignore this and let us know so we can mark it off. ` +
      `And if it's a timing thing, just tell us when works — we'd rather know than chase.\n\n` +
      `Best,\nSource Archive team`,
  };
}
