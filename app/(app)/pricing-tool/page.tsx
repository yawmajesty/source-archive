import { buildPublicUrl } from "@/lib/url";
import { ShareToolClient } from "./ShareToolClient";

export const metadata = { title: "Pricing Tool — Source[Archive]" };

/**
 * The share desk for the free calculator.
 *
 * The link is built from NEXT_PUBLIC_APP_URL rather than the browser's
 * origin — a link copied while browsing a Vercel preview host is worthless
 * the moment it's emailed out.
 */
export default function PricingToolPage() {
  return <ShareToolClient url={buildPublicUrl("/price")} />;
}
