import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { ReplitConnectors } from "@replit/connectors-sdk";

let cachedStripeSync: StripeSync | null = null;
const connectors = new ReplitConnectors();

async function getStripeCredentials(): Promise<{ secret: string; publishable: string }> {
  const connections = await connectors.listConnections("stripe");
  if (!connections.length) {
    throw new Error("No Stripe connection found. Please set up Stripe integration.");
  }
  const settings = connections[0].settings as Record<string, string>;
  return {
    secret: settings.secret,
    publishable: settings.publishable,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const creds = await getStripeCredentials();
  return new Stripe(creds.secret);
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!cachedStripeSync) {
    const creds = await getStripeCredentials();
    cachedStripeSync = new StripeSync(creds.secret, process.env.DATABASE_URL!);
  }
  return cachedStripeSync;
}
