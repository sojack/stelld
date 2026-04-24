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

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl}/${locale || "en"}/dashboard/billing`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Stripe billing portal error:", err);
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
  }
}
