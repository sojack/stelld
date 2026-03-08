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
    return NextResponse.json(
      { error: "Business plan required" },
      { status: 403 }
    );
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
