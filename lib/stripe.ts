import Stripe from "stripe";

// Cached Stripe client. Never import this from a client component —
// STRIPE_SECRET_KEY must never reach the browser.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Add it in Vercel → Environment Variables.");
  }
  cached = new Stripe(key, {
    // Pin the API version so behaviour stays stable across Stripe API updates.
    apiVersion: "2026-06-24.dahlia",
  });
  return cached;
}
