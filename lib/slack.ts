// ─────────────────────────────────────────────────────────────
// Slack.
//
// An incoming webhook is the whole integration: one POST, no OAuth, no
// app review, no tokens to refresh. It cannot read anything and cannot
// act on your workspace, which for "tell me when something happens" is
// exactly the right amount of access to hand over.
//
// Silent when SLACK_WEBHOOK_URL is unset, and never throws — a
// notification failing must not take down the thing it was reporting.
// ─────────────────────────────────────────────────────────────

export interface SlackBlock {
  title: string;
  body?: string;
  fields?: Array<[string, string]>;
  url?: string;
  urlLabel?: string;
}

export function slackConfigured(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL);
}

export async function notifySlack(message: SlackBlock): Promise<boolean> {
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (!hook) return false;

  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: `*${escape(message.title)}*` } },
  ];

  if (message.body) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: escape(message.body) } });
  }

  if (message.fields?.length) {
    blocks.push({
      type: "section",
      fields: message.fields.slice(0, 10).map(([k, v]) => ({
        type: "mrkdwn",
        text: `*${escape(k)}*\n${escape(v)}`,
      })),
    });
  }

  if (message.url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: message.urlLabel ?? "Open" },
          url: message.url,
        },
      ],
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(hook, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.title, blocks }),
    });
    clearTimeout(timer);
    return res.ok;
  } catch (err) {
    console.error("[slack] notification failed:", err);
    return false;
  }
}

/** Slack's mrkdwn takes these three literally; everything else is fine. */
function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
