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

  const { priceKey, locale } = await req.json();
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
    success_url: `${appUrl}/${locale || "en"}/dashboard/billing?result=success`,
    cancel_url: `${appUrl}/${locale || "en"}/dashboard/billing?result=canceled`,
    metadata: { userId: session.user.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
