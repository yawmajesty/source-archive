// ─────────────────────────────────────────────────────────────
// The play catalogue.
//
// A blank campaign is a blank page, and a blank page is why marketing
// plans don't get made. This is a library of things that actually work,
// filed by where in a drop they belong, so building a campaign is
// picking from options rather than inventing from nothing.
//
// Every play carries a `why`. A brand owner who understands why a play
// works can adapt it; one who only has the title copies it badly.
// ─────────────────────────────────────────────────────────────

import type { Phase } from "./shoots";

export type Effort = "low" | "medium" | "high";

export interface Play {
  id: string;
  phase: Phase;
  title: string;
  /** What you actually make. */
  what: string;
  /** Why it works — the part that lets someone adapt it. */
  why: string;
  channels: string[];
  format: string;
  effort: Effort;
}

export const EFFORT_LABEL: Record<Effort, string> = {
  low: "Quick",
  medium: "Half a day",
  high: "A real job",
};

export const PLAYS: Play[] = [
  // ── Teaser ────────────────────────────────────────────────
  {
    id: "teaser-fabric",
    phase: "teaser", title: "Fabric, extreme close-up",
    what: "One macro shot of the cloth. No garment, no caption explaining it.",
    why: "Curiosity without information. People who care about make will stop; the algorithm reads the dwell time.",
    channels: ["instagram", "tiktok"], format: "Post", effort: "low",
  },
  {
    id: "teaser-cutting",
    phase: "teaser", title: "Cutting room footage",
    what: "30 seconds of the pattern being cut, no voiceover.",
    why: "Process is the cheapest content a brand owns and the hardest for a competitor to fake.",
    channels: ["tiktok", "instagram"], format: "Reel", effort: "low",
  },
  {
    id: "teaser-date-tease",
    phase: "teaser", title: "A date, nothing else",
    what: "Plain type on the brand colour. Just the date.",
    why: "Costs nothing, gets saved, and gives the people already watching something to hold.",
    channels: ["instagram"], format: "Story", effort: "low",
  },
  {
    id: "teaser-list",
    phase: "teaser", title: "Something's coming",
    what: "One short email. No product, no date, no link.",
    why: "Re-warms a list before you need it. Sending cold to a quiet list on launch day is how you land in spam.",
    channels: ["email"], format: "Email", effort: "low",
  },
  {
    id: "teaser-poll",
    phase: "teaser", title: "Colourway poll",
    what: "Two colourways, let them pick.",
    why: "Turns an audience into participants, and tells you which to make more of.",
    channels: ["instagram"], format: "Story poll", effort: "low",
  },

  // ── Pre-drop ──────────────────────────────────────────────
  {
    id: "pre-reveal",
    phase: "pre_drop", title: "Full reveal",
    what: "The hero image, the date, and what it is.",
    why: "The pivot from mystery to intent. Everything before builds attention; this converts it to a diary entry.",
    channels: ["instagram", "email"], format: "Carousel", effort: "medium",
  },
  {
    id: "pre-waitlist",
    phase: "pre_drop", title: "Waitlist with early access",
    what: "A sign-up that genuinely gets in first, by an hour or a day.",
    why: "Trades an email address for a real advantage. It also tells you demand before you commit stock.",
    channels: ["email", "website"], format: "Landing page", effort: "medium",
  },
  {
    id: "pre-making",
    phase: "pre_drop", title: "How it was made",
    what: "Cut from the production log — pattern, cutting, sewing, in order.",
    why: "Justifies the price before anyone sees it. Cheaper than discounting and it doesn't train people to wait.",
    channels: ["tiktok", "instagram", "website"], format: "Reel", effort: "medium",
  },
  {
    id: "pre-seeding",
    phase: "pre_drop", title: "Seed it early",
    what: "Send samples to ten people who'd wear it anyway. No brief, no contract.",
    why: "Organic posts on launch day look like a movement. Paid ones look like an ad.",
    channels: ["influencer"], format: "Gifting", effort: "medium",
  },
  {
    id: "pre-fitguide",
    phase: "pre_drop", title: "Sizing and fit, in advance",
    what: "Measurements, model heights and sizes, how it runs.",
    why: "The single biggest cause of returns is fit surprise. Answering it before the sale is cheaper than a refund.",
    channels: ["website", "instagram"], format: "Carousel", effort: "low",
  },
  {
    id: "pre-press",
    phase: "pre_drop", title: "Press and stockist outreach",
    what: "A short note plus the lookbook to anyone who might carry or cover it.",
    why: "Editorial lead times are weeks. Ask on launch day and you've missed the issue.",
    channels: ["pr"], format: "Email", effort: "high",
  },

  // ── Launch week ───────────────────────────────────────────
  {
    id: "launch-live-email",
    phase: "launch_week", title: "It's live",
    what: "Sent the hour it drops. Waitlist first, everyone else an hour later.",
    why: "Email still converts better than every social channel combined. Honour the waitlist or it means nothing next time.",
    channels: ["email"], format: "Email", effort: "low",
  },
  {
    id: "launch-carousel",
    phase: "launch_week", title: "Launch carousel",
    what: "Hero, on-model, detail, flat lay. In that order.",
    why: "The order is the argument: desire, fit, quality, honesty. Skipping the flat lay reads as hiding something.",
    channels: ["instagram"], format: "Carousel", effort: "low",
  },
  {
    id: "launch-sms",
    phase: "launch_week", title: "Drop alert",
    what: "One line, one link, opt-ins only.",
    why: "Near-total open rate, and near-total unsubscribe if you use it twice in a week.",
    channels: ["sms"], format: "SMS", effort: "low",
  },
  {
    id: "launch-prospecting",
    phase: "launch_week", title: "Prospecting ads",
    what: "Your best-performing organic asset, widened to a lookalike audience.",
    why: "Let the organic feed pick the creative. Testing new creative and a new audience at once tells you nothing.",
    channels: ["paid_social"], format: "Ad set", effort: "medium",
  },
  {
    id: "launch-founder",
    phase: "launch_week", title: "Founder to camera",
    what: "Ninety seconds on why this exists. Unpolished on purpose.",
    why: "Small brands win on being a person. This is the post that outperforms and nobody wants to film.",
    channels: ["tiktok", "instagram"], format: "Reel", effort: "low",
  },
  {
    id: "launch-styling",
    phase: "launch_week", title: "Three ways to wear it",
    what: "The same piece, three outfits.",
    why: "Sells the wardrobe rather than the item, and answers 'what would I wear it with' before it's asked.",
    channels: ["instagram", "email"], format: "Carousel", effort: "medium",
  },
  {
    id: "launch-live",
    phase: "launch_week", title: "Live Q&A",
    what: "Half an hour answering fit and fabric questions in real time.",
    why: "Converts the hesitant. The questions asked are also next quarter's FAQ page.",
    channels: ["instagram", "tiktok"], format: "Live", effort: "medium",
  },

  // ── Post-launch ───────────────────────────────────────────
  {
    id: "post-worn",
    phase: "post_launch", title: "Worn in the world",
    what: "Customer photos, reposted with permission.",
    why: "Proof it exists off a model. The strongest thing you can show and the cheapest to make.",
    channels: ["instagram"], format: "Story / post", effort: "low",
  },
  {
    id: "post-review",
    phase: "post_launch", title: "Ask for reviews",
    what: "A short email two weeks after delivery, when they've actually worn it.",
    why: "Two weeks, not two days. A review written before wearing it is worthless to the next buyer.",
    channels: ["email"], format: "Email", effort: "low",
  },
  {
    id: "post-behind",
    phase: "post_launch", title: "Behind the shoot",
    what: "Offcuts from the campaign shoot you've already paid for.",
    why: "Free content. You commissioned a day of a photographer's time and used four frames of it.",
    channels: ["instagram", "tiktok"], format: "Reel", effort: "low",
  },
  {
    id: "post-journal",
    phase: "post_launch", title: "Journal entry",
    what: "Long form on the making, the mill, the thinking.",
    why: "Works for search long after the feed forgets, and gives every future email something to link to.",
    channels: ["website"], format: "Article", effort: "high",
  },
  {
    id: "post-restock",
    phase: "post_launch", title: "Sold-out sizes",
    what: "Say which sizes have gone, honestly.",
    why: "Real scarcity converts. Invented scarcity gets found out and costs you the list.",
    channels: ["instagram", "email"], format: "Story", effort: "low",
  },

  // ── Remarketing ───────────────────────────────────────────
  {
    id: "re-viewed",
    phase: "remarketing", title: "Viewed, didn't buy",
    what: "Dynamic ads showing the exact product they looked at.",
    why: "The warmest audience you will ever have. They've already decided they like it.",
    channels: ["paid_social"], format: "Dynamic ad", effort: "medium",
  },
  {
    id: "re-basket",
    phase: "remarketing", title: "Abandoned basket",
    what: "One reminder at four hours. Then stop.",
    why: "One is a service. Two is a nuisance. Three is an unsubscribe.",
    channels: ["email"], format: "Automation", effort: "medium",
  },
  {
    id: "re-backinstock",
    phase: "remarketing", title: "Back in stock",
    what: "Only to people who asked to be told.",
    why: "Highest-converting email a brand sends, because they opted into exactly this.",
    channels: ["email", "sms"], format: "Automation", effort: "medium",
  },
  {
    id: "re-objection",
    phase: "remarketing", title: "Answer the objection",
    what: "An ad that addresses the reason they didn't buy — price, fit, or shipping.",
    why: "Retargeting the same image they already ignored just annoys them. Say something new.",
    channels: ["paid_social"], format: "Ad", effort: "medium",
  },
  {
    id: "re-crosssell",
    phase: "remarketing", title: "Goes with what they bought",
    what: "To buyers only: the piece that completes the outfit.",
    why: "A second purchase from an existing customer costs a fraction of a first from a stranger.",
    channels: ["email"], format: "Email", effort: "low",
  },
  {
    id: "re-winback",
    phase: "remarketing", title: "Lapsed customer win-back",
    what: "To people who bought once and haven't since.",
    why: "Cheaper than acquisition and it tells you whether the first purchase was a fluke.",
    channels: ["email"], format: "Email", effort: "low",
  },

  // ── Always on ─────────────────────────────────────────────
  {
    id: "ao-weekly",
    phase: "always_on", title: "One product, shot well, weekly",
    what: "A single garment, properly photographed, every week.",
    why: "Consistency beats intensity. A feed that goes quiet between drops has to buy its audience back each time.",
    channels: ["instagram"], format: "Post", effort: "low",
  },
  {
    id: "ao-process",
    phase: "always_on", title: "Process content",
    what: "Cutting, sewing, fabric arriving. Filmed on a phone.",
    why: "The making is the content. It costs nothing because the work happens anyway.",
    channels: ["tiktok", "instagram"], format: "Reel", effort: "low",
  },
  {
    id: "ao-newsletter",
    phase: "always_on", title: "Monthly newsletter",
    what: "What you've been working on. Not a sale.",
    why: "Keeps a list warm so launch emails land. A list only mailed when you want money stops opening.",
    channels: ["email"], format: "Email", effort: "medium",
  },
  {
    id: "ao-seeding",
    phase: "always_on", title: "Ongoing seeding",
    what: "Send product monthly to people who'd wear it anyway.",
    why: "Compounds. A relationship built between launches is worth more than one bought during.",
    channels: ["influencer"], format: "Gifting", effort: "medium",
  },
  {
    id: "ao-ugc",
    phase: "always_on", title: "Repost customers",
    what: "Anything a customer posts, reshared same day.",
    why: "Costs nothing, and being reposted is why the next customer posts.",
    channels: ["instagram"], format: "Story", effort: "low",
  },
  {
    id: "ao-community",
    phase: "always_on", title: "Answer every comment",
    what: "Reply to all of them, in the brand's voice, within a day.",
    why: "Unglamorous, and the highest-leverage thing a small brand does. Reach follows replies.",
    channels: ["instagram", "tiktok"], format: "Community", effort: "low",
  },
];

export function playsFor(phase: Phase): Play[] {
  return PLAYS.filter((p) => p.phase === phase);
}

export function playById(id: string): Play | undefined {
  return PLAYS.find((p) => p.id === id);
}

export const EFFORT_TONE: Record<Effort, string> = {
  low: "#1E8E4E",
  medium: "#B07A17",
  high: "#B4453C",
};
