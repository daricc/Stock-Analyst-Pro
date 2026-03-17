import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router: IRouter = Router();

router.get("/stripe/subscription", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!user?.stripeSubscriptionId) {
    res.json({ subscription: null, isPremium: false });
    return;
  }

  try {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId}`
    );
    const subscription = result.rows[0];
    const isPremium =
      subscription &&
      (subscription.status === "active" || subscription.status === "trialing");
    res.json({ subscription, isPremium });
  } catch {
    res.json({ subscription: null, isPremium: false });
  }
});

router.get("/stripe/premium-status", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ isPremium: false });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!user?.stripeSubscriptionId) {
    res.json({ isPremium: false });
    return;
  }

  try {
    const result = await db.execute(
      sql`SELECT status FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId}`
    );
    const sub = result.rows[0];
    res.json({
      isPremium: sub && (sub.status === "active" || sub.status === "trialing"),
    });
  } catch {
    res.json({ isPremium: false });
  }
});

router.get("/stripe/products", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount
    `);
    res.json({ products: result.rows });
  } catch (err) {
    console.error("Error listing products:", err);
    res.json({ products: [] });
  }
});

router.post("/stripe/checkout", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { priceId } = req.body;
  if (!priceId) {
    res.status(400).json({ error: "Missing priceId" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));

    let customerId = user?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email ?? undefined,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, req.user.id));
    }

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const origin = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      metadata: { userId: req.user.id },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe/portal", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found" });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"];

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${proto}://${host}/profile`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error("Portal error:", err.message);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

export default router;
