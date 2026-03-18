import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "replit-revenuecat-v2";

const PROJECT_NAME = "Stock Analyzer";

const APP_STORE_APP_NAME = "Stock Analyzer iOS";
const APP_STORE_BUNDLE_ID = "com.stockanalyzer.app";
const PLAY_STORE_APP_NAME = "Stock Analyzer Android";
const PLAY_STORE_PACKAGE_NAME = "com.stockanalyzer.app";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

const PLANS = [
  {
    identifier: "premium_monthly",
    playStoreIdentifier: "premium_monthly:monthly",
    displayName: "Premium Monthly",
    duration: "P1M",
    packageLookupKey: "$rc_monthly",
    packageDisplayName: "Monthly",
    trialDuration: "P7D",
    prices: [
      { amount_micros: 9990000, currency: "USD" },
      { amount_micros: 8990000, currency: "EUR" },
    ],
  },
  {
    identifier: "premium_6month",
    playStoreIdentifier: "premium_6month:p6m",
    displayName: "Premium 6 Month",
    duration: "P6M",
    packageLookupKey: "$rc_six_month",
    packageDisplayName: "6 Months",
    trialDuration: "P7D",
    prices: [
      { amount_micros: 49990000, currency: "USD" },
      { amount_micros: 44990000, currency: "EUR" },
    ],
  },
  {
    identifier: "premium_annual",
    playStoreIdentifier: "premium_annual:annual",
    displayName: "Premium Annual",
    duration: "P1Y",
    packageLookupKey: "$rc_annual",
    packageDisplayName: "Annual",
    trialDuration: "P7D",
    prices: [
      { amount_micros: 79990000, currency: "USD" },
      { amount_micros: 69990000, currency: "EUR" },
    ],
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });

  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);

  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error: createProjectError } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createProjectError) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let app: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!app) {
    throw new Error("No app with test store found");
  } else {
    console.log("App with test store found:", app.id);
  }

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });

  if (listProductsError) throw new Error("Failed to list products");

  const allProducts: { testStore: Product; appStore: Product; playStore: Product }[] = [];

  for (const plan of PLANS) {
    console.log(`\n--- Setting up plan: ${plan.displayName} ---`);

    const ensureProductForApp = async (
      targetApp: App,
      label: string,
      productIdentifier: string,
      isTestStore: boolean
    ): Promise<Product> => {
      const existingProduct = existingProducts.items?.find(
        (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id
      );

      if (existingProduct) {
        console.log(label + " product already exists:", existingProduct.id);
        return existingProduct;
      }

      const body: CreateProductData["body"] = {
        store_identifier: productIdentifier,
        app_id: targetApp.id,
        type: "subscription",
        display_name: plan.displayName,
      };

      if (isTestStore) {
        body.subscription = { duration: plan.duration };
        body.title = plan.displayName;
      }

      const { data: createdProduct, error } = await createProduct({
        client,
        path: { project_id: project.id },
        body,
      });

      if (error) throw new Error("Failed to create " + label + " product for " + plan.identifier);
      console.log("Created " + label + " product:", createdProduct.id);
      return createdProduct;
    };

    const testStoreProduct = await ensureProductForApp(app, "Test Store", plan.identifier, true);
    const appStoreProduct = await ensureProductForApp(appStoreApp, "App Store", plan.identifier, false);
    const playStoreProduct = await ensureProductForApp(playStoreApp, "Play Store", plan.playStoreIdentifier, false);

    allProducts.push({
      testStore: testStoreProduct,
      appStore: appStoreProduct,
      playStore: playStoreProduct,
    });

    console.log("Adding test store prices for:", plan.identifier);
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testStoreProduct.id },
      body: { prices: plan.prices },
    });

    if (priceError) {
      if (priceError && typeof priceError === "object" && "type" in priceError && priceError["type"] === "resource_already_exists") {
        console.log("Test store prices already exist for", plan.identifier);
      } else {
        console.warn("Failed to add test store prices for", plan.identifier, "- continuing");
      }
    } else {
      console.log("Added test store prices for", plan.identifier);
    }
  }

  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);

  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEntitlement, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: ENTITLEMENT_IDENTIFIER,
        display_name: ENTITLEMENT_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEntitlement.id);
    entitlement = newEntitlement;
  }

  const allProductIds = allProducts.flatMap((p) => [p.testStore.id, p.appStore.id, p.playStore.id]);

  const { error: attachEntitlementError } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });

  if (attachEntitlementError) {
    if (attachEntitlementError.type === "unprocessable_entity_error") {
      console.log("Products already attached to entitlement");
    } else {
      throw new Error("Failed to attach products to entitlement");
    }
  } else {
    console.log("Attached all products to entitlement");
  }

  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);

  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: OFFERING_IDENTIFIER,
        display_name: OFFERING_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });

  if (listPackagesError) throw new Error("Failed to list packages");

  for (let i = 0; i < PLANS.length; i++) {
    const plan = PLANS[i];
    const products = allProducts[i];

    let pkg: Package | undefined;
    const existingPackage = existingPackages.items?.find((p) => p.lookup_key === plan.packageLookupKey);

    if (existingPackage) {
      console.log(`Package ${plan.packageLookupKey} already exists:`, existingPackage.id);
      pkg = existingPackage;
    } else {
      const { data: newPackage, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: {
          lookup_key: plan.packageLookupKey,
          display_name: plan.packageDisplayName,
        },
      });
      if (error) throw new Error("Failed to create package for " + plan.identifier);
      console.log(`Created package ${plan.packageLookupKey}:`, newPackage.id);
      pkg = newPackage;
    }

    const { error: attachPackageError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: products.testStore.id, eligibility_criteria: "all" },
          { product_id: products.appStore.id, eligibility_criteria: "all" },
          { product_id: products.playStore.id, eligibility_criteria: "all" },
        ],
      },
    });

    if (attachPackageError) {
      if (attachPackageError.type === "unprocessable_entity_error") {
        console.log(`Skipping package attach for ${plan.packageLookupKey}: already configured`);
      } else {
        console.warn(`Failed to attach products to ${plan.packageLookupKey} package - continuing`);
      }
    } else {
      console.log(`Attached products to ${plan.packageLookupKey} package`);
    }
  }

  const { data: testStoreApiKeys, error: testStoreApiKeysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: app.id },
  });
  if (testStoreApiKeysError) throw new Error("Failed to list Test Store API keys");

  const { data: appStoreApiKeys, error: appStoreApiKeysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp.id },
  });
  if (appStoreApiKeysError) throw new Error("Failed to list App Store API keys");

  const { data: playStoreApiKeys, error: playStoreApiKeysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: playStoreApp.id },
  });
  if (playStoreApiKeysError) throw new Error("Failed to list Play Store API keys");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("\nPlans configured:");
  for (const plan of PLANS) {
    const priceUsd = plan.prices.find((p) => p.currency === "USD");
    console.log(`  ${plan.displayName}: $${(priceUsd!.amount_micros / 1_000_000).toFixed(2)} with 7-day free trial`);
  }
  console.log("\nPublic API Keys:");
  console.log("  Test Store:", testStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A");
  console.log("  App Store:", appStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A");
  console.log("  Play Store:", playStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A");
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
