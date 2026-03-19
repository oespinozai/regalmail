/**
 * RegalMail Stripe billing integration.
 *
 * Handles subscription management: checkout sessions, portal URLs,
 * and subscription status queries. Products/prices are managed
 * idempotently — checked for existence before creation.
 */
import Stripe from "stripe";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment");
}

export type TierName = "free" | "pro" | "business";

interface BillingConfig {
  stripeCustomerId?: string;
  tier: TierName;
}

// Where we persist per-user billing state
const BILLING_DIR = path.join(os.homedir(), ".regalmail");
const BILLING_FILE = path.join(BILLING_DIR, "billing.json");

function getBillingConfig(): BillingConfig {
  try {
    fs.mkdirSync(BILLING_DIR, { recursive: true });
    const raw = fs.readFileSync(BILLING_FILE, "utf8");
    return JSON.parse(raw) as BillingConfig;
  } catch {
    return { tier: "free" };
  }
}

function saveBillingConfig(cfg: BillingConfig): void {
  fs.mkdirSync(BILLING_DIR, { recursive: true });
  fs.writeFileSync(BILLING_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Product & price IDs (from existing Stripe products — see stripe-products.json)
// ---------------------------------------------------------------------------

// These are pre-created Stripe product/price IDs.
// If not present, create on first use via ensureProducts().
const KNOWN_PRODUCTS: Record<TierName, { productId?: string; priceId?: string; monthlyAmount: number }> = {
  free:     { monthlyAmount: 0 },
  pro:      { productId: "prod_UB0qtZxoAGjSdF", priceId: "price_1TCeoOJPESNny8hCDc88g7Xu", monthlyAmount: 1500 },
  business: { productId: "prod_UB0qzVnNO9KiAe", priceId: "price_1TCeoPJPESNny8hCeVKNXzXk", monthlyAmount: 4900 },
};

// ---------------------------------------------------------------------------
// Ensure products exist (idempotent — safe to call repeatedly)
// ---------------------------------------------------------------------------

export async function ensureProducts(): Promise<void> {
  const stripe = getStripe();

  for (const [tier, info] of Object.entries(KNOWN_PRODUCTS)) {
    if (tier === "free" || !info.productId) {
      // Check if product already exists by name
      try {
        const existing = await stripe.products.list({
          active: true,
          limit: 100,
        });
        const found = existing.data.find((p) => p.name === `RegalMail ${tier}`);
        if (found) {
          (KNOWN_PRODUCTS[tier as TierName]!).productId = found.id;
          // Find price
          const prices = await stripe.prices.list({ product: found.id, active: true, limit: 10 });
          if (prices.data.length > 0) {
            (KNOWN_PRODUCTS[tier as TierName]!).priceId = prices.data[0].id;
          }
          continue;
        }
      } catch {
        // Proceed to create
      }

      // Create product + price
      const product = await stripe.products.create({
        name: `RegalMail ${tier}`,
        description: `RegalMail ${tier} plan — email for AI agents`,
        metadata: { tier },
      });
      (KNOWN_PRODUCTS[tier as TierName]!).productId = product.id;

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: info.monthlyAmount,
        currency: "usd",
        recurring: { interval: "month" },
        nickname: `RegalMail ${tier} monthly`,
      });
      (KNOWN_PRODUCTS[tier as TierName]!).priceId = price.id;
    }
  }
}

// ---------------------------------------------------------------------------
// Checkout session — sends customer to Stripe to upgrade
// ---------------------------------------------------------------------------

export type CheckoutOptions = {
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  tier: TierName;
};

export async function createCheckoutSession(options: CheckoutOptions): Promise<string> {
  const stripe = getStripe();
  const { successUrl, cancelUrl, tier } = options;

  const info = KNOWN_PRODUCTS[tier];
  if (!info?.priceId) {
    await ensureProducts();
  }
  const priceId = KNOWN_PRODUCTS[tier]?.priceId;

  if (!priceId) {
    throw new Error(`No price ID for tier: ${tier}. Ensure Stripe products are configured.`);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { tier },
    },
  };

  if (options.customerId) {
    sessionParams.customer = options.customerId;
  } else {
    sessionParams.customer_email = undefined; // will be collected by Stripe
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) {
    throw new Error("Stripe checkout session created but has no URL");
  }
  return session.url;
}

// ---------------------------------------------------------------------------
// Subscription status
// ---------------------------------------------------------------------------

export type SubscriptionStatus = {
  tier: TierName;
  status: string;
  customerId: string;
  currentPeriodEnd?: Date;
};

export async function getSubscriptionStatus(customerId: string): Promise<SubscriptionStatus> {
  const stripe = getStripe();

  if (!customerId) {
    return { tier: "free", status: "none", customerId: "" };
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    const sub = subscriptions.data[0];
    if (!sub) {
      return { tier: "free", status: "none", customerId };
    }

    const tierFromMeta = (sub.metadata?.tier ?? "free") as TierName;
    const currentPeriodEnd = sub.items?.data?.[0]?.current_period_end;

    return {
      tier: tierFromMeta,
      status: sub.status,
      customerId,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined,
    };
  } catch (err) {
    return { tier: "free", status: "error", customerId };
  }
}

// ---------------------------------------------------------------------------
// Customer portal URL — self-serve billing management
// ---------------------------------------------------------------------------

export async function getCustomerPortalUrl(customerId: string): Promise<string> {
  const stripe = getStripe();

  if (!customerId) {
    throw new Error("No customer ID — cannot open billing portal");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: process.env.BILLING_RETURN_URL ?? "https://alvento.ltd/email-plugin",
  });

  return session.url;
}

// ---------------------------------------------------------------------------
// Store / retrieve stripe customer ID from local billing file
// ---------------------------------------------------------------------------

export function getStoredCustomerId(): string | undefined {
  return getBillingConfig().stripeCustomerId;
}

export function storeCustomerId(customerId: string): void {
  const cfg = getBillingConfig();
  cfg.stripeCustomerId = customerId;
  saveBillingConfig(cfg);
}

// ---------------------------------------------------------------------------
// Get or create Stripe customer
// ---------------------------------------------------------------------------

export async function getOrCreateCustomer(email: string): Promise<string> {
  const stripe = getStripe();

  const existing = getStoredCustomerId();
  if (existing) return existing;

  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length > 0) {
    const id = customers.data[0].id;
    storeCustomerId(id);
    return id;
  }

  const customer = await stripe.customers.create({ email });
  storeCustomerId(customer.id);
  return customer.id;
}

// ---------------------------------------------------------------------------
// Called by OpenClaw after a checkout session completes (webhook or redirect)
// This is the integration point — OpenClaw would call this on payment success
// ---------------------------------------------------------------------------

export async function handleUpgradeSuccess(customerId: string, tier: TierName): Promise<void> {
  const cfg = getBillingConfig();
  cfg.stripeCustomerId = customerId;
  cfg.tier = tier;
  saveBillingConfig(cfg);
}
