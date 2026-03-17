import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let cachedStripeSync: StripeSync | null = null;

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  return key;
}

export function getUncachableStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey());
}

export function getStripeSync(): StripeSync {
  if (!cachedStripeSync) {
    cachedStripeSync = new StripeSync(getStripeSecretKey(), process.env.DATABASE_URL!);
  }
  return cachedStripeSync;
}
