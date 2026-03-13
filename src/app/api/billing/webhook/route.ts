import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { Plan, SubscriptionStatus } from "@/generated/prisma/client";
import type Stripe from "stripe";

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

/** Extract a string ID from a field that may be a string or an object with `id`. */
function toId(field: string | { id: string } | null | undefined): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}

/**
 * In Stripe SDK v20+, `current_period_end` lives on SubscriptionItem,
 * not on Subscription. This helper reads it from the first item.
 */
function getCurrentPeriodEnd(sub: Stripe.Subscription): Date | null {
  const periodEnd = sub.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000) : null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  // Try signature verification first; if ALB modifies the body, fall back to
  // parsing the event directly and verifying via the Stripe API.
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    // Fallback: parse the body and retrieve the event from Stripe to confirm authenticity
    try {
      const parsed = JSON.parse(body);
      event = await stripe.events.retrieve(parsed.id);
    } catch (err2) {
      console.error("Webhook verification failed:", (err2 as Error).message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = toId(session.subscription);
      const customerId = toId(session.customer);

      if (session.mode === "subscription" && subscriptionId && customerId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = stripeSubscription.items.data[0]?.price.id;
        const plan = planFromPriceId(priceId);
        const currentPeriodEnd = getCurrentPeriodEnd(stripeSubscription);

        await prisma.subscription.upsert({
          where: { stripeCustomerId: customerId },
          update: {
            stripeSubscriptionId: subscriptionId,
            plan,
            status: "ACTIVE",
            currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
          create: {
            userId: session.metadata?.userId ?? "",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan,
            status: "ACTIVE",
            currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
        });
      }

      // Handle payment mode (form payment collection)
      if (session.mode === "payment" && session.metadata?.formId) {
        const data = JSON.parse(session.metadata.submissionData || "{}");
        await prisma.submission.create({
          data: {
            formId: session.metadata.formId,
            data,
            metadata: {
              paymentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
              paidAmount: session.amount_total,
              paidCurrency: session.currency,
              submittedAt: new Date().toISOString(),
            },
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = toId(invoice.customer);
      // In Stripe SDK v20+, subscription is nested under parent.subscription_details
      const subscriptionId = toId(
        invoice.parent?.subscription_details?.subscription ?? null
      );

      if (subscriptionId && customerId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = getCurrentPeriodEnd(stripeSubscription);

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            status: "ACTIVE",
            currentPeriodEnd,
          },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = toId(invoice.customer);

      if (customerId) {
        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: "PAST_DUE" },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const plan = planFromPriceId(priceId);
      const currentPeriodEnd = getCurrentPeriodEnd(sub);

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          plan,
          status: mapStatus(sub.status),
          currentPeriodEnd,
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
