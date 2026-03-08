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
