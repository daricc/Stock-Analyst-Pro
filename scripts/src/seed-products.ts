import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log("Creating products and prices in Stripe...");

    const existingProducts = await stripe.products.search({
      query: "name:'Premium' AND active:'true'",
    });

    if (existingProducts.data.length > 0) {
      console.log("Premium product already exists. Skipping creation.");
      console.log(`Existing product ID: ${existingProducts.data[0].id}`);
      const prices = await stripe.prices.list({
        product: existingProducts.data[0].id,
        active: true,
      });
      for (const price of prices.data) {
        console.log(
          `  Price: ${price.id} — $${(price.unit_amount! / 100).toFixed(2)}/${price.recurring?.interval}`
        );
      }
      return;
    }

    const premiumProduct = await stripe.products.create({
      name: "Premium",
      description:
        "Unlock AI day trade playbooks, advanced stock analysis, entry/exit strategies, and unlimited recommendations",
      metadata: {
        tier: "premium",
        features:
          "day_trade_playbooks,ai_analysis,entry_exit_strategies,unlimited_recommendations",
      },
    });
    console.log(`Created product: ${premiumProduct.name} (${premiumProduct.id})`);

    const monthlyPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 999,
      currency: "usd",
      recurring: { interval: "month" },
    });
    console.log(`Created monthly price: $9.99/month (${monthlyPrice.id})`);

    const yearlyPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 7999,
      currency: "usd",
      recurring: { interval: "year" },
    });
    console.log(`Created yearly price: $79.99/year (${yearlyPrice.id})`);

    console.log("Products and prices created successfully!");
    console.log("Webhooks will sync this data to your database automatically.");
  } catch (error: any) {
    console.error("Error creating products:", error.message);
    process.exit(1);
  }
}

createProducts();
