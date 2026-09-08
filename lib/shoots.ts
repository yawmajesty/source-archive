// ─────────────────────────────────────────────────────────────
// Shoot briefs and marketing plans.
//
// The defaults here are the point. A brand owner opening a blank shoot
// brief doesn't know what a photographer needs to be told, and a blank
// form teaches them nothing. Starting from a real ecom shot list and a
// real launch cadence means the first useful version is an edit rather
// than an authoring job.
// ─────────────────────────────────────────────────────────────

export type ShootType = "ecom" | "campaign" | "lookbook" | "video" | "social";
export type ShootStatus = "planning" | "booked" | "shot" | "delivered" | "cancelled";
export type Medium = "photo" | "video";

export const SHOOT_TYPES: { id: ShootType; label: string; hint: string }[] = [
  { id: "ecom",     label: "E-commerce", hint: "Product shots for the website — consistent, repeatable" },
  { id: "campaign", label: "Campaign",   hint: "The season's image. Mood over completeness" },
  { id: "lookbook", label: "Lookbook",   hint: "Full looks, styled as they'd be worn" },
  { id: "video",    label: "Video",      hint: "Motion-led: ads, reels, behind the scenes" },
  { id: "social",   label: "Social",     hint: "Fast, native content for the feed" },
];

export const SHOOT_STATUSES: { id: ShootStatus; label: string }[] = [
  { id: "planning",  label: "Planning" },
  { id: "booked",    label: "Booked" },
  { id: "shot",      label: "Shot" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

/**
 * What a reference image is an example OF.
 *
 * "Show me the lighting you mean" and "show me the hair you mean" are
 * different conversations, and a single undifferentiated pile of
 * inspiration images is how a photographer ends up guessing.
 */
export const REFERENCE_SLOTS: { id: string; label: string; hint: string }[] = [
  { id: "photo_style",  label: "Photo style",     hint: "Overall look — colour, contrast, mood" },
  { id: "video_style",  label: "Video style",     hint: "Pace, movement, transitions" },
  { id: "angle",        label: "Angle",           hint: "A specific shot you want matched" },
  { id: "model",        label: "Model & casting", hint: "Look, age range, posture, energy" },
  { id: "hair",         label: "Hair",            hint: "The exact hair, not a vibe" },
  { id: "makeup",       label: "Make-up",         hint: "Finish, intensity, skin" },
  { id: "styling",      label: "Styling",         hint: "How the garment is worn and with what" },
  { id: "lighting",     label: "Lighting",        hint: "Hard, soft, direction, colour" },
  { id: "location",     label: "Location & set",  hint: "Where, and what's behind them" },
  { id: "prop",         label: "Props",           hint: "Anything in frame that isn't the garment" },
  { id: "retouch",      label: "Retouching",      hint: "How far to take it" },
  { id: "general",      label: "General",         hint: "Anything else worth showing" },
];

export const SLOT_LABEL: Record<string, string> = Object.fromEntries(
  REFERENCE_SLOTS.map((s) => [s.id, s.label]),
);

/**
 * The standard e-commerce shot list for apparel.
 *
 * This is what a product page actually needs: enough angles to answer
 * "what does it look like on", "how is it made" and "what will arrive".
 * Every one of these exists because a customer returns the garment when
 * it's missing.
 */
export const ECOM_ANGLES: { angle: string; medium: Medium; description: string }[] = [
  { angle: "Front — on model",   medium: "photo", description: "Full length, straight on, arms relaxed" },
  { angle: "Back — on model",    medium: "photo", description: "Full length, straight on" },
  { angle: "Three-quarter",      medium: "photo", description: "45° turn, shows the side seam and drape" },
  { angle: "Side profile",       medium: "photo", description: "True side, for silhouette and fit through the body" },
  { angle: "Detail — fabric",    medium: "photo", description: "Close enough to read the weave or knit" },
  { angle: "Detail — hardware",  medium: "photo", description: "Zips, buttons, buckles, eyelets" },
  { angle: "Detail — branding",  medium: "photo", description: "Labels, embroidery, prints" },
  { angle: "Flat lay",           medium: "photo", description: "Laid flat, square on, for the size guide" },
  { angle: "Movement",           medium: "video", description: "Walk or turn — shows weight and drape" },
  { angle: "360 turn",           medium: "video", description: "Slow rotation on the spot" },
];

export const CAMPAIGN_ANGLES: { angle: string; medium: Medium; description: string }[] = [
  { angle: "Hero",             medium: "photo", description: "The one image the campaign is built on" },
  { angle: "Wide — in place",  medium: "photo", description: "Environment doing as much work as the garment" },
  { angle: "Portrait",         medium: "photo", description: "Waist up, face and attitude" },
  { angle: "Detail",           medium: "photo", description: "Cropped in, texture and craft" },
  { angle: "Group",            medium: "photo", description: "More than one look together" },
  { angle: "Motion",           medium: "video", description: "15s cut for the feed" },
];

export function anglesFor(type: ShootType) {
  return type === "ecom" ? ECOM_ANGLES : CAMPAIGN_ANGLES;
}

/**
 * The questions a photographer asks that a brief should already answer.
 *
 * Each section carries its own images. Words and pictures describing the
 * same thing belong together — a paragraph about hair and a folder of
 * hair references at opposite ends of a page is how a brief gets read as
 * two unrelated documents.
 *
 * `slot` ties a section to the reference images filed under it, which is
 * why the slot ids must not be renamed once shoots exist.
 */
export const BRIEF_FIELDS: {
  key: string; label: string; hint: string; slot: string; long?: boolean;
}[] = [
  { key: "objective",      label: "What this is for",  slot: "general",     hint: "Where these images end up and what they have to do", long: true },
  { key: "photo_style",    label: "Photo style",       slot: "photo_style", hint: "Colour, contrast, mood. Show what you mean", long: true },
  { key: "video_style",    label: "Video style",       slot: "video_style", hint: "Pace, movement, sound. Leave blank if stills only", long: true },
  { key: "model_style",    label: "Model & casting",   slot: "model",       hint: "Look, age range, sizes, how many", long: true },
  { key: "hair_makeup",    label: "Hair & make-up",    slot: "hair",        hint: "Be specific — this is where shoots drift", long: true },
  { key: "styling_notes",  label: "Styling",           slot: "styling",     hint: "How the garment is worn, and with what", long: true },
  { key: "lighting_notes", label: "Lighting",          slot: "lighting",    hint: "Hard or soft, direction, colour temperature" },
  { key: "background",     label: "Background & set",  slot: "location",    hint: "Seamless colour, location, texture" },
  { key: "retouching",     label: "Retouching",        slot: "retouch",     hint: "How far to take it, and what not to touch" },
  { key: "deliverables",   label: "Deliverables",      slot: "general",     hint: "How many finals, crops, formats, and by when", long: true },
  { key: "usage_rights",   label: "Usage rights",      slot: "general",     hint: "Where the images may run, for how long, in which territories", long: true },
];

/** Slots with images but no paragraph of their own. */
export const EXTRA_SLOTS = ["angle", "makeup", "prop"];

export interface CrewMember { role: string; name: string; contact?: string }

/** The roles most shoots need someone in, offered as a starting crew. */
export const CREW_ROLES = [
  "Photographer", "Videographer", "Stylist", "Hair", "Make-up",
  "Model", "Producer", "Assistant", "Retoucher", "Location",
];

// ── Marketing ────────────────────────────────────────────────

export type Phase = "always_on" | "teaser" | "pre_drop" | "launch_week" | "post_launch" | "remarketing";

/**
 * The launch cadence, in the order it happens.
 *
 * `offsetDays` is relative to the launch date and is what makes a plan
 * generate itself: give the tool a drop date and it can lay the whole
 * run out on a calendar without anyone typing dates in.
 */
export const PHASES: {
  id: Phase; label: string; hint: string; offsetDays: number | null; tone: string;
}[] = [
  { id: "always_on",   label: "Always on",   hint: "Runs regardless of any drop — the feed that keeps you alive between launches", offsetDays: null,  tone: "#6E6E73" },
  { id: "teaser",      label: "Teaser",      hint: "Hints. No product shown in full, no date given yet",                            offsetDays: -21,   tone: "#8E5BC7" },
  { id: "pre_drop",    label: "Pre-drop",    hint: "The build: date announced, waitlist open, product revealed",                    offsetDays: -10,   tone: "#0058B0" },
  { id: "launch_week", label: "Launch week", hint: "The drop itself and the seven days around it",                                  offsetDays: 0,     tone: "#1E8E4E" },
  { id: "post_launch", label: "Post-launch", hint: "Proof: worn, reviewed, styled. Keeps the thing alive",                          offsetDays: 10,    tone: "#B07A17" },
  { id: "remarketing", label: "Remarketing", hint: "Chasing the people who looked and didn't buy",                                  offsetDays: 21,    tone: "#B4453C" },
];

export const PHASE_LABEL: Record<string, string> = Object.fromEntries(PHASES.map((p) => [p.id, p.label]));
export const PHASE_TONE: Record<string, string> = Object.fromEntries(PHASES.map((p) => [p.id, p.tone]));

export const CHANNELS: { id: string; label: string }[] = [
  { id: "instagram",   label: "Instagram" },
  { id: "tiktok",      label: "TikTok" },
  { id: "email",       label: "Email" },
  { id: "sms",         label: "SMS" },
  { id: "paid_social", label: "Paid social" },
  { id: "paid_search", label: "Paid search" },
  { id: "website",     label: "Website" },
  { id: "pr",          label: "PR & press" },
  { id: "influencer",  label: "Influencer / seeding" },
  { id: "event",       label: "Event" },
  { id: "other",       label: "Other" },
];

export const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label]));

export type ItemStatus = "idea" | "briefed" | "in_progress" | "ready" | "scheduled" | "live" | "done";

export const ITEM_STATUSES: { id: ItemStatus; label: string }[] = [
  { id: "idea",        label: "Idea" },
  { id: "briefed",     label: "Briefed" },
  { id: "in_progress", label: "In progress" },
  { id: "ready",       label: "Ready" },
  { id: "scheduled",   label: "Scheduled" },
  { id: "live",        label: "Live" },
  { id: "done",        label: "Done" },
];

/**
 * A starting plan for a drop.
 *
 * Not a template anyone must keep — it's a straw man to argue with, which
 * is a far easier thing to hand someone than an empty calendar.
 */
export const LAUNCH_PLAN: Array<{ phase: Phase; channel: string; title: string; brief: string }> = [
  { phase: "teaser",      channel: "instagram",   title: "Fabric detail, no context",     brief: "Extreme close-up. Say nothing about what it is." },
  { phase: "teaser",      channel: "email",       title: "Something's coming",            brief: "One line to the list. No date, no product." },
  { phase: "pre_drop",    channel: "instagram",   title: "Date announcement",             brief: "Hero image, date in the caption and on the grid." },
  { phase: "pre_drop",    channel: "email",       title: "Waitlist open",                 brief: "Sign-ups get early access. Make that the whole offer." },
  { phase: "pre_drop",    channel: "tiktok",      title: "How it was made",               brief: "Cut from the production log — pattern, cutting, sewing." },
  { phase: "launch_week", channel: "email",       title: "It's live",                     brief: "Sent the hour it drops. Waitlist first, then the full list." },
  { phase: "launch_week", channel: "instagram",   title: "Launch carousel",               brief: "Hero, on-model, detail, flat. Link in bio." },
  { phase: "launch_week", channel: "paid_social", title: "Prospecting set",               brief: "Best-performing organic asset, widened to a lookalike audience." },
  { phase: "launch_week", channel: "sms",         title: "Drop alert",                    brief: "One line, one link. Only to people who opted in." },
  { phase: "post_launch", channel: "instagram",   title: "Worn in the world",             brief: "Customer and community photos. Proof it exists off a model." },
  { phase: "post_launch", channel: "email",       title: "Styling ideas",                 brief: "Three ways to wear it. Sell the wardrobe, not the item." },
  { phase: "remarketing", channel: "paid_social", title: "Viewed, didn't buy",            brief: "Dynamic retargeting on the product they looked at." },
  { phase: "remarketing", channel: "email",       title: "Abandoned basket",              brief: "One reminder, then stop. Two is a nuisance." },
  { phase: "remarketing", channel: "email",       title: "Back in stock / last few",      brief: "Only if it's true. Scarcity you invent gets found out." },
];

/** The always-on rhythm — the work that isn't tied to any drop. */
export const ALWAYS_ON_PLAN: Array<{ channel: string; title: string; brief: string }> = [
  { channel: "instagram",  title: "Weekly product post",   brief: "One garment, shot well, every week regardless of launches." },
  { channel: "tiktok",     title: "Process content",       brief: "Cutting, sewing, fabric. The making is the content." },
  { channel: "email",      title: "Monthly newsletter",    brief: "What you've been working on. Not a sale." },
  { channel: "influencer", title: "Seeding",               brief: "Send product to people who'd wear it anyway." },
  { channel: "website",    title: "Journal entry",         brief: "Long form. Works for search and gives the emails something to link to." },
];

export function phaseDate(launchDate: string | null, phase: Phase): string | null {
  const spec = PHASES.find((p) => p.id === phase);
  if (!launchDate || !spec || spec.offsetDays == null) return null;
  const d = new Date(`${launchDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + spec.offsetDays);
  return d.toISOString().slice(0, 10);
}
