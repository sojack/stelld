# Payments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SaaS subscription billing (Free/Pro/Business tiers with Stripe Checkout + Customer Portal) and form payment collection (Stripe Connect, Business-only) to Stelld.

**Architecture:** Stripe Checkout handles subscription sign-up, Customer Portal handles plan management/cancellation. Webhooks keep local DB in sync with Stripe's subscription state. Limit enforcement happens in existing API routes (form creation, submission acceptance). Stripe Connect enables Business-tier authors to collect payments from form respondents.

**Tech Stack:** Stripe SDK (`stripe`), Stripe Checkout, Stripe Customer Portal, Stripe Connect, Prisma, Next.js API routes

**Design doc:** `docs/plans/2026-03-07-payments-design.md`

---

### Task 1: Install Stripe SDK and add env vars

**Files:**
- Modify: `package.json`
- Create: `.env.example` (update with new vars)

**Step 1: Install stripe**

Run: `npm install stripe`

**Step 2: Add env vars to `.env`**

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_...
STRIPE_BUSINESS_YEARLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Note: The `price_...` IDs come from Stripe Dashboard → Products. Create two products (Pro, Business) each with monthly and yearly prices. Do this manually in Stripe Dashboard before proceeding.

**Step 3: Create Stripe client utility**

Create `src/lib/stripe.ts`:

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
  typescript: true,
});
```

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/stripe.ts
git commit -m "feat: install stripe SDK and add client utility"
```

---

### Task 2: Add Subscription and StripeConnect models to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums and models**

Add after the `Submission` model:

```prisma
enum Plan {
  FREE
  PRO
  BUSINESS
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

model Subscription {
  id                     String             @id @default(uuid())
  userId                 String             @unique
  stripeCustomerId       String             @unique
  stripeSubscriptionId   String?            @unique
  plan                   Plan               @default(FREE)
  status                 SubscriptionStatus @default(ACTIVE)
  currentPeriodEnd       DateTime?
  cancelAtPeriodEnd      Boolean            @default(false)
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}

model StripeConnect {
  id                 String  @id @default(uuid())
  userId             String  @unique
  stripeAccountId    String  @unique
  onboardingComplete Boolean @default(false)
  payoutsEnabled     Boolean @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("stripe_connects")
}
```

**Step 2: Add relations to User model**

Add to the `User` model (after `forms Form[]`):

```prisma
  subscription  Subscription?
  stripeConnect StripeConnect?
```

**Step 3: Run migration**

Run: `npx prisma migrate dev --name add-subscriptions-and-stripe-connect`

**Step 4: Verify generated client**

Run: `npx prisma generate`

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Subscription and StripeConnect models"
```

---

### Task 3: Create plan limits utility

**Files:**
- Create: `src/lib/plans.ts`

**Step 1: Create plan limits config**

Create `src/lib/plans.ts`:

```ts
import { Plan } from "@/generated/prisma/client";

export interface PlanLimits {
  maxForms: number;
  maxSubmissionsPerMonth: number;
  canCollectPayments: boolean;
  maxStorageMB: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxForms: 5,
    maxSubmissionsPerMonth: 100,
    canCollectPayments: false,
    maxStorageMB: 100,
  },
  PRO: {
    maxForms: 50,
    maxSubmissionsPerMonth: 1000,
    canCollectPayments: false,
    maxStorageMB: 1024,
  },
  BUSINESS: {
    maxForms: Infinity,
    maxSubmissionsPerMonth: 10000,
    canCollectPayments: true,
    maxStorageMB: 10240,
  },
};

export function getPlanLimits(plan: Plan | undefined | null): PlanLimits {
  return PLAN_LIMITS[plan ?? "FREE"];
}
```

**Step 2: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat: add plan limits configuration"
```

---

### Task 4: Create billing API — checkout session

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`

**Step 1: Implement checkout route**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

const PRICE_IDS: Record<string, string | undefined> = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  business_monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
  business_yearly: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceKey } = await req.json();
  const priceId = PRICE_IDS[priceKey];
  if (!priceId) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  // Find or create Stripe customer
  let subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;

    // Create subscription record with FREE plan (will be updated by webhook)
    subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id,
        stripeCustomerId: customerId,
        plan: "FREE",
        status: "ACTIVE",
      },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/{locale}/dashboard/billing?result=success`,
    cancel_url: `${appUrl}/{locale}/dashboard/billing?result=canceled`,
    metadata: { userId: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

Note: The `{locale}` in the success/cancel URLs should be replaced with the actual locale from the request. In the frontend, the caller will pass the locale so the redirect URL is correct. A simpler approach: use a locale-agnostic path like `/dashboard/billing` and let the middleware handle the redirect. Or pass `locale` in the request body. The implementation should use the simpler approach — pass locale in the body:

Replace the success/cancel URLs with:
```ts
const { priceKey, locale } = await req.json();
// ...
success_url: `${appUrl}/${locale || "en"}/dashboard/billing?result=success`,
cancel_url: `${appUrl}/${locale || "en"}/dashboard/billing?result=canceled`,
```

**Step 2: Commit**

```bash
git add src/app/api/billing/checkout/route.ts
git commit -m "feat: add billing checkout API route"
```

---

### Task 5: Create billing API — customer portal

**Files:**
- Create: `src/app/api/billing/portal/route.ts`

**Step 1: Implement portal route**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 404 });
  }

  const { locale } = await req.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/${locale || "en"}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
```

**Step 2: Commit**

```bash
git add src/app/api/billing/portal/route.ts
git commit -m "feat: add billing portal API route"
```

---

### Task 6: Create billing API — status endpoint

**Files:**
- Create: `src/app/api/billing/status/route.ts`

**Step 1: Implement status route**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getPlanLimits } from "@/lib/plans";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  const plan = subscription?.plan ?? "FREE";
  const limits = getPlanLimits(plan);

  // Count current forms
  const formCount = await prisma.form.count({
    where: { userId: session.user.id },
  });

  // Count submissions this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const submissionCount = await prisma.submission.count({
    where: {
      form: { userId: session.user.id },
      createdAt: { gte: monthStart },
    },
  });

  return NextResponse.json({
    plan,
    status: subscription?.status ?? "ACTIVE",
    currentPeriodEnd: subscription?.currentPeriodEnd,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    limits,
    usage: {
      forms: formCount,
      submissionsThisMonth: submissionCount,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/billing/status/route.ts
git commit -m "feat: add billing status API route"
```

---

### Task 7: Create Stripe webhook handler

**Files:**
- Create: `src/app/api/billing/webhook/route.ts`

**Step 1: Implement webhook**

```ts
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { Plan, SubscriptionStatus } from "@/generated/prisma/client";
import type Stripe from "stripe";

// Map Stripe price IDs to plans
function planFromPriceId(priceId: string): Plan {
  const proPrices = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  ];
  const businessPrices = [
    process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
  ];
  if (proPrices.includes(priceId)) return "PRO";
  if (businessPrices.includes(priceId)) return "BUSINESS";
  return "FREE";
}

function mapStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active": return "ACTIVE";
    case "past_due": return "PAST_DUE";
    case "canceled":
    case "unpaid": return "CANCELED";
    case "trialing": return "TRIALING";
    default: return "ACTIVE";
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription && session.customer) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const priceId = stripeSubscription.items.data[0]?.price.id;
        const plan = planFromPriceId(priceId);

        await prisma.subscription.upsert({
          where: { stripeCustomerId: session.customer as string },
          update: {
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: "ACTIVE",
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
          create: {
            userId: session.metadata?.userId ?? "",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: "ACTIVE",
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription && invoice.customer) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: invoice.customer as string },
          data: {
            status: "ACTIVE",
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: invoice.customer as string },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const plan = planFromPriceId(priceId);

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          plan,
          status: mapStatus(sub.status),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          plan: "FREE",
          status: "CANCELED",
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
        },
      });
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await prisma.stripeConnect.updateMany({
        where: { stripeAccountId: account.id },
        data: {
          onboardingComplete: account.details_submitted ?? false,
          payoutsEnabled: account.payouts_enabled ?? false,
        },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/billing/webhook/route.ts
git commit -m "feat: add Stripe webhook handler"
```

---

### Task 8: Enforce plan limits in existing API routes

**Files:**
- Modify: `src/app/api/forms/route.ts` (POST handler)
- Modify: `src/app/api/submissions/route.ts` (POST handler)

**Step 1: Add form creation limit to `POST /api/forms`**

In `src/app/api/forms/route.ts`, after the auth check in the `POST` handler, add:

```ts
import { getPlanLimits } from "@/lib/plans";

// After auth check, before prisma.form.create:
const subscription = await prisma.subscription.findUnique({
  where: { userId: session.user.id },
});
const limits = getPlanLimits(subscription?.plan);
const formCount = await prisma.form.count({
  where: { userId: session.user.id },
});
if (formCount >= limits.maxForms) {
  return NextResponse.json({ error: "FORM_LIMIT_REACHED" }, { status: 403 });
}
```

**Step 2: Add submission limit to `POST /api/submissions`**

In `src/app/api/submissions/route.ts`, after verifying the form is published (after `if (!form)` check), add:

```ts
import { getPlanLimits } from "@/lib/plans";

// After form lookup, before submission create:
const subscription = await prisma.subscription.findUnique({
  where: { userId: form.userId },
});
const limits = getPlanLimits(subscription?.plan);
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const submissionCount = await prisma.submission.count({
  where: { formId: form.id, createdAt: { gte: monthStart } },
});
if (submissionCount >= limits.maxSubmissionsPerMonth) {
  return NextResponse.json({ error: "SUBMISSION_LIMIT_REACHED" }, { status: 403 });
}
```

**Step 3: Commit**

```bash
git add src/app/api/forms/route.ts src/app/api/submissions/route.ts
git commit -m "feat: enforce plan limits on form creation and submissions"
```

---

### Task 9: Add billing translation strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/fr.json`

**Step 1: Add `billing` namespace to `en.json`**

Add after the `"error"` section:

```json
"billing": {
  "title": "Billing",
  "currentPlan": "Current Plan",
  "free": "Free",
  "pro": "Pro",
  "business": "Business",
  "perMonth": "/month",
  "perYear": "/year",
  "upgrade": "Upgrade",
  "upgradeToPro": "Upgrade to Pro",
  "upgradeToBusiness": "Upgrade to Business",
  "manageBilling": "Manage Billing",
  "monthly": "Monthly",
  "yearly": "Yearly",
  "savePercent": "Save ~17%",
  "formsUsed": "{used} / {limit} forms",
  "formsUsedUnlimited": "{used} forms (unlimited)",
  "submissionsUsed": "{used} / {limit} submissions this month",
  "usage": "Usage",
  "cancelAtPeriodEnd": "Cancels at end of period",
  "pastDue": "Payment past due",
  "upgradePrompt": "Upgrade for more forms and submissions",
  "formLimitReached": "You've reached your form limit. Upgrade your plan to create more forms.",
  "submissionLimitReached": "This form is not currently accepting responses.",
  "connectStripe": "Connect Stripe Account",
  "stripeConnected": "Stripe connected",
  "payoutsEnabled": "Payouts enabled",
  "onboardingIncomplete": "Complete Stripe onboarding",
  "paymentField": "Payment",
  "businessOnly": "Business plan",
  "success": "Subscription activated!",
  "canceled": "Checkout canceled"
}
```

**Step 2: Add `billing` namespace to `fr.json`**

```json
"billing": {
  "title": "Facturation",
  "currentPlan": "Forfait actuel",
  "free": "Gratuit",
  "pro": "Pro",
  "business": "Affaires",
  "perMonth": "/mois",
  "perYear": "/an",
  "upgrade": "Mettre à niveau",
  "upgradeToPro": "Passer au Pro",
  "upgradeToBusiness": "Passer au Affaires",
  "manageBilling": "Gérer la facturation",
  "monthly": "Mensuel",
  "yearly": "Annuel",
  "savePercent": "Économisez ~17%",
  "formsUsed": "{used} / {limit} formulaires",
  "formsUsedUnlimited": "{used} formulaires (illimité)",
  "submissionsUsed": "{used} / {limit} soumissions ce mois-ci",
  "usage": "Utilisation",
  "cancelAtPeriodEnd": "Annulation à la fin de la période",
  "pastDue": "Paiement en retard",
  "upgradePrompt": "Passez à un forfait supérieur pour plus de formulaires et de soumissions",
  "formLimitReached": "Vous avez atteint votre limite de formulaires. Passez à un forfait supérieur pour en créer davantage.",
  "submissionLimitReached": "Ce formulaire n'accepte pas de réponses pour le moment.",
  "connectStripe": "Connecter un compte Stripe",
  "stripeConnected": "Stripe connecté",
  "payoutsEnabled": "Paiements activés",
  "onboardingIncomplete": "Compléter l'intégration Stripe",
  "paymentField": "Paiement",
  "businessOnly": "Forfait Affaires",
  "success": "Abonnement activé!",
  "canceled": "Paiement annulé"
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/fr.json
git commit -m "feat: add billing translation strings (EN + FR)"
```

---

### Task 10: Create billing dashboard page

**Files:**
- Create: `src/app/[locale]/(dashboard)/dashboard/billing/page.tsx`

**Step 1: Implement billing page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";

interface BillingStatus {
  plan: "FREE" | "PRO" | "BUSINESS";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: {
    maxForms: number;
    maxSubmissionsPerMonth: number;
    canCollectPayments: boolean;
  };
  usage: {
    forms: number;
    submissionsThisMonth: number;
  };
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const result = searchParams.get("result");

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data) => {
        setBilling(data);
        setLoading(false);
      });
  }, []);

  async function handleCheckout(priceKey: string) {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceKey, locale }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  async function handlePortal() {
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-600 text-lg">Loading...</div>;
  }

  if (!billing) return null;

  const planLabel = t(billing.plan.toLowerCase() as "free" | "pro" | "business");
  const isFreePlan = billing.plan === "FREE";
  const formsDisplay = billing.limits.maxForms === Infinity
    ? t("formsUsedUnlimited", { used: billing.usage.forms })
    : t("formsUsed", { used: billing.usage.forms, limit: billing.limits.maxForms });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("title")}</h1>

      {result === "success" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium">
          {t("success")}
        </div>
      )}
      {result === "canceled" && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm font-medium">
          {t("canceled")}
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">{t("currentPlan")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-900">{planLabel}</p>
            {billing.cancelAtPeriodEnd && (
              <p className="text-sm text-orange-600 mt-1">{t("cancelAtPeriodEnd")}</p>
            )}
            {billing.status === "PAST_DUE" && (
              <p className="text-sm text-red-600 mt-1">{t("pastDue")}</p>
            )}
          </div>
          {!isFreePlan && (
            <button
              onClick={handlePortal}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md px-4 py-2 transition-colors"
            >
              {t("manageBilling")}
            </button>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">{t("usage")}</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">{formsDisplay}</span>
            </div>
            {billing.limits.maxForms !== Infinity && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (billing.usage.forms / billing.limits.maxForms) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">
                {t("submissionsUsed", {
                  used: billing.usage.submissionsThisMonth,
                  limit: billing.limits.maxSubmissionsPerMonth,
                })}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (billing.usage.submissionsThisMonth / billing.limits.maxSubmissionsPerMonth) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Cards */}
      {isFreePlan && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`text-sm font-medium px-3 py-1 rounded-md ${billingCycle === "monthly" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`text-sm font-medium px-3 py-1 rounded-md ${billingCycle === "yearly" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              {t("yearly")} <span className="text-green-600 text-xs ml-1">{t("savePercent")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pro Card */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-bold text-gray-900">{t("pro")}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${billingCycle === "monthly" ? "19" : "190"}
                <span className="text-sm font-normal text-gray-500">
                  {billingCycle === "monthly" ? t("perMonth") : t("perYear")}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>50 forms</li>
                <li>1,000 submissions/month</li>
              </ul>
              <button
                onClick={() => handleCheckout(`pro_${billingCycle}`)}
                className="mt-6 w-full bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {t("upgradeToPro")}
              </button>
            </div>

            {/* Business Card */}
            <div className="bg-white rounded-lg border-2 border-green-600 p-6">
              <h3 className="text-lg font-bold text-gray-900">{t("business")}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${billingCycle === "monthly" ? "49" : "490"}
                <span className="text-sm font-normal text-gray-500">
                  {billingCycle === "monthly" ? t("perMonth") : t("perYear")}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>Unlimited forms</li>
                <li>10,000 submissions/month</li>
                <li>Payment collection</li>
              </ul>
              <button
                onClick={() => handleCheckout(`business_${billingCycle}`)}
                className="mt-6 w-full bg-green-600 text-white font-medium py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                {t("upgradeToBusiness")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Upgrade from Pro to Business */}
      {billing.plan === "PRO" && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{t("upgradeToBusiness")}</h3>
          <p className="text-sm text-gray-600 mb-4">Unlimited forms, 10,000 submissions/month, payment collection</p>
          <button
            onClick={handlePortal}
            className="bg-green-600 text-white font-medium px-5 py-2 rounded-md hover:bg-green-700 transition-colors"
          >
            {t("upgrade")}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/(dashboard)/dashboard/billing/page.tsx
git commit -m "feat: add billing dashboard page"
```

---

### Task 11: Add billing nav link to dashboard layout

**Files:**
- Modify: `src/app/[locale]/(dashboard)/layout.tsx`

**Step 1: Add "Billing" link to nav**

In the nav bar, add a link to `/dashboard/billing` alongside the existing elements. After the `<Link href="/dashboard">Stelld</Link>`, add:

```tsx
<Link
  href="/dashboard/billing"
  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
>
  {t("title")}
</Link>
```

This requires adding `billing` translations to the server-side `getTranslations` call. Use:

```ts
const tb = await getTranslations("billing");
```

And reference `tb("title")` in the link.

**Step 2: Commit**

```bash
git add src/app/[locale]/(dashboard)/layout.tsx
git commit -m "feat: add billing link to dashboard nav"
```

---

### Task 12: Add usage indicator to dashboard form list

**Files:**
- Modify: `src/app/[locale]/(dashboard)/dashboard/page.tsx`

**Step 1: Fetch billing status alongside forms**

Add a billing status fetch at mount time (alongside existing forms fetch):

```ts
const [billing, setBilling] = useState<{ plan: string; limits: { maxForms: number }; usage: { forms: number } } | null>(null);

// In the useEffect, add:
fetch("/api/billing/status").then(r => r.json()).then(setBilling);
```

**Step 2: Render usage indicator**

Below the `<h1>` / "New Form" button row, render:

```tsx
{billing && billing.limits.maxForms !== Infinity && (
  <p className="text-sm text-gray-500 mb-4">
    {tb("formsUsed", { used: billing.usage.forms, limit: billing.limits.maxForms })}
    {billing.usage.forms >= billing.limits.maxForms && (
      <Link href="/dashboard/billing" className="ml-2 text-green-600 hover:underline">
        {tb("upgrade")}
      </Link>
    )}
  </p>
)}
```

**Step 3: Handle form limit error on create**

When `POST /api/forms` returns 403, show the limit message instead of a generic error:

```ts
if (res.status === 403) {
  setError(tb("formLimitReached"));
  return;
}
```

**Step 4: Commit**

```bash
git add src/app/[locale]/(dashboard)/dashboard/page.tsx
git commit -m "feat: add usage indicator and form limit handling to dashboard"
```

---

### Task 13: Handle submission limit in form renderer

**Files:**
- Modify: `src/components/form-renderer.tsx`

**Step 1: Handle 403 from submission API**

In the `onComplete` handler, after `if (!res.ok)`, differentiate 403:

```ts
if (res.status === 403) {
  setError(t("submissionLimitReached"));
  return;
}
if (!res.ok) {
  setError(t("submitError"));
  return;
}
```

**Step 2: Add `submissionLimitReached` to renderer translations**

In `messages/en.json` under `"renderer"`:

```json
"submissionLimitReached": "This form is not currently accepting responses."
```

In `messages/fr.json` under `"renderer"`:

```json
"submissionLimitReached": "Ce formulaire n'accepte pas de réponses pour le moment."
```

**Step 3: Commit**

```bash
git add src/components/form-renderer.tsx messages/en.json messages/fr.json
git commit -m "feat: handle submission limit in form renderer"
```

---

### Task 14: Stripe Connect API routes (Business tier)

**Files:**
- Create: `src/app/api/billing/connect/route.ts`
- Create: `src/app/api/billing/connect/callback/route.ts`

**Step 1: Create Connect onboarding route**

`src/app/api/billing/connect/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify Business plan
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });
  if (subscription?.plan !== "BUSINESS") {
    return NextResponse.json({ error: "Business plan required" }, { status: 403 });
  }

  const { locale } = await req.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Check if already has a Connect account
  let connectRecord = await prisma.stripeConnect.findUnique({
    where: { userId: session.user.id },
  });

  let accountId: string;
  if (connectRecord) {
    accountId = connectRecord.stripeAccountId;
  } else {
    const account = await stripe.accounts.create({
      type: "standard",
      email: session.user.email!,
      metadata: { userId: session.user.id },
    });
    accountId = account.id;

    connectRecord = await prisma.stripeConnect.create({
      data: {
        userId: session.user.id,
        stripeAccountId: accountId,
      },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/${locale || "en"}/dashboard/billing`,
    return_url: `${appUrl}/${locale || "en"}/dashboard/billing?connect=success`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
```

**Step 2: Create Connect status endpoint**

Add a `GET` handler to the same file:

```ts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connect = await prisma.stripeConnect.findUnique({
    where: { userId: session.user.id },
  });

  if (!connect) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    onboardingComplete: connect.onboardingComplete,
    payoutsEnabled: connect.payoutsEnabled,
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/billing/connect/route.ts
git commit -m "feat: add Stripe Connect onboarding API"
```

---

### Task 15: Add Stripe Connect section to billing page

**Files:**
- Modify: `src/app/[locale]/(dashboard)/dashboard/billing/page.tsx`

**Step 1: Fetch Connect status**

Add state and fetch for Connect status:

```ts
const [connect, setConnect] = useState<{ connected: boolean; onboardingComplete?: boolean; payoutsEnabled?: boolean } | null>(null);

// In useEffect:
fetch("/api/billing/connect").then(r => r.json()).then(setConnect);
```

**Step 2: Render Connect section (Business only)**

After the usage section, if plan is BUSINESS:

```tsx
{billing.plan === "BUSINESS" && connect && (
  <div className="bg-white rounded-lg border p-6 mb-6">
    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">{t("paymentField")}</h2>
    {connect.connected && connect.onboardingComplete ? (
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm text-gray-700">{t("stripeConnected")} — {t("payoutsEnabled")}</span>
      </div>
    ) : connect.connected ? (
      <div>
        <p className="text-sm text-yellow-700 mb-3">{t("onboardingIncomplete")}</p>
        <button
          onClick={handleConnect}
          className="text-sm font-medium text-green-600 hover:underline"
        >
          {t("onboardingIncomplete")}
        </button>
      </div>
    ) : (
      <button
        onClick={handleConnect}
        className="bg-green-600 text-white font-medium px-5 py-2 rounded-md hover:bg-green-700 transition-colors"
      >
        {t("connectStripe")}
      </button>
    )}
  </div>
)}
```

Add the handler:

```ts
async function handleConnect() {
  const res = await fetch("/api/billing/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  const { url } = await res.json();
  if (url) window.location.href = url;
}
```

**Step 3: Commit**

```bash
git add src/app/[locale]/(dashboard)/dashboard/billing/page.tsx
git commit -m "feat: add Stripe Connect section to billing page"
```

---

### Task 16: Add Payment field type to builder (Business only)

**Files:**
- Modify: `src/components/builder/field-palette.tsx`
- Modify: `src/components/builder/types.ts`
- Modify: `src/components/builder/property-editor.tsx`
- Modify: `src/components/form-builder.tsx`

**Step 1: Add payment type to FieldTypeId and FIELD_TYPE_DEFS**

In `field-palette.tsx`, add `"payment"` to `FieldTypeId`:

```ts
export type FieldTypeId = "text" | "email" | "phone" | "number" | "textarea" | "dropdown" | "checkbox" | "radio" | "date" | "payment";
```

Add to `FIELD_TYPE_DEFS`:

```ts
{ id: "payment", labelKey: "fieldPayment", icon: "$", surveyType: "expression", isPayment: true },
```

Update `FieldType` interface to include `isPayment?: boolean`.

**Step 2: Update FormField type**

In `types.ts`, add optional payment fields:

```ts
export interface FormField {
  // ... existing fields
  paymentAmount?: number;
  paymentCurrency?: "CAD" | "USD";
  paymentDescription?: string;
}
```

**Step 3: Add payment property editing in PropertyEditor**

In `property-editor.tsx`, when the field type is `expression` and has `paymentAmount` defined (or `isPayment` from the field type), show:
- Amount input (number)
- Currency select (CAD / USD)
- Description input

**Step 4: Gate payment field in palette**

In `FormBuilder`, pass the user's plan to `FieldPalette`. If plan is not BUSINESS, render the payment option greyed out with a "Business plan" badge. The plan can be passed as a prop from the builder page (fetched server-side via the subscription).

Add `plan` prop to `FormBuilderProps`:

```ts
plan?: "FREE" | "PRO" | "BUSINESS";
```

In the builder page (`src/app/[locale]/builder/[id]/page.tsx`), fetch the subscription:

```ts
const subscription = await prisma.subscription.findUnique({
  where: { userId: session!.user!.id },
});
// Pass to FormBuilder:
plan={(subscription?.plan as "FREE" | "PRO" | "BUSINESS") ?? "FREE"}
```

**Step 5: Commit**

```bash
git add src/components/builder/field-palette.tsx src/components/builder/types.ts src/components/builder/property-editor.tsx src/components/form-builder.tsx src/app/[locale]/builder/[id]/page.tsx
git commit -m "feat: add payment field type to builder (Business only)"
```

---

### Task 17: Implement form payment collection on submission

**Files:**
- Modify: `src/app/api/submissions/route.ts`
- Create: `src/app/api/billing/payment-session/route.ts`

**Step 1: Create payment session endpoint**

`src/app/api/billing/payment-session/route.ts`:

```ts
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { formId, data, locale } = await req.json();

  const form = await prisma.form.findFirst({
    where: { id: formId, isPublished: true },
    include: {
      user: {
        include: { stripeConnect: true },
      },
    },
  });

  if (!form || !form.user.stripeConnect?.stripeAccountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Extract payment field from schema
  const schema = form.schema as { pages?: { elements?: Array<{ type: string; paymentAmount?: number; paymentCurrency?: string; paymentDescription?: string }> }[] };
  const paymentField = schema?.pages?.[0]?.elements?.find(
    (el) => el.type === "expression" && el.paymentAmount
  );

  if (!paymentField?.paymentAmount) {
    return NextResponse.json({ error: "No payment field" }, { status: 400 });
  }

  const amountInCents = Math.round(paymentField.paymentAmount * 100);
  const currency = (paymentField.paymentCurrency ?? "CAD").toLowerCase();
  const platformFee = Math.round(amountInCents * 0.02); // 2% platform fee

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: paymentField.paymentDescription || form.title,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
      },
      success_url: `${appUrl}/${locale || "en"}/f/${formId}?payment=success`,
      cancel_url: `${appUrl}/${locale || "en"}/f/${formId}?payment=canceled`,
      metadata: {
        formId,
        submissionData: JSON.stringify(data),
      },
    },
    {
      stripeAccount: form.user.stripeConnect.stripeAccountId,
    }
  );

  return NextResponse.json({ url: checkoutSession.url });
}
```

**Step 2: Update form renderer to detect payment field**

In the `FormRenderer`, before submitting via the regular submission endpoint, check if the form schema contains a payment field. If so, redirect to the payment session endpoint instead.

This requires passing the schema to the renderer (already done) and checking for payment fields in the `onComplete` handler:

```ts
// In onComplete handler:
const schemaObj = schema as { pages?: { elements?: Array<{ type: string; paymentAmount?: number }> }[] };
const hasPayment = schemaObj?.pages?.[0]?.elements?.some(
  (el) => el.type === "expression" && el.paymentAmount
);

if (hasPayment) {
  const res = await fetch("/api/billing/payment-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formId, data: sender.data, locale }),
  });
  const { url } = await res.json();
  if (url) window.location.href = url;
  return;
}
// ... regular submission flow
```

**Step 3: Handle payment webhook for submission creation**

In the webhook handler (Task 7), add a case for `checkout.session.completed` where `mode === "payment"` (not subscription). When a payment checkout completes on a connected account, create the submission:

```ts
// In webhook handler, inside checkout.session.completed:
if (session.mode === "payment" && session.metadata?.formId) {
  const data = JSON.parse(session.metadata.submissionData || "{}");
  await prisma.submission.create({
    data: {
      formId: session.metadata.formId,
      data,
      metadata: {
        paymentId: session.payment_intent,
        paidAmount: session.amount_total,
        paidCurrency: session.currency,
        submittedAt: new Date().toISOString(),
      },
    },
  });
}
```

Note: Connected account webhooks require configuring the webhook endpoint in Stripe Dashboard for Connect events, or using `stripe.webhooks.constructEvent` with the Connect-specific signing secret.

**Step 4: Commit**

```bash
git add src/app/api/billing/payment-session/route.ts src/app/api/billing/webhook/route.ts src/components/form-renderer.tsx
git commit -m "feat: implement form payment collection via Stripe Connect"
```

---

### Task 18: Add builder translation for payment field

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/fr.json`

**Step 1: Add builder.fieldPayment**

In `en.json` under `"builder"`:
```json
"fieldPayment": "Payment"
```

In `fr.json` under `"builder"`:
```json
"fieldPayment": "Paiement"
```

Also add property editor labels:

In `en.json` under `"builder"`:
```json
"paymentAmount": "Amount",
"paymentCurrency": "Currency",
"paymentDescription": "Payment description"
```

In `fr.json` under `"builder"`:
```json
"paymentAmount": "Montant",
"paymentCurrency": "Devise",
"paymentDescription": "Description du paiement"
```

**Step 2: Commit**

```bash
git add messages/en.json messages/fr.json
git commit -m "feat: add payment field translation strings"
```

---

### Task 19: Verify and test

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual testing checklist**

1. Set up Stripe test mode products/prices in Stripe Dashboard
2. Add price IDs to `.env`
3. Start dev server: `npm run dev`
4. Visit `/dashboard/billing` — should see Free plan with upgrade cards
5. Click "Upgrade to Pro" — should redirect to Stripe Checkout (test mode)
6. Complete test checkout — webhook fires, plan updates
7. Visit `/dashboard/billing` — should show Pro plan, usage bars
8. Click "Manage Billing" — should open Stripe Customer Portal
9. Create forms up to limit — 6th form should fail with limit message
10. For Business: Connect Stripe account, add payment field to form, test respondent payment flow

**Step 4: Set up Stripe webhook forwarding for local dev**

Run: `stripe listen --forward-to localhost:3000/api/billing/webhook`

This requires the Stripe CLI installed locally.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during payments testing"
```
