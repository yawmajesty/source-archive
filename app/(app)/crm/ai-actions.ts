"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getAgencyContext } from "@/lib/agency-data";
import { can } from "@/lib/permissions";
import { getClientTimeline } from "./actions";
import { STAGE_LABEL } from "@/lib/stages";
import { getAgencySupabase } from "@/lib/supabase-agency";

/**
 * The AI half of the CRM.
 *
 * Both calls are given the same thing: a plain-text digest of what has
 * actually happened with this client. Nothing is invented for the model
 * to work from, and nothing it returns is written anywhere — a draft
 * lands in the compose box for a person to edit and send, and a summary
 * is read on screen. It never sends, and it never files anything.
 */

function client(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new Anthropic({ apiKey: key }) : null;
}

async function briefFor(clientId: string): Promise<{ name: string; digest: string } | null> {
  const supabase = await getAgencySupabase();
  const { data: clientRow } = await supabase
    .from("clients")
    .select("name, status, country, industry, crm_notes, next_follow_up_at, follow_up_note")
    .eq("id", clientId)
    .maybeSingle();
  const c = clientRow as Record<string, string | null> | null;
  if (!c) return null;

  const { data: projects } = await supabase.from("projects").select("id, name").eq("client_id", clientId);
  const projectIds = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);

  let productLines: string[] = [];
  if (projectIds.length) {
    const { data: products } = await supabase
      .from("products").select("name, stage").in("project_id", projectIds).limit(40);
    productLines = ((products ?? []) as Array<{ name: string | null; stage: string | null }>).map(
      (p) => `- ${p.name ?? "Unnamed"} — ${STAGE_LABEL[p.stage ?? ""] ?? p.stage ?? "no stage"}`,
    );
  }

  const timeline = await getClientTimeline(clientId, 30);
  const history = timeline.map((t) => {
    const when = new Date(t.at).toISOString().slice(0, 10);
    return `- ${when} [${t.source}] ${t.title}${t.detail ? ` — ${t.detail}` : ""}`;
  });

  const digest = [
    `Client: ${c.name}`,
    c.status ? `Relationship status: ${c.status}` : null,
    c.country ? `Country: ${c.country}` : null,
    c.industry ? `Industry: ${c.industry}` : null,
    c.crm_notes ? `Our notes: ${c.crm_notes}` : null,
    c.next_follow_up_at ? `Follow-up set for ${c.next_follow_up_at}: ${c.follow_up_note ?? ""}` : null,
    "",
    productLines.length ? `Their products and where each has got to:\n${productLines.join("\n")}` : "No products yet.",
    "",
    history.length ? `Recent history, newest first:\n${history.join("\n")}` : "Nothing logged yet.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { name: c.name ?? "this client", digest };
}

export async function summariseRelationship(
  clientId: string,
): Promise<{ success: true; text: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };

  const anthropic = client();
  if (!anthropic) return { success: false, error: "AI isn't configured — ANTHROPIC_API_KEY is missing." };

  const brief = await briefFor(clientId);
  if (!brief) return { success: false, error: "Client not found" };

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 600,
      system:
        "You brief the head of a garment sourcing agency before they contact a client. " +
        "Write 3-5 short sentences covering where the work stands, anything waiting on us, " +
        "anything waiting on them, and what to raise next. Plain British English, no headings, " +
        "no bullet points, no preamble. Say only what the record supports — if something is " +
        "unclear or missing, say so rather than guessing.",
      messages: [{ role: "user", content: brief.digest }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { success: true, text };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "The AI call failed" };
  }
}

export async function draftFollowUp(
  clientId: string,
  instruction?: string,
): Promise<{ success: true; subject: string; body: string } | { success: false; error: string }> {
  const ctx = await getAgencyContext();
  if (!ctx) return { success: false, error: "Not a member of any agency" };
  if (!can(ctx.role, ctx.permissions, "client.edit")) {
    return { success: false, error: "You don't have permission to contact clients" };
  }

  const anthropic = client();
  if (!anthropic) return { success: false, error: "AI isn't configured — ANTHROPIC_API_KEY is missing." };

  const brief = await briefFor(clientId);
  if (!brief) return { success: false, error: "Client not found" };

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 700,
      system:
        "You draft emails from a garment sourcing agency to a brand they work with. " +
        "Warm, direct, British English. No marketing voice, no exclamation marks, no 'I hope this " +
        "email finds you well'. Refer only to things the record actually shows — never invent a " +
        "date, a price, a delivery promise or a detail that isn't there. Leave [square brackets] " +
        "where a person must fill something in. " +
        "Reply as exactly two lines:\nSUBJECT: <the subject>\nthen a blank line, then the body.",
      messages: [
        {
          role: "user",
          content:
            `${brief.digest}\n\n---\n` +
            (instruction?.trim()
              ? `Write an email to this client. What it needs to do: ${instruction.trim()}`
              : "Write a short follow-up email to this client, appropriate to where things stand."),
        },
      ],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const match = text.match(/^SUBJECT:\s*(.+?)\n([\s\S]*)$/);
    if (!match) return { success: true, subject: `${brief.name} — an update`, body: text };
    return { success: true, subject: match[1].trim(), body: match[2].trim() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "The AI call failed" };
  }
}
