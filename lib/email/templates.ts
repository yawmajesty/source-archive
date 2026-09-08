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
        ]),
      "You're getting this because you submitted a brief at Source Archive.",
    ),
    text:
      `Thanks, ${first} — we've got it.\n\n` +
      `Your brief has landed with us and someone will read it properly rather than skim it. ` +
      `Expect to hear back within two working days.\n\n` +
      `If you think of anything else in the meantime, just reply to this email.\n\n` +
      textRows([["Brand", input.companyName], ["What you're making", input.productSummary]]),
  };
}

export function briefReceivedAdmin(input: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  country?: string | null;
  budget?: string | null;
  timeline?: string | null;
  productSummary?: string | null;
  message?: string | null;
  leadsUrl: string;
}): Built {
  return {
    subject: `New brief — ${input.companyName}`,
    html: shell(
      h1(`New brief from ${esc(input.companyName)}`) +
        p(`${esc(input.contactName)} &lt;${esc(input.contactEmail)}&gt; just submitted the brief form.`) +
        detailRows([
          ["Contact", `${input.contactName} · ${input.contactEmail}`],
          ["Country", input.country],
          ["Products", input.productSummary],
          ["Budget", input.budget],
          ["Timeline", input.timeline],
          ["Message", input.message],
        ]) +
        `<div style="margin-top:16px;">${button(input.leadsUrl, "Open in Leads")}</div>`,
      "Sent to you because you're an admin on Source Archive.",
    ),
    text:
      `New brief from ${input.companyName}\n\n` +
      textRows([
        ["Contact", `${input.contactName} · ${input.contactEmail}`],
        ["Country", input.country],
        ["Products", input.productSummary],
        ["Budget", input.budget],
        ["Timeline", input.timeline],
        ["Message", input.message],
      ]) +
      `\n\nOpen in Leads: ${input.leadsUrl}`,
  };
}

export function enquiryReceivedClient(input: { contactName: string }): Built {
  const first = input.contactName.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Thanks for getting in touch",
    html: shell(
      h1(`Thanks, ${esc(first)}`) +
        p("We've got your message and someone will come back to you shortly. Reply to this email if you want to add anything."),
      "You're getting this because you contacted Source Archive.",
    ),
    text: `Thanks, ${first}.\n\nWe've got your message and someone will come back to you shortly. Reply to this email if you want to add anything.`,
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
        detailRows([["Garment", input.garment]]),
      "You're getting this because you requested a tech pack from Source Archive.",
    ),
    text: `Thanks, ${first}.\n\nWe've got your tech pack request. We'll review the details and come back to you with next steps and a quote.\n\n${textRows([["Garment", input.garment]])}`,
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
        `<div style="margin-top:16px;">${button(input.portalUrl, "See it in your portal")}</div>`,
      "You're getting this because you're working with Source Archive. Tell us any time if you'd rather not.",
    ),
    text:
      `${input.productName} — ${label}\n\n${sentence}\n` +
      (input.note ? `\n${input.note}\n` : "") +
      `\nSee it in your portal: ${input.portalUrl}`,
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
