// ─────────────────────────────────────────────────────────────
// "There's been an update in your portal."
//
// A client should not have to remember to check a website to find out an
// invoice is waiting for them. Anything that changes what they can see is
// worth one short email with a link.
//
// One helper rather than a template per event, because the only thing that
// varies is the sentence — and writing that sentence at the call site is
// what keeps these from becoming the sort of notification people filter.
// ─────────────────────────────────────────────────────────────

import { sendAll, clientRecipients } from "./send";
import { portalUpdate } from "./templates";
import { buildPublicUrl } from "@/lib/url";

export async function notifyPortalUpdate(input: {
  agencyId: string;
  clientId: string;
  /** What happened, in a few words: "Invoice sent — Round 2 Sampling". */
  headline: string;
  /** Optional second line: amounts, dates, anything that saves a click. */
  detail?: string | null;
  linkLabel?: string;
  relatedId?: string | null;
}): Promise<void> {
  try {
    const { emails, enabled } = await clientRecipients(input.clientId);
    // A client who asked to be left alone, or one with no address on file.
    if (!enabled || emails.length === 0) return;

    const built = portalUpdate({
      headline: input.headline,
      detail: input.detail ?? null,
      portalUrl: buildPublicUrl(`/portal/${input.clientId}`),
      linkLabel: input.linkLabel,
    });

    await sendAll(
      emails.map((to) => ({
        agencyId: input.agencyId,
        to,
        subject: built.subject,
        html: built.html,
        text: built.text,
        template: "portal_update" as const,
        relatedType: "client" as const,
        relatedId: input.relatedId ?? input.clientId,
      })),
    );
  } catch (err) {
    // Never let a notification failure look like the action failing. Sending
    // an invoice that the client cannot be told about is still a sent invoice.
    console.error("[portal] update notification failed:", err);
  }
}

/**
 * Tell the team something happened on the client's side.
 *
 * The mirror of notifyPortalUpdate. Goes to the agency's notification
 * address, or its admins when none is set — the same resolution the intake
 * forms use, so there is one answer to "who hears about this".
 *
 * Swallows its own failures for the same reason: a client approving a
 * sample must not fail because our mail provider is having a morning.
 */
export async function notifyAgency(input: {
  agencyId: string;
  headline: string;
  who: string;
  quote?: string | null;
  url: string;
  linkLabel?: string;
  relatedType?: "lead" | "product" | "client" | null;
  relatedId?: string | null;
}): Promise<void> {
  try {
    const { agencyAlert } = await import("./templates");
    const { agencyNotificationRecipients } = await import("./send");
    const to = await agencyNotificationRecipients(input.agencyId);
    if (to.length === 0) return;

    const { notifySlack } = await import("@/lib/slack");
    await notifySlack({
      title: input.headline,
      body: input.quote ?? undefined,
      fields: [["From", input.who]],
      url: input.url,
      urlLabel: input.linkLabel ?? "Open it",
    });

    const built = agencyAlert({
      headline: input.headline,
      who: input.who,
      quote: input.quote ?? null,
      url: input.url,
      linkLabel: input.linkLabel,
    });

    await sendAll(
      to.map((address) => ({
        agencyId: input.agencyId,
        to: address,
        subject: built.subject,
        html: built.html,
        text: built.text,
        template: "agency_alert" as const,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
      })),
    );
  } catch (err) {
    console.error("[agency] alert failed:", err);
  }
}
